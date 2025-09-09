import { logger } from '../../config/logger';
import { StoryModel, Story } from '../../models/story.model';
import { StoryPlanModel, StoryPlan, ChapterSummary } from '../../models/story-plan.model';
import { ChapterModel, Chapter } from '../../models/chapter.model';
import { CharacterModel, Character } from '../../models/character.model';
import { PromptTemplateModel } from '../../models/prompt-template.model';
import { AIProviderManager } from '../ai-provider-manager';
import { StoryValidator } from '../../lib/story-validator';

export interface GenerationOptions {
  storyId: string;
  userId: string;
  aiConfigId?: string;
  startChapter?: number;
  endChapter?: number;
  regenerateExisting?: boolean;
  customInstructions?: string;
  pauseOnError?: boolean;
}

export interface GenerationProgress {
  storyId: string;
  stage: 'planning' | 'generating' | 'validating' | 'complete' | 'error';
  progress: number; // 0-100
  currentChapter?: number;
  totalChapters?: number;
  message?: string;
  error?: string;
  startTime: Date;
  estimatedCompletion?: Date;
}

export interface GenerationResult {
  success: boolean;
  storyId: string;
  chaptersGenerated: number;
  totalWordCount: number;
  generationTime: number;
  qualityScore?: number;
  errors: string[];
  warnings: string[];
}

export class StoryGenerator {
  private aiProvider: AIProviderManager;
  private validator: StoryValidator;
  private activeGenerations = new Map<string, GenerationProgress>();

  constructor() {
    this.aiProvider = new AIProviderManager();
    this.validator = new StoryValidator();
  }

