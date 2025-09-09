import { EventEmitter } from 'events';
import { ChapterModel, Chapter } from '../models/chapter.model';
import { StoryModel } from '../models/story.model';
import { CharacterModel } from '../models/character.model';
import { StoryPlanModel } from '../models/story-plan.model';
import { AIProviderManager } from './ai-provider-manager';
import { promptTemplateService } from './prompt-templates';
import { storyValidator } from '../lib/story-validator';
import { logger } from '../config/logger';

export interface GenerationProgress {
  storyId: string;
  currentChapter: number;
  totalChapters: number;
  status: 'starting' | 'planning' | 'generating' | 'validating' | 'completed' | 'error';
  message: string;
  estimatedTimeRemaining?: number;
  generatedContent?: {
    chapterId: string;
    title: string;
    wordCount: number;
  };
  error?: string;
}

export interface ChapterGenerationRequest {
  chapterId: string;
  userId: string;
  contextChapters?: number; // Number of previous chapters to include as context
  regenerate?: boolean; // Whether to regenerate existing content
}

export interface StoryGenerationRequest {
  storyId: string;
  userId: string;
  startFromChapter?: number;
  maxChapters?: number;
  contextChapters?: number;
}

export interface GenerationOptions {
  maxRetries: number;
  qualityThreshold: number;
  parallelGeneration: boolean;
  validateContent: boolean;
  autoRevise: boolean;
}

export class GenerationService extends EventEmitter {
  private aiManager: AIProviderManager;
  private activeGenerations = new Map<string, AbortController>();
  private defaultOptions: GenerationOptions = {
    maxRetries: 3,
    qualityThreshold: 70,
    parallelGeneration: false,
    validateContent: true,
    autoRevise: true
  };

  constructor() {
    super();
    this.aiManager = new AIProviderManager();
    this.setMaxListeners(100); // Allow many concurrent generation sessions
  }

  /**
   * Generate a single chapter
   */
  async generateChapter(request: ChapterGenerationRequest, options: Partial<GenerationOptions> = {}): Promise<Chapter> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Get chapter and verify ownership
      const chapter = await ChapterModel.findById(request.chapterId);
      if (!chapter) {
        throw new Error('Chapter not found');
      }

      const story = await StoryModel.findById(chapter.storyId);
      if (!story || story.userId !== request.userId) {
        throw new Error('Access denied');
      }

      // Check if chapter already generated and not regenerating
      if (chapter.status === 'generated' && !request.regenerate) {
        throw new Error('Chapter already generated. Use regenerate flag to override.');
      }

      // Update chapter status
      await ChapterModel.update(request.chapterId, { 
        status: 'generating',
        generationAttempts: chapter.generationAttempts + 1
      });

      let attempts = 0;
      let bestResult: any = null;
      let bestScore = 0;

      while (attempts < opts.maxRetries) {
        attempts++;

        try {
          logger.info('Generating chapter content', {
            chapterId: request.chapterId,
            storyId: chapter.storyId,
            attempt: attempts
          });

          // Build context for chapter generation
          const context = await this.buildChapterContext(
            chapter.storyId, 
            chapter.chapterNumber,
            request.contextChapters || 3
          );

          // Get chapter generation template
          const template = await promptTemplateService.getTemplate('chapter_generation', request.userId);
          if (!template) {
            throw new Error('Chapter generation template not found');
          }

          // Interpolate template with context
          const prompt = await promptTemplateService.interpolateTemplate(template.content, {
            ...context,
            chapterTitle: chapter.title,
            chapterSummary: chapter.summary,
            keyEvents: chapter.keyEvents.join(', '),
            characterFocus: context.focusCharacters?.map(c => c.name).join(', ') || '',
            targetWordCount: chapter.plannedWordCount.toString()
          });

          // Generate content
          const response = await this.aiManager.generateText(prompt, undefined, request.userId);

          // Parse and validate the generated content
          const generatedContent = this.parseChapterContent(response.content);
          
          let qualityScore = 100; // Default score if validation disabled

          if (opts.validateContent) {
            // Validate content quality
            const validation = await storyValidator.validateChapter({
              content: generatedContent.content,
              title: generatedContent.title || chapter.title,
              summary: chapter.summary,
              keyEvents: chapter.keyEvents,
              characters: context.focusCharacters || [],
              previousChapters: context.previousChapters || [],
              storyContext: context.story
            });

            qualityScore = validation.overallScore;

            if (qualityScore < opts.qualityThreshold && attempts < opts.maxRetries) {
              logger.warn('Generated chapter quality below threshold', {
                chapterId: request.chapterId,
                score: qualityScore,
                threshold: opts.qualityThreshold,
                attempt: attempts
              });

              if (qualityScore > bestScore) {
                bestResult = { generatedContent, response, qualityScore, validation };
                bestScore = qualityScore;
              }

              continue; // Try again
            }
          }

          // Update chapter with generated content
          const updatedChapter = await ChapterModel.update(request.chapterId, {
            status: 'generated',
            content: generatedContent.content,
            wordCount: this.countWords(generatedContent.content),
            generatedBy: response.provider,
            generationModel: response.model,
            generationCost: response.cost || 0,
            generationTokens: response.usage.totalTokens,
            qualityScore,
            generatedAt: new Date()
          });

          if (!updatedChapter) {
            throw new Error('Failed to update chapter');
          }

          logger.info('Chapter generated successfully', {
            chapterId: request.chapterId,
            wordCount: updatedChapter.wordCount,
            qualityScore,
            provider: response.provider,
            cost: response.cost
          });

          return updatedChapter;

        } catch (error) {
          logger.warn('Chapter generation attempt failed', {
            chapterId: request.chapterId,
            attempt: attempts,
            error: error.message
          });

          if (attempts >= opts.maxRetries) {
            throw error;
          }
        }
      }

