import { logger } from '../../config/logger';
import { StoryModel, Story } from '../../models/story.model';
import { StoryPlanModel, StoryPlan } from '../../models/story-plan.model';
import { ChapterModel, Chapter } from '../../models/chapter.model';
import { CharacterModel, Character } from '../../models/character.model';

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  type: 'critical' | 'major' | 'minor';
  category: 'structure' | 'consistency' | 'content' | 'character' | 'plot';
  message: string;
  location?: {
    chapter?: number;
    character?: string;
  };
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'style' | 'pacing' | 'character' | 'plot' | 'quality';
  message: string;
  location?: {
    chapter?: number;
    character?: string;
  };
  suggestion?: string;
}

export interface ConsistencyCheck {
  characterNames: boolean;
  characterTraits: boolean;
  plotContinuity: boolean;
  toneConsistency: boolean;
  povConsistency: boolean;
  tenseConsistency: boolean;
}

export class StoryValidator {
  /**
   * Validate complete story
   */
  async validateStory(storyId: string): Promise<ValidationResult> {
    logger.info('Starting story validation', { storyId });

    try {
      // Load story data
      const [story, plan, chapters, characters] = await Promise.all([
        StoryModel.findById(storyId),
        StoryPlanModel.findByStoryId(storyId),
        ChapterModel.findByStoryId(storyId),
        CharacterModel.findByStoryId(storyId),
      ]);

      if (!story) {
        throw new Error('Story not found');
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: string[] = [];

      // Structure validation
      const structureResults = await this.validateStructure(story, plan, chapters);
      errors.push(...structureResults.errors);
      warnings.push(...structureResults.warnings);

      // Character validation
      const characterResults = await this.validateCharacters(characters, chapters);
      errors.push(...characterResults.errors);
      warnings.push(...characterResults.warnings);

      // Consistency validation
      const consistencyResults = await this.validateConsistency(story, chapters, characters);
      errors.push(...consistencyResults.errors);
      warnings.push(...consistencyResults.warnings);

      // Content quality validation
      const qualityResults = await this.validateContentQuality(story, chapters);
      errors.push(...qualityResults.errors);
      warnings.push(...qualityResults.warnings);

      // Plot validation
      const plotResults = await this.validatePlot(story, plan, chapters);
      errors.push(...plotResults.errors);
      warnings.push(...plotResults.warnings);

      // Calculate overall score
      const score = this.calculateValidationScore(errors, warnings);

      // Generate suggestions
      suggestions.push(...this.generateSuggestions(errors, warnings, story, chapters));

      const valid = errors.filter(e => e.type === 'critical').length === 0;

      logger.info('Story validation completed', {
        storyId,
        valid,
        score,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return {
        valid,
        score,
        errors,
        warnings,
        suggestions,
      };

    } catch (error) {
      logger.error('Story validation failed', { error, storyId });
      throw error;
    }
  }

  /**
   * Validate chapter individually
   */
  async validateChapter(chapterId: string): Promise<ValidationResult> {
    try {
      const chapter = await ChapterModel.findById(chapterId);
      if (!chapter) {
        throw new Error('Chapter not found');
      }

      const story = await StoryModel.findById(chapter.storyId);
      if (!story) {
        throw new Error('Parent story not found');
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: string[] = [];

      // Basic chapter validation
      if (!chapter.content || chapter.content.trim().length === 0) {
        errors.push({
          type: 'critical',
          category: 'content',
          message: 'Chapter has no content',
          location: { chapter: chapter.chapterNumber },
        });
      }

      // Word count validation
      if (chapter.targetWordCount && chapter.wordCount) {
        const variance = Math.abs(chapter.wordCount - chapter.targetWordCount) / chapter.targetWordCount;
        if (variance > 0.5) { // More than 50% variance
          warnings.push({
            type: 'quality',
            message: `Chapter word count significantly different from target (${chapter.wordCount} vs ${chapter.targetWordCount})`,
            location: { chapter: chapter.chapterNumber },
            suggestion: 'Consider adjusting content length to match target word count',
          });
        }
      }

      // Content quality checks
      if (chapter.content) {
        const contentWarnings = this.validateChapterContent(chapter, story);
        warnings.push(...contentWarnings);
      }

      const score = this.calculateValidationScore(errors, warnings);
      const valid = errors.filter(e => e.type === 'critical').length === 0;

      return {
        valid,
        score,
        errors,
        warnings,
        suggestions,
      };

    } catch (error) {
      logger.error('Chapter validation failed', { error, chapterId });
      throw error;
    }
  }

  /**
   * Check story consistency
   */
  async checkConsistency(storyId: string): Promise<ConsistencyCheck> {
    try {
      const [story, chapters, characters] = await Promise.all([
        StoryModel.findById(storyId),
        ChapterModel.findByStoryId(storyId),
        CharacterModel.findByStoryId(storyId),
      ]);

      if (!story) {
        throw new Error('Story not found');
      }

      return {
        characterNames: this.checkCharacterNameConsistency(characters, chapters),
        characterTraits: this.checkCharacterTraitConsistency(characters, chapters),
        plotContinuity: this.checkPlotContinuity(chapters),
        toneConsistency: this.checkToneConsistency(story, chapters),
        povConsistency: this.checkPOVConsistency(story, chapters),
        tenseConsistency: this.checkTenseConsistency(story, chapters),
      };

    } catch (error) {
      logger.error('Consistency check failed', { error, storyId });
      throw error;
    }
  }

  /**
   * Validate story structure
   */
  private async validateStructure(
    story: Story,
    plan: StoryPlan | null,
    chapters: Chapter[]
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check chapter sequence
    const chapterNumbers = chapters.map(c => c.chapterNumber).sort((a, b) => a - b);
    for (let i = 0; i < chapterNumbers.length; i++) {
      if (chapterNumbers[i] !== i + 1) {
        errors.push({
          type: 'major',
          category: 'structure',
          message: `Missing or duplicate chapter ${i + 1}`,
          suggestion: 'Ensure all chapters are numbered sequentially starting from 1',
        });
      }
    }

    // Check if story has content
    const generatedChapters = chapters.filter(c => c.status === 'generated' && c.content);
    if (generatedChapters.length === 0) {
      errors.push({
        type: 'critical',
        category: 'content',
        message: 'Story has no generated content',
        suggestion: 'Generate at least one chapter to validate story content',
      });
    }

    // Check story length vs target
    if (story.actualLength && story.targetLength) {
      const lengthRatio = story.actualLength / story.targetLength;
      if (lengthRatio < 0.5) {
        warnings.push({
          type: 'quality',
          message: `Story is significantly shorter than target (${story.actualLength} vs ${story.targetLength} words)`,
          suggestion: 'Consider adding more content or adjusting target length',
        });
      } else if (lengthRatio > 2.0) {
        warnings.push({
          type: 'quality',
          message: `Story is significantly longer than target (${story.actualLength} vs ${story.targetLength} words)`,
          suggestion: 'Consider editing content or adjusting target length',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate characters
   */
  private async validateCharacters(
    characters: Character[],
    chapters: Chapter[]
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for protagonist
    const protagonists = characters.filter(c => c.role === 'protagonist');
    if (protagonists.length === 0) {
      errors.push({
        type: 'critical',
        category: 'character',
        message: 'Story has no protagonist character',
        suggestion: 'Add at least one protagonist character',
      });
    }

    // Check character development
    characters.forEach(character => {
      if (!character.description) {
        warnings.push({
          type: 'character',
          message: `Character "${character.name}" has no description`,
          location: { character: character.name },
          suggestion: 'Add character description for better story consistency',
        });
      }

      if (character.role === 'protagonist' && !character.goal) {
        warnings.push({
          type: 'character',
          message: `Protagonist "${character.name}" has no defined goal`,
          location: { character: character.name },
          suggestion: 'Define character goals to strengthen story motivation',
        });
      }
    });

    // Check character appearances in chapters
    const generatedChapters = chapters.filter(c => c.content);
    characters.forEach(character => {
      const appearances = generatedChapters.filter(chapter => 
        chapter.content?.toLowerCase().includes(character.name.toLowerCase())
      );

      if (character.role === 'protagonist' && appearances.length === 0) {
        warnings.push({
          type: 'character',
          message: `Protagonist "${character.name}" doesn't appear in any generated chapters`,
          location: { character: character.name },
          suggestion: 'Ensure main characters appear throughout the story',
        });
      }

      if (character.role === 'minor' && appearances.length > generatedChapters.length * 0.8) {
        warnings.push({
          type: 'character',
          message: `Minor character "${character.name}" appears in most chapters`,
          location: { character: character.name },
          suggestion: 'Consider adjusting character role or reducing appearances',
        });
      }
    });

    return { errors, warnings };
  }

  /**
   * Validate consistency
   */
  private async validateConsistency(
    story: Story,
    chapters: Chapter[],
    characters: Character[]
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const generatedChapters = chapters.filter(c => c.content);

    // POV consistency
    if (story.pov && generatedChapters.length > 1) {
      const povIssues = this.detectPOVInconsistencies(story.pov, generatedChapters);
      warnings.push(...povIssues);
    }

    // Tense consistency
    if (story.tense && generatedChapters.length > 1) {
      const tenseIssues = this.detectTenseInconsistencies(story.tense, generatedChapters);
      warnings.push(...tenseIssues);
    }

    // Character name consistency
    const nameIssues = this.detectCharacterNameInconsistencies(characters, generatedChapters);
    errors.push(...nameIssues);

    return { errors, warnings };
  }

  /**
   * Validate content quality
   */
  private async validateContentQuality(
    story: Story,
    chapters: Chapter[]
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const generatedChapters = chapters.filter(c => c.content);

    generatedChapters.forEach(chapter => {
      if (!chapter.content) return;

      // Check for very short chapters
      if (chapter.wordCount < 500) {
        warnings.push({
          type: 'quality',
          message: `Chapter ${chapter.chapterNumber} is very short (${chapter.wordCount} words)`,
          location: { chapter: chapter.chapterNumber },
          suggestion: 'Consider expanding chapter content for better pacing',
        });
      }

      // Check for repetitive content
      const repetitionIssues = this.detectRepetitiveContent(chapter.content);
      if (repetitionIssues.length > 0) {
        warnings.push({
          type: 'quality',
          message: `Chapter ${chapter.chapterNumber} has repetitive content`,
          location: { chapter: chapter.chapterNumber },
          suggestion: 'Review and vary word choice and sentence structure',
        });
      }

      // Check dialogue balance
      const dialogueBalance = this.analyzeDialogueBalance(chapter.content);
      if (dialogueBalance < 0.05) { // Less than 5% dialogue
        warnings.push({
          type: 'style',
          message: `Chapter ${chapter.chapterNumber} has very little dialogue`,
          location: { chapter: chapter.chapterNumber },
          suggestion: 'Consider adding character interactions and dialogue',
        });
      } else if (dialogueBalance > 0.8) { // More than 80% dialogue
        warnings.push({
          type: 'style',
          message: `Chapter ${chapter.chapterNumber} is mostly dialogue`,
          location: { chapter: chapter.chapterNumber },
          suggestion: 'Consider adding more narrative description and action',
        });
      }
    });

    return { errors, warnings };
  }

  /**
   * Validate plot
   */
  private async validatePlot(
    story: Story,
    plan: StoryPlan | null,
    chapters: Chapter[]
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const generatedChapters = chapters
      .filter(c => c.content)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (generatedChapters.length === 0) {
      return { errors, warnings };
    }

    // Check story beginning
    const firstChapter = generatedChapters[0];
    if (firstChapter && !this.hasStrongOpening(firstChapter.content)) {
      warnings.push({
        type: 'plot',
        message: 'Story opening could be more engaging',
        location: { chapter: 1 },
        suggestion: 'Consider starting with action, dialogue, or an intriguing situation',
      });
    }

    // Check story progression
    if (generatedChapters.length >= 3) {
      const progressionIssues = this.analyzeStoryProgression(generatedChapters);
      warnings.push(...progressionIssues);
    }

    // Check for plot resolution (if story is complete)
    if (story.status === 'complete' && generatedChapters.length > 0) {
      const lastChapter = generatedChapters[generatedChapters.length - 1];
      if (!this.hasResolution(lastChapter.content)) {
        warnings.push({
          type: 'plot',
          message: 'Story ending may lack proper resolution',
          location: { chapter: lastChapter.chapterNumber },
          suggestion: 'Ensure main conflicts are resolved and loose ends are tied up',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Calculate validation score
   */
  private calculateValidationScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;

    // Deduct points for errors
    errors.forEach(error => {
      switch (error.type) {
        case 'critical':
          score -= 20;
          break;
        case 'major':
          score -= 10;
          break;
        case 'minor':
          score -= 5;
          break;
      }
    });

    // Deduct points for warnings
    warnings.forEach(warning => {
      switch (warning.type) {
        case 'quality':
          score -= 3;
          break;
        case 'style':
        case 'character':
        case 'plot':
          score -= 2;
          break;
        case 'pacing':
          score -= 1;
          break;
      }
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    story: Story,
    chapters: Chapter[]
  ): string[] {
    const suggestions: string[] = [];

    // Critical issues first
    const criticalErrors = errors.filter(e => e.type === 'critical');
    if (criticalErrors.length > 0) {
      suggestions.push('Address critical errors before publishing or sharing the story');
    }

    // Specific suggestions based on common issues
    const structureErrors = errors.filter(e => e.category === 'structure');
    if (structureErrors.length > 0) {
      suggestions.push('Review story structure and ensure proper chapter organization');
    }

    const characterWarnings = warnings.filter(w => w.type === 'character');
    if (characterWarnings.length >= 3) {
      suggestions.push('Focus on character development and consistency across chapters');
    }

    const qualityWarnings = warnings.filter(w => w.type === 'quality');
    if (qualityWarnings.length >= 2) {
      suggestions.push('Consider revising chapters for improved content quality and pacing');
    }

    // Length-based suggestions
    const generatedChapters = chapters.filter(c => c.content);
    if (generatedChapters.length > 0) {
      const avgChapterLength = generatedChapters.reduce((sum, ch) => sum + ch.wordCount, 0) / generatedChapters.length;
      
      if (avgChapterLength < 1000) {
        suggestions.push('Consider expanding chapters for better story depth and pacing');
      } else if (avgChapterLength > 5000) {
        suggestions.push('Consider breaking longer chapters into smaller, more digestible sections');
      }
    }

    return suggestions;
  }

  // Helper methods for consistency checks
  private checkCharacterNameConsistency(characters: Character[], chapters: Chapter[]): boolean {
    // Implementation for character name consistency check
    return true; // Simplified
  }

  private checkCharacterTraitConsistency(characters: Character[], chapters: Chapter[]): boolean {
    // Implementation for character trait consistency check
    return true; // Simplified
  }

  private checkPlotContinuity(chapters: Chapter[]): boolean {
    // Implementation for plot continuity check
    return true; // Simplified
  }

  private checkToneConsistency(story: Story, chapters: Chapter[]): boolean {
    // Implementation for tone consistency check
    return true; // Simplified
  }

  private checkPOVConsistency(story: Story, chapters: Chapter[]): boolean {
    // Implementation for POV consistency check
    return true; // Simplified
  }

  private checkTenseConsistency(story: Story, chapters: Chapter[]): boolean {
    // Implementation for tense consistency check
    return true; // Simplified
  }

  private validateChapterContent(chapter: Chapter, story: Story): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    
    if (!chapter.content) return warnings;

    // Basic content validation
    const sentences = chapter.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = chapter.content.split(' ').length / sentences.length;

    if (avgSentenceLength > 30) {
      warnings.push({
        type: 'style',
        message: `Chapter ${chapter.chapterNumber} has very long sentences`,
        location: { chapter: chapter.chapterNumber },
        suggestion: 'Consider breaking up long sentences for better readability',
      });
    }

    return warnings;
  }

  // Additional helper methods (simplified implementations)
  private detectPOVInconsistencies(expectedPOV: string, chapters: Chapter[]): ValidationWarning[] {
    return []; // Simplified
  }

  private detectTenseInconsistencies(expectedTense: string, chapters: Chapter[]): ValidationWarning[] {
    return []; // Simplified
  }

  private detectCharacterNameInconsistencies(characters: Character[], chapters: Chapter[]): ValidationError[] {
    return []; // Simplified
  }

  private detectRepetitiveContent(content: string): string[] {
    return []; // Simplified
  }

  private analyzeDialogueBalance(content: string): number {
    const dialogueMatches = content.match(/["'][^"']*["']/g) || [];
    return dialogueMatches.join(' ').length / content.length;
  }

  private hasStrongOpening(content: string): boolean {
    // Simple check for engaging opening
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.length > 100; // Simplified
  }

  private analyzeStoryProgression(chapters: Chapter[]): ValidationWarning[] {
    return []; // Simplified
  }

  private hasResolution(content: string): boolean {
    // Simple check for resolution keywords
    const resolutionKeywords = ['ended', 'finished', 'resolved', 'finally', 'conclusion', 'last'];
    const lowerContent = content.toLowerCase();
    return resolutionKeywords.some(keyword => lowerContent.includes(keyword));
  }
}