  /**
   * Generate complete story from plan
   */
  async generateStory(options: GenerationOptions): Promise<GenerationResult> {
    const startTime = new Date();
    logger.info('Starting story generation', { options });

    try {
      // Initialize progress tracking
      const progress = this.initializeProgress(options.storyId, startTime);
      this.activeGenerations.set(options.storyId, progress);

      // Load story and plan
      const story = await StoryModel.findById(options.storyId);
      if (!story) {
        throw new Error('Story not found');
      }

      const plan = await StoryPlanModel.findByStoryId(options.storyId);
      if (!plan || !plan.approved) {
        throw new Error('Story plan not found or not approved');
      }

      // Validate story is ready for generation
      await this.validatePreGeneration(story, plan);

      // Set story status to generating
      await StoryModel.updateStatus(options.storyId, 'generating');

      // Load characters for context
      const characters = await CharacterModel.findByStoryId(options.storyId);

      // Generate chapters
      const result = await this.generateChapters(story, plan, characters, options, progress);

      // Validate generated content
      this.updateProgress(progress, 'validating', 90, 'Validating generated content...');
      const validationResult = await this.validator.validateStory(options.storyId);

      // Update story status and metrics
      const finalWordCount = await ChapterModel.getStoryWordCount(options.storyId);
      await StoryModel.update(options.storyId, {
        actualLength: finalWordCount,
        status: result.success ? 'complete' : 'failed',
        qualityScore: result.qualityScore,
      });

      // Complete progress tracking
      this.updateProgress(progress, 'complete', 100, 'Story generation complete');
      this.activeGenerations.delete(options.storyId);

      const totalTime = (Date.now() - startTime.getTime()) / 1000;

      logger.info('Story generation completed', {
        storyId: options.storyId,
        success: result.success,
        chaptersGenerated: result.chaptersGenerated,
        wordCount: finalWordCount,
        generationTime: totalTime
      });

      return {
        ...result,
        totalWordCount: finalWordCount,
        generationTime: totalTime,
        warnings: validationResult.warnings,
      };

    } catch (error) {
      logger.error('Story generation failed', { error, options });
      
      // Update progress with error
      const progress = this.activeGenerations.get(options.storyId);
      if (progress) {
        this.updateProgress(progress, 'error', progress.progress, 'Generation failed', error.message);
      }

      // Update story status
      await StoryModel.updateStatus(options.storyId, 'failed');

      const totalTime = (Date.now() - startTime.getTime()) / 1000;

      return {
        success: false,
        storyId: options.storyId,
        chaptersGenerated: 0,
        totalWordCount: 0,
        generationTime: totalTime,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * Generate single chapter
   */
  async generateChapter(
    storyId: string, 
    chapterNumber: number, 
    aiConfigId?: string,
    customInstructions?: string
  ): Promise<Chapter> {
    logger.info('Generating single chapter', { storyId, chapterNumber });

    const story = await StoryModel.findById(storyId);
    if (!story) {
      throw new Error('Story not found');
    }

    const plan = await StoryPlanModel.findByStoryId(storyId);
    if (!plan) {
      throw new Error('Story plan not found');
    }

    const chapter = await ChapterModel.findByStoryAndNumber(storyId, chapterNumber);
    if (!chapter) {
      throw new Error('Chapter not found in plan');
    }

    const characters = await CharacterModel.findByStoryId(storyId);

    // Generate chapter content
    const generatedChapter = await this.generateSingleChapter(
      story, 
      plan, 
      chapter, 
      characters, 
      aiConfigId,
      customInstructions
    );

    logger.info('Chapter generation completed', {
      storyId,
      chapterNumber,
      wordCount: generatedChapter.wordCount
    });

    return generatedChapter;
  }

  /**
   * Get generation progress
   */
  getProgress(storyId: string): GenerationProgress | null {
    return this.activeGenerations.get(storyId) || null;
  }

  /**
   * Cancel ongoing generation
   */
  async cancelGeneration(storyId: string): Promise<boolean> {
    const progress = this.activeGenerations.get(storyId);
    if (!progress) {
      return false;
    }

    // Update progress to indicate cancellation
    this.updateProgress(progress, 'error', progress.progress, 'Generation cancelled by user');
    this.activeGenerations.delete(storyId);

    // Update story status
    await StoryModel.updateStatus(storyId, 'draft');

    logger.info('Story generation cancelled', { storyId });
    return true;
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(storyId: string, startTime: Date): GenerationProgress {
    return {
      storyId,
      stage: 'planning',
      progress: 0,
      message: 'Initializing story generation...',
      startTime,
    };
  }

  /**
   * Update generation progress
   */
  private updateProgress(
    progress: GenerationProgress, 
    stage: GenerationProgress['stage'],
    percent: number,
    message?: string,
    error?: string
  ): void {
    progress.stage = stage;
    progress.progress = Math.min(percent, 100);
    if (message) progress.message = message;
    if (error) progress.error = error;

    // Estimate completion time based on progress
    if (percent > 0 && stage !== 'complete' && stage !== 'error') {
      const elapsed = Date.now() - progress.startTime.getTime();
      const estimated = (elapsed / percent) * 100;
      progress.estimatedCompletion = new Date(progress.startTime.getTime() + estimated);
    }

    logger.debug('Generation progress updated', {
      storyId: progress.storyId,
      stage,
      progress: percent,
      message
    });
  }

  /**
   * Validate story is ready for generation
   */
  private async validatePreGeneration(story: Story, plan: StoryPlan): Promise<void> {
    if (story.status === 'generating') {
      throw new Error('Story is already being generated');
    }

    if (!plan.approved) {
      throw new Error('Story plan must be approved before generation');
    }

    if (plan.chapterSummaries.length === 0) {
      throw new Error('Story plan has no chapters defined');
    }

    // Validate story has required characters
    const characters = await CharacterModel.findByStoryId(story.id);
    const protagonists = characters.filter(c => c.role === 'protagonist');
    
    if (protagonists.length === 0) {
      throw new Error('Story must have at least one protagonist character');
    }
  }

  /**
   * Generate all chapters in the story
   */
  private async generateChapters(
    story: Story,
    plan: StoryPlan,
    characters: Character[],
    options: GenerationOptions,
    progress: GenerationProgress
  ): Promise<GenerationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let chaptersGenerated = 0;
    let totalQualityScore = 0;

    const startChapter = options.startChapter || 1;
    const endChapter = options.endChapter || plan.totalChapters;

    progress.totalChapters = endChapter - startChapter + 1;

    for (let chapterNum = startChapter; chapterNum <= endChapter; chapterNum++) {
      try {
        progress.currentChapter = chapterNum;
        const progressPercent = ((chapterNum - startChapter) / (endChapter - startChapter + 1)) * 80; // Reserve 20% for validation
        
        this.updateProgress(
          progress,
          'generating',
          progressPercent,
          `Generating chapter ${chapterNum} of ${plan.totalChapters}...`
        );

        // Get or create chapter
        let chapter = await ChapterModel.findByStoryAndNumber(story.id, chapterNum);
        if (!chapter) {
          // Create chapter from plan
          const chapterSummary = plan.chapterSummaries.find(cs => cs.chapterNumber === chapterNum);
          if (!chapterSummary) {
            errors.push(`Chapter ${chapterNum} not found in plan`);
            continue;
          }

          chapter = await ChapterModel.create({
            storyId: story.id,
            chapterNumber: chapterNum,
            title: chapterSummary.title,
            plannedSummary: chapterSummary.summary,
            targetWordCount: chapterSummary.wordCount,
          });
        }

        // Skip if already generated and not regenerating
        if (chapter.status === 'generated' && !options.regenerateExisting) {
          chaptersGenerated++;
          continue;
        }

        // Generate chapter content
        const generatedChapter = await this.generateSingleChapter(
          story,
          plan,
          chapter,
          characters,
          options.aiConfigId,
          options.customInstructions
        );

        chaptersGenerated++;
        
        // Add to quality score calculation
        if (generatedChapter.qualityMetrics?.overallScore) {
          totalQualityScore += generatedChapter.qualityMetrics.overallScore;
        }

      } catch (error) {
        logger.error('Chapter generation failed', { 
          storyId: story.id, 
          chapterNumber: chapterNum, 
          error 
        });

        errors.push(`Chapter ${chapterNum}: ${error.message}`);

        if (options.pauseOnError) {
          break;
        }
      }
    }

    const averageQualityScore = chaptersGenerated > 0 ? totalQualityScore / chaptersGenerated : undefined;

    return {
      success: errors.length === 0,
      storyId: story.id,
      chaptersGenerated,
      totalWordCount: 0, // Will be calculated later
      generationTime: 0, // Will be calculated later
      qualityScore: averageQualityScore,
      errors,
      warnings,
    };
  }

  /**
   * Generate content for a single chapter
   */
  private async generateSingleChapter(
    story: Story,
    plan: StoryPlan,
    chapter: Chapter,
    characters: Character[],
    aiConfigId?: string,
    customInstructions?: string
  ): Promise<Chapter> {
    // Increment generation attempts
    await ChapterModel.incrementGenerationAttempts(chapter.id);

    // Mark chapter as generating
    await ChapterModel.updateStatus(chapter.id, 'generating');

    try {
      // Get chapter context
      const context = await this.buildChapterContext(story, plan, chapter, characters);

      // Get appropriate prompt template
      const template = await PromptTemplateModel.getDefault('chapter_generation');
      if (!template) {
        throw new Error('No chapter generation template found');
      }

      // Build prompt variables
      const variables = {
        storyTitle: story.title,
        storyPremise: story.premise,
        genre: story.genre,
        tone: story.tone || 'engaging',
        writingStyle: story.writingStyle || 'descriptive',
        pov: story.pov || 'Third Limited',
        tense: story.tense || 'Past',
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title || `Chapter ${chapter.chapterNumber}`,
        chapterSummary: chapter.plannedSummary || '',
        targetWordCount: chapter.targetWordCount || 2000,
        characters: characters.map(c => `${c.name} (${c.role}): ${c.description || 'No description'}`).join('\n'),
        previousContext: context.previousContext,
        nextContext: context.nextContext,
        customInstructions: customInstructions || '',
      };

      // Generate content using AI provider
      const content = await this.aiProvider.generateText(
        PromptTemplateModel.interpolateTemplate(template, variables),
        aiConfigId
      );

      // Update chapter with generated content
      const updatedChapter = await ChapterModel.updateContent(chapter.id, content);
      if (!updatedChapter) {
        throw new Error('Failed to update chapter content');
      }

      // Calculate and store quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(updatedChapter, story);
      await ChapterModel.update(chapter.id, { qualityMetrics });

      logger.info('Chapter generated successfully', {
        storyId: story.id,
        chapterNumber: chapter.chapterNumber,
        wordCount: updatedChapter.wordCount,
        qualityScore: qualityMetrics.overallScore
      });

      return { ...updatedChapter, qualityMetrics };

    } catch (error) {
      // Mark chapter as failed
      await ChapterModel.updateStatus(chapter.id, 'failed');
      logger.error('Chapter generation failed', {
        storyId: story.id,
        chapterNumber: chapter.chapterNumber,
        error
      });
      throw error;
    }
  }

  /**
   * Build context for chapter generation
   */
  private async buildChapterContext(
    story: Story,
    plan: StoryPlan,
    chapter: Chapter,
    characters: Character[]
  ): Promise<{
    previousContext: string;
    nextContext: string;
  }> {
    let previousContext = '';
    let nextContext = '';

    // Get previous chapters for context
    if (chapter.chapterNumber > 1) {
      const previousChapters = await ChapterModel.findByStoryId(story.id);
      const prevChapters = previousChapters
        .filter(c => c.chapterNumber < chapter.chapterNumber && c.status === 'generated')
        .sort((a, b) => b.chapterNumber - a.chapterNumber)
        .slice(0, 2); // Last 2 chapters for context

      if (prevChapters.length > 0) {
        previousContext = prevChapters
          .reverse()
          .map(c => `Chapter ${c.chapterNumber}: ${c.content?.substring(0, 500) || c.plannedSummary}...`)
          .join('\n\n');
      }
    }

    // Get upcoming chapter summaries for context
    const upcomingChapters = plan.chapterSummaries
      .filter(cs => cs.chapterNumber > chapter.chapterNumber)
      .slice(0, 2);

    if (upcomingChapters.length > 0) {
      nextContext = upcomingChapters
        .map(cs => `Chapter ${cs.chapterNumber}: ${cs.summary}`)
        .join('\n');
    }

    return { previousContext, nextContext };
  }

  /**
   * Calculate quality metrics for generated chapter
   */
  private async calculateQualityMetrics(chapter: Chapter, story: Story): Promise<any> {
    if (!chapter.content) {
      return { overallScore: 0 };
    }

    // Basic readability metrics
    const sentences = chapter.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = chapter.content.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = chapter.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const avgSentenceLength = words.length / sentences.length;
    const avgWordsPerSentence = avgSentenceLength;
    const avgParagraphLength = words.length / paragraphs.length;

    // Simple dialogue detection
    const dialogueMatches = chapter.content.match(/["'][^"']*["']/g) || [];
    const dialoguePercentage = (dialogueMatches.join(' ').length / chapter.content.length) * 100;

    // Basic quality scoring
    let overallScore = 70; // Base score

    // Adjust for word count vs target
    if (chapter.targetWordCount) {
      const wordCountRatio = chapter.wordCount / chapter.targetWordCount;
      if (wordCountRatio >= 0.8 && wordCountRatio <= 1.2) {
        overallScore += 10;
      } else if (wordCountRatio >= 0.6 && wordCountRatio <= 1.4) {
        overallScore += 5;
      }
    }

    // Adjust for sentence length (prefer 15-25 words per sentence)
    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      overallScore += 5;
    }

    // Adjust for dialogue balance (prefer 10-40% dialogue)
    if (dialoguePercentage >= 10 && dialoguePercentage <= 40) {
      overallScore += 5;
    }

    return {
      readability: {
        fleschKincaidGrade: Math.max(1, Math.min(20, avgSentenceLength * 0.39 + avgWordsPerSentence * 11.8 - 15.59)),
        fleschReadingEase: Math.max(0, Math.min(100, 206.835 - (1.015 * avgSentenceLength) - (84.6 * 1.5))),
        avgSentenceLength,
        avgWordsPerSentence,
      },
      consistency: {
        characterVoiceScore: 75, // Placeholder - would need more sophisticated analysis
        toneConsistencyScore: 80,
        styleConsistencyScore: 78,
      },
      structure: {
        paragraphCount: paragraphs.length,
        avgParagraphLength,
        dialoguePercentage,
        actionPercentage: 100 - dialoguePercentage, // Simplified
      },
      aiMetrics: {
        coherenceScore: 82,
        creativityScore: 76,
        engagementScore: 79,
      },
      overallScore: Math.min(100, Math.max(0, overallScore)),
    };
  }
}