      // If all attempts failed but we have a best result, use it
      if (bestResult && bestScore > 30) { // Minimum acceptable score
        const { generatedContent, response, qualityScore } = bestResult;

        const updatedChapter = await ChapterModel.update(request.chapterId, {
          status: 'generated',
          content: generatedContent.content,
          wordCount: this.countWords(generatedContent.content),
          generatedBy: response.provider,
          generationModel: response.model,
          generationCost: response.cost || 0,
          generationTokens: response.usage.totalTokens,
          qualityScore,
          generatedAt: new Date()
        });

        logger.warn('Using best result after all retries', {
          chapterId: request.chapterId,
          qualityScore: bestScore,
          attempts
        });

        return updatedChapter!;
      }

      // Mark chapter as failed
      await ChapterModel.update(request.chapterId, { status: 'failed' });
      throw new Error('All generation attempts failed');

    } catch (error) {
      logger.error('Chapter generation failed', {
        chapterId: request.chapterId,
        error
      });

      await ChapterModel.update(request.chapterId, { status: 'failed' });
      throw error;
    }
  }

  /**
   * Generate entire story or continue from specific chapter
   */
  async generateStory(request: StoryGenerationRequest, options: Partial<GenerationOptions> = {}): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };
    const abortController = new AbortController();
    this.activeGenerations.set(request.storyId, abortController);

    try {
      // Verify story access
      const story = await StoryModel.findById(request.storyId);
      if (!story || story.userId !== request.userId) {
        throw new Error('Story not found or access denied');
      }

      // Get chapters to generate
      const allChapters = await ChapterModel.findByStoryId(request.storyId);
      const startChapter = request.startFromChapter || 1;
      const maxChapters = request.maxChapters || allChapters.length;

      const chaptersToGenerate = allChapters
        .filter(chapter => 
          chapter.chapterNumber >= startChapter && 
          chapter.chapterNumber <= startChapter + maxChapters - 1 &&
          chapter.status !== 'generated'
        )
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

      if (chaptersToGenerate.length === 0) {
        this.emitProgress(request.storyId, {
          storyId: request.storyId,
          currentChapter: 0,
          totalChapters: 0,
          status: 'completed',
          message: 'No chapters to generate'
        });
        return;
      }

      // Update story status
      await StoryModel.update(request.storyId, { status: 'generating' });

      this.emitProgress(request.storyId, {
        storyId: request.storyId,
        currentChapter: 0,
        totalChapters: chaptersToGenerate.length,
        status: 'starting',
        message: `Starting generation of ${chaptersToGenerate.length} chapters`
      });

      const startTime = Date.now();

      // Generate chapters
      if (opts.parallelGeneration && chaptersToGenerate.length > 1) {
        // Parallel generation (for independent chapters)
        await this.generateChaptersParallel(chaptersToGenerate, request, opts);
      } else {
        // Sequential generation (maintains narrative flow)
        await this.generateChaptersSequential(chaptersToGenerate, request, opts);
      }

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Generation aborted by user');
      }

      // Update story status
      const allChaptersComplete = allChapters.every(c => c.status === 'generated');
      const newStatus = allChaptersComplete ? 'generated' : 'generating';
      await StoryModel.update(request.storyId, { status: newStatus });

      const duration = Date.now() - startTime;

      this.emitProgress(request.storyId, {
        storyId: request.storyId,
        currentChapter: chaptersToGenerate.length,
        totalChapters: chaptersToGenerate.length,
        status: 'completed',
        message: `Story generation completed in ${Math.round(duration / 1000)}s`
      });

      logger.info('Story generation completed', {
        storyId: request.storyId,
        chaptersGenerated: chaptersToGenerate.length,
        duration
      });

    } catch (error) {
      logger.error('Story generation failed', {
        storyId: request.storyId,
        error
      });

      this.emitProgress(request.storyId, {
        storyId: request.storyId,
        currentChapter: 0,
        totalChapters: 0,
        status: 'error',
        message: 'Generation failed',
        error: error.message
      });

      throw error;

    } finally {
      this.activeGenerations.delete(request.storyId);
    }
  }

  /**
   * Abort ongoing story generation
   */
  async abortGeneration(storyId: string): Promise<void> {
    const controller = this.activeGenerations.get(storyId);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(storyId);

      this.emitProgress(storyId, {
        storyId,
        currentChapter: 0,
        totalChapters: 0,
        status: 'error',
        message: 'Generation aborted by user'
      });

      logger.info('Story generation aborted', { storyId });
    }
  }

  /**
   * Get generation status for a story
   */
  async getGenerationStatus(storyId: string): Promise<{
    isGenerating: boolean;
    progress?: GenerationProgress;
  }> {
    const isGenerating = this.activeGenerations.has(storyId);
    return { isGenerating };
  }

  /**
   * Revise chapter content based on feedback
   */
  async reviseChapter(
    chapterId: string, 
    userId: string, 
    feedback: string,
    options: Partial<GenerationOptions> = {}
  ): Promise<Chapter> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Get chapter and verify ownership
      const chapter = await ChapterModel.findById(chapterId);
      if (!chapter) {
        throw new Error('Chapter not found');
      }

      const story = await StoryModel.findById(chapter.storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Access denied');
      }

      if (chapter.status !== 'generated') {
        throw new Error('Can only revise generated chapters');
      }

      // Get revision template
      const template = await promptTemplateService.getTemplate('chapter_revision', userId);
      if (!template) {
        throw new Error('Chapter revision template not found');
      }

      // Build context
      const context = await this.buildChapterContext(chapter.storyId, chapter.chapterNumber, 2);

      // Generate revision prompt
      const prompt = await promptTemplateService.interpolateTemplate(template.content, {
        originalContent: chapter.content,
        feedback,
        chapterTitle: chapter.title,
        chapterSummary: chapter.summary,
        ...context
      });

      // Generate revised content
      const response = await this.aiManager.generateText(prompt, undefined, userId);
      const revisedContent = this.parseChapterContent(response.content);

      // Update chapter
      const updatedChapter = await ChapterModel.update(chapterId, {
        content: revisedContent.content,
        wordCount: this.countWords(revisedContent.content),
        generatedBy: response.provider,
        generationModel: response.model,
        generationCost: (chapter.generationCost || 0) + (response.cost || 0),
        generationTokens: (chapter.generationTokens || 0) + response.usage.totalTokens,
        revisedAt: new Date(),
        revisionCount: (chapter.revisionCount || 0) + 1
      });

      logger.info('Chapter revised', {
        chapterId,
        wordCount: updatedChapter?.wordCount,
        revisionCount: updatedChapter?.revisionCount
      });

      return updatedChapter!;

    } catch (error) {
      logger.error('Chapter revision failed', { chapterId, error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async generateChaptersSequential(
    chapters: Chapter[], 
    request: StoryGenerationRequest,
    options: GenerationOptions
  ): Promise<void> {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      
      // Check if aborted
      const controller = this.activeGenerations.get(request.storyId);
      if (controller?.signal.aborted) {
        throw new Error('Generation aborted');
      }

      this.emitProgress(request.storyId, {
        storyId: request.storyId,
        currentChapter: i + 1,
        totalChapters: chapters.length,
        status: 'generating',
        message: `Generating chapter ${chapter.chapterNumber}: ${chapter.title}`,
        estimatedTimeRemaining: this.estimateRemainingTime(i, chapters.length)
      });

      try {
        const generatedChapter = await this.generateChapter({
          chapterId: chapter.id,
          userId: request.userId,
          contextChapters: request.contextChapters
        }, options);

        this.emitProgress(request.storyId, {
          storyId: request.storyId,
          currentChapter: i + 1,
          totalChapters: chapters.length,
          status: 'generating',
          message: `Completed chapter ${chapter.chapterNumber}`,
          generatedContent: {
            chapterId: chapter.id,
            title: chapter.title,
            wordCount: generatedChapter.wordCount
          }
        });

      } catch (error) {
        logger.error('Chapter generation failed in sequence', {
          storyId: request.storyId,
          chapterId: chapter.id,
          error
        });
        
        // Continue with next chapter unless it's critical
        if (!error.message.includes('aborted')) {
          continue;
        } else {
          throw error;
        }
      }
    }
  }

  private async generateChaptersParallel(
    chapters: Chapter[],
    request: StoryGenerationRequest,
    options: GenerationOptions
  ): Promise<void> {
    const maxConcurrent = 3; // Limit concurrent generations
    const batches = this.chunkArray(chapters, maxConcurrent);

    for (const batch of batches) {
      const promises = batch.map(chapter => 
        this.generateChapter({
          chapterId: chapter.id,
          userId: request.userId,
          contextChapters: request.contextChapters
        }, options).catch(error => {
          logger.error('Parallel chapter generation failed', {
            chapterId: chapter.id,
            error
          });
          return null;
        })
      );

      await Promise.allSettled(promises);

      // Check if aborted
      const controller = this.activeGenerations.get(request.storyId);
      if (controller?.signal.aborted) {
        throw new Error('Generation aborted');
      }
    }
  }

  private async buildChapterContext(storyId: string, chapterNumber: number, contextChapters: number = 3): Promise<any> {
    const [story, plan, allChapters, characters] = await Promise.all([
      StoryModel.findById(storyId),
      StoryPlanModel.findByStoryId(storyId),
      ChapterModel.findByStoryId(storyId),
      CharacterModel.findByStoryId(storyId)
    ]);

    // Get previous chapters for context
    const previousChapters = allChapters
      .filter(c => c.chapterNumber < chapterNumber && c.content)
      .sort((a, b) => b.chapterNumber - a.chapterNumber)
      .slice(0, contextChapters)
      .reverse();

    // Get characters that appear in this chapter
    const currentChapter = allChapters.find(c => c.chapterNumber === chapterNumber);
    const focusCharacters = characters.filter(char => 
      currentChapter?.characterFocus.includes(char.id)
    );

    return {
      story: {
        title: story?.title,
        description: story?.description,
        genre: story?.genre,
        setting: story?.setting,
        style: story?.style,
        themes: story?.themes
      },
      plan: plan?.structure,
      previousChapters: previousChapters.map(chapter => ({
        number: chapter.chapterNumber,
        title: chapter.title,
        summary: chapter.summary,
        content: chapter.content?.substring(0, 1000) + '...' // Truncate for context
      })),
      focusCharacters: focusCharacters.map(char => ({
        name: char.name,
        role: char.role,
        description: char.description,
        traits: char.traits,
        currentGoals: char.goals,
        relationships: char.relationships
      })),
      allCharacters: characters.map(char => ({
        name: char.name,
        role: char.role,
        description: char.description
      }))
    };
  }

  private parseChapterContent(generatedText: string): { title?: string; content: string } {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(generatedText);
      if (parsed.content) {
        return {
          title: parsed.title,
          content: parsed.content
        };
      }
    } catch {
      // Not JSON, treat as plain text
    }

    // Look for title in markdown format
    const lines = generatedText.split('\n');
    const titleMatch = lines[0].match(/^#\s*(.+)$/);
    
    if (titleMatch) {
      return {
        title: titleMatch[1].trim(),
        content: lines.slice(1).join('\n').trim()
      };
    }

    return { content: generatedText.trim() };
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private estimateRemainingTime(completed: number, total: number): number {
    // Simple estimation based on average chapter generation time
    const avgTimePerChapter = 60000; // 1 minute per chapter
    return (total - completed) * avgTimePerChapter;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private emitProgress(storyId: string, progress: GenerationProgress): void {
    this.emit('progress', progress);
    this.emit(`progress:${storyId}`, progress);
  }
}

export const generationService = new GenerationService();