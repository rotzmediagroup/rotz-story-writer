import { StoryModel, CreateStoryData, Story, StoryGenre, StoryStatus } from '../models/story.model';
import { StoryPlanModel, CreateStoryPlanData } from '../models/story-plan.model';
import { ChapterModel } from '../models/chapter.model';
import { CharacterModel } from '../models/character.model';
import { ExportModel, ExportFormat } from '../models/export.model';
import { logger } from '../config/logger';
import { userService } from './user.service';

export interface StoryListOptions {
  userId?: string;
  status?: StoryStatus;
  genre?: StoryGenre;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'wordCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface StoryWithDetails extends Story {
  plan?: any;
  chapters: Array<{
    id: string;
    title: string;
    chapterNumber: number;
    status: string;
    wordCount: number;
    createdAt: Date;
  }>;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    prominence: number;
  }>;
  statistics: {
    totalChapters: number;
    completedChapters: number;
    totalWordCount: number;
    averageChapterLength: number;
    progressPercentage: number;
  };
}

export interface CreateStoryRequest {
  title: string;
  description: string;
  genre: StoryGenre;
  targetWordCount?: number;
  targetChapters?: number;
  setting?: string;
  style?: string;
  themes?: string[];
}

export interface UpdateStoryRequest {
  title?: string;
  description?: string;
  genre?: StoryGenre;
  targetWordCount?: number;
  targetChapters?: number;
  setting?: string;
  style?: string;
  themes?: string[];
  status?: StoryStatus;
}

export interface GenerateStoryPlanRequest {
  title: string;
  description: string;
  genre: StoryGenre;
  targetChapters: number;
  setting?: string;
  style?: string;
  themes?: string[];
}

export class StoryService {
  
  /**
   * Create a new story
   */
  async createStory(userId: string, storyData: CreateStoryRequest): Promise<string> {
    try {
      // Check subscription limits
      const limitCheck = await userService.checkSubscriptionLimits(userId, 'create_story');
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason);
      }

      // Validate story data
      this.validateStoryData(storyData);

      // Create story
      const createData: CreateStoryData = {
        ...storyData,
        userId,
        status: 'planning'
      };

      const storyId = await StoryModel.create(createData);

      logger.info('Story created', {
        userId,
        storyId,
        title: storyData.title,
        genre: storyData.genre
      });

      return storyId;

    } catch (error) {
      logger.error('Failed to create story', { error, userId });
      throw error;
    }
  }

  /**
   * Get story by ID with full details
   */
  async getStoryById(storyId: string, userId?: string): Promise<StoryWithDetails | null> {
    try {
      const story = await StoryModel.findById(storyId);
      if (!story) {
        return null;
      }

      // Check ownership if userId provided
      if (userId && story.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get story plan
      const plan = await StoryPlanModel.findByStoryId(storyId);

      // Get chapters with basic info
      const chapters = await ChapterModel.findByStoryId(storyId);

      // Get characters
      const characters = await CharacterModel.findByStoryId(storyId);

      // Calculate statistics
      const statistics = this.calculateStoryStatistics(story, chapters);

      const storyWithDetails: StoryWithDetails = {
        ...story,
        plan: plan?.structure,
        chapters: chapters.map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          chapterNumber: chapter.chapterNumber,
          status: chapter.status,
          wordCount: chapter.wordCount,
          createdAt: chapter.createdAt
        })),
        characters: characters.map(character => ({
          id: character.id,
          name: character.name,
          role: character.role,
          prominence: character.prominence
        })),
        statistics
      };

      return storyWithDetails;

    } catch (error) {
      logger.error('Failed to get story', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Get list of stories with filtering and pagination
   */
  async getStories(options: StoryListOptions = {}): Promise<{
    stories: Story[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 20,
        offset = 0,
        ...filters
      } = options;

      const { stories, total } = await StoryModel.findWithFilters(filters, {
        limit,
        offset,
        sortBy: options.sortBy || 'updatedAt',
        sortOrder: options.sortOrder || 'desc'
      });

      const hasMore = offset + stories.length < total;

      return {
        stories,
        total,
        hasMore
      };

    } catch (error) {
      logger.error('Failed to get stories', { error, options });
      throw error;
    }
  }

  /**
   * Update story
   */
  async updateStory(storyId: string, userId: string, updates: UpdateStoryRequest): Promise<Story> {
    try {
      // Verify ownership
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      // Validate updates
      if (updates.genre && !this.isValidGenre(updates.genre)) {
        throw new Error('Invalid genre');
      }

      if (updates.status && !this.isValidStatusTransition(story.status, updates.status)) {
        throw new Error(`Cannot change status from ${story.status} to ${updates.status}`);
      }

      const updatedStory = await StoryModel.update(storyId, updates);
      if (!updatedStory) {
        throw new Error('Failed to update story');
      }

      logger.info('Story updated', {
        userId,
        storyId,
        updates: Object.keys(updates)
      });

      return updatedStory;

    } catch (error) {
      logger.error('Failed to update story', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Delete story
   */
  async deleteStory(storyId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      // Delete related data
      await Promise.all([
        ChapterModel.deleteByStoryId(storyId),
        CharacterModel.deleteByStoryId(storyId),
        StoryPlanModel.deleteByStoryId(storyId),
        ExportModel.deleteByStoryId(storyId)
      ]);

      // Delete story
      await StoryModel.delete(storyId);

      logger.info('Story deleted', {
        userId,
        storyId,
        title: story.title
      });

    } catch (error) {
      logger.error('Failed to delete story', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Generate story plan
   */
  async generateStoryPlan(storyId: string, userId: string, planData: GenerateStoryPlanRequest): Promise<any> {
    try {
      // Verify ownership
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      if (story.status !== 'planning') {
        throw new Error('Can only generate plan for stories in planning status');
      }

      // Import AI services dynamically to avoid circular dependencies
      const { AIProviderManager } = await import('./ai-provider-manager');
      const { promptTemplateService } = await import('./prompt-templates');

      const aiManager = new AIProviderManager();

      // Get story planning prompt template
      const template = await promptTemplateService.getTemplate('story_planning', userId);
      if (!template) {
        throw new Error('Story planning template not found');
      }

      // Build context for prompt
      const context = {
        title: planData.title,
        description: planData.description,
        genre: planData.genre,
        targetChapters: planData.targetChapters,
        setting: planData.setting || '',
        style: planData.style || '',
        themes: planData.themes?.join(', ') || ''
      };

      const prompt = await promptTemplateService.interpolateTemplate(template.content, context);

      // Generate plan using AI
      const response = await aiManager.generateText(prompt, undefined, userId);
      
      // Parse the generated plan (expecting JSON structure)
      let planStructure;
      try {
        planStructure = JSON.parse(response.content);
      } catch {
        throw new Error('Failed to parse generated story plan');
      }

      // Create story plan
      const planCreateData: CreateStoryPlanData = {
        storyId,
        structure: planStructure,
        generatedBy: response.provider,
        generationModel: response.model,
        generationCost: response.cost || 0
      };

      await StoryPlanModel.create(planCreateData);

      // Update story status
      await StoryModel.update(storyId, { status: 'planned' });

      logger.info('Story plan generated', {
        userId,
        storyId,
        provider: response.provider,
        model: response.model,
        cost: response.cost
      });

      return planStructure;

    } catch (error) {
      logger.error('Failed to generate story plan', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Start story generation
   */
  async startGeneration(storyId: string, userId: string): Promise<void> {
    try {
      // Verify ownership and status
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      if (story.status !== 'planned') {
        throw new Error('Story must be planned before generation can start');
      }

      // Check if story plan exists
      const plan = await StoryPlanModel.findByStoryId(storyId);
      if (!plan) {
        throw new Error('Story plan not found');
      }

      // Update status to generating
      await StoryModel.update(storyId, { status: 'generating' });

      // Create chapters based on plan
      if (plan.structure?.acts) {
        let chapterNumber = 1;
        
        for (const act of plan.structure.acts) {
          if (act.chapters) {
            for (const chapterPlan of act.chapters) {
              await ChapterModel.create({
                storyId,
                title: chapterPlan.title || `Chapter ${chapterNumber}`,
                chapterNumber,
                status: 'planned',
                plannedWordCount: chapterPlan.targetWordCount || Math.floor(story.targetWordCount / story.targetChapters),
                summary: chapterPlan.summary || '',
                keyEvents: chapterPlan.keyEvents || [],
                characterFocus: chapterPlan.characters || []
              });
              chapterNumber++;
            }
          }
        }
      }

      // Create characters from plan
      if (plan.structure?.characters) {
        for (const characterData of plan.structure.characters) {
          await CharacterModel.create({
            storyId,
            name: characterData.name,
            role: characterData.role || 'supporting',
            description: characterData.description || '',
            background: characterData.background || '',
            traits: characterData.traits || [],
            goals: characterData.goals || [],
            conflicts: characterData.conflicts || [],
            relationships: characterData.relationships || {}
          });
        }
      }

      logger.info('Story generation started', {
        userId,
        storyId,
        chaptersCreated: plan.structure?.acts?.reduce((total, act) => total + (act.chapters?.length || 0), 0) || 0,
        charactersCreated: plan.structure?.characters?.length || 0
      });

    } catch (error) {
      logger.error('Failed to start story generation', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Get story statistics
   */
  async getStoryStatistics(storyId: string, userId: string): Promise<{
    overview: {
      totalWords: number;
      totalChapters: number;
      completedChapters: number;
      charactersCount: number;
      progressPercentage: number;
    };
    chapterStats: Array<{
      chapterNumber: number;
      title: string;
      wordCount: number;
      status: string;
      completionDate?: Date;
    }>;
    characterStats: Array<{
      name: string;
      role: string;
      prominence: number;
      chaptersAppeared: number;
    }>;
    generationCosts: {
      totalCost: number;
      costBreakdown: Array<{
        provider: string;
        model: string;
        cost: number;
        tokens: number;
      }>;
    };
  }> {
    try {
      // Verify ownership
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      const [chapters, characters] = await Promise.all([
        ChapterModel.findByStoryId(storyId),
        CharacterModel.findByStoryId(storyId)
      ]);

      // Overview statistics
      const completedChapters = chapters.filter(c => c.status === 'generated').length;
      const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
      const progressPercentage = story.targetChapters > 0 
        ? Math.round((completedChapters / story.targetChapters) * 100)
        : 0;

      // Chapter statistics
      const chapterStats = chapters.map(chapter => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        wordCount: chapter.wordCount,
        status: chapter.status,
        completionDate: chapter.status === 'generated' ? chapter.updatedAt : undefined
      }));

      // Character statistics
      const characterStats = characters.map(character => {
        const appearanceCount = chapters.filter(chapter =>
          chapter.characterFocus.includes(character.id)
        ).length;

        return {
          name: character.name,
          role: character.role,
          prominence: character.prominence,
          chaptersAppeared: appearanceCount
        };
      });

      // Generation costs
      const costs = await this.calculateGenerationCosts(storyId);

      return {
        overview: {
          totalWords,
          totalChapters: chapters.length,
          completedChapters,
          charactersCount: characters.length,
          progressPercentage
        },
        chapterStats,
        characterStats,
        generationCosts: costs
      };

    } catch (error) {
      logger.error('Failed to get story statistics', { error, storyId, userId });
      throw error;
    }
  }

  /**
   * Export story in specified format
   */
  async exportStory(
    storyId: string, 
    userId: string, 
    format: ExportFormat,
    options: any = {}
  ): Promise<string> {
    try {
      // Check subscription limits
      const limitCheck = await userService.checkSubscriptionLimits(userId, 'export_story');
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason);
      }

      // Verify ownership
      const story = await StoryModel.findById(storyId);
      if (!story || story.userId !== userId) {
        throw new Error('Story not found or access denied');
      }

      if (story.status === 'planning') {
        throw new Error('Cannot export story that is still in planning phase');
      }

      // Import export engine
      const { exportEngine } = await import('./export-engine');

      // Create export record
      const exportId = await ExportModel.create({
        storyId,
        userId,
        format,
        status: 'processing',
        options
      });

      try {
        // Generate export file
        const filePath = await exportEngine.exportStory(storyId, format, options);

        // Update export record with file path
        await ExportModel.update(exportId, {
          status: 'completed',
          filePath,
          fileSize: await this.getFileSize(filePath)
        });

        logger.info('Story exported successfully', {
          userId,
          storyId,
          exportId,
          format,
          filePath
        });

        return exportId;

      } catch (exportError) {
        // Update export record with error
        await ExportModel.update(exportId, {
          status: 'failed',
          error: exportError.message
        });
        throw exportError;
      }

    } catch (error) {
      logger.error('Failed to export story', { error, storyId, userId, format });
      throw error;
    }
  }

  /**
   * Get available story genres
   */
  getAvailableGenres(): StoryGenre[] {
    return StoryModel.getAvailableGenres();
  }

  /**
   * Search stories
   */
  async searchStories(userId: string, query: string, options: {
    genre?: StoryGenre;
    status?: StoryStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    stories: Story[];
    total: number;
    hasMore: boolean;
  }> {
    return this.getStories({
      ...options,
      userId,
      search: query
    });
  }

  /**
   * Private helper methods
   */

  private validateStoryData(data: CreateStoryRequest): void {
    if (!data.title?.trim()) {
      throw new Error('Story title is required');
    }

    if (data.title.length > 200) {
      throw new Error('Story title must be less than 200 characters');
    }

    if (!data.description?.trim()) {
      throw new Error('Story description is required');
    }

    if (data.description.length > 2000) {
      throw new Error('Story description must be less than 2000 characters');
    }

    if (!this.isValidGenre(data.genre)) {
      throw new Error('Invalid story genre');
    }

    if (data.targetWordCount && (data.targetWordCount < 1000 || data.targetWordCount > 500000)) {
      throw new Error('Target word count must be between 1,000 and 500,000');
    }

    if (data.targetChapters && (data.targetChapters < 1 || data.targetChapters > 100)) {
      throw new Error('Target chapters must be between 1 and 100');
    }
  }

  private isValidGenre(genre: string): genre is StoryGenre {
    const validGenres = StoryModel.getAvailableGenres();
    return validGenres.includes(genre as StoryGenre);
  }

  private isValidStatusTransition(currentStatus: StoryStatus, newStatus: StoryStatus): boolean {
    const validTransitions: Record<StoryStatus, StoryStatus[]> = {
      'planning': ['planned', 'cancelled'],
      'planned': ['planning', 'generating', 'cancelled'],
      'generating': ['generated', 'cancelled'],
      'generated': ['published', 'archived'],
      'published': ['archived'],
      'archived': ['published'],
      'cancelled': ['planning']
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private calculateStoryStatistics(story: Story, chapters: any[]): StoryWithDetails['statistics'] {
    const completedChapters = chapters.filter(c => c.status === 'generated').length;
    const totalWordCount = chapters.reduce((sum, c) => sum + c.wordCount, 0);
    const averageChapterLength = chapters.length > 0 
      ? Math.round(totalWordCount / chapters.length) 
      : 0;
    const progressPercentage = story.targetChapters > 0 
      ? Math.round((completedChapters / story.targetChapters) * 100)
      : 0;

    return {
      totalChapters: chapters.length,
      completedChapters,
      totalWordCount,
      averageChapterLength,
      progressPercentage
    };
  }

  private async calculateGenerationCosts(storyId: string): Promise<{
    totalCost: number;
    costBreakdown: Array<{
      provider: string;
      model: string;
      cost: number;
      tokens: number;
    }>;
  }> {
    try {
      const chapters = await ChapterModel.findByStoryId(storyId);
      const plan = await StoryPlanModel.findByStoryId(storyId);

      const costBreakdown: Array<{
        provider: string;
        model: string;
        cost: number;
        tokens: number;
      }> = [];

      // Add plan generation cost
      if (plan && plan.generationCost > 0) {
        costBreakdown.push({
          provider: plan.generatedBy || 'unknown',
          model: plan.generationModel || 'unknown',
          cost: plan.generationCost,
          tokens: 0 // Not tracked for plan generation
        });
      }

      // Add chapter generation costs
      for (const chapter of chapters) {
        if (chapter.generationCost > 0) {
          const existing = costBreakdown.find(
            c => c.provider === chapter.generatedBy && c.model === chapter.generationModel
          );

          if (existing) {
            existing.cost += chapter.generationCost;
            existing.tokens += chapter.generationTokens || 0;
          } else {
            costBreakdown.push({
              provider: chapter.generatedBy || 'unknown',
              model: chapter.generationModel || 'unknown',
              cost: chapter.generationCost,
              tokens: chapter.generationTokens || 0
            });
          }
        }
      }

      const totalCost = costBreakdown.reduce((sum, item) => sum + item.cost, 0);

      return {
        totalCost,
        costBreakdown
      };

    } catch (error) {
      logger.error('Failed to calculate generation costs', { error, storyId });
      return {
        totalCost: 0,
        costBreakdown: []
      };
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

export const storyService = new StoryService();