import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type StoryGenre = 
  | 'Romance' | 'Thriller' | 'Fantasy' | 'Science Fiction' | 'Mystery'
  | 'Horror' | 'Literary Fiction' | 'Historical Fiction' | 'Adventure'
  | 'Young Adult' | 'Children' | 'Biography' | 'Comedy' | 'Drama'
  | 'Western' | 'Crime' | 'Supernatural' | 'Dystopian' | 'Contemporary' | 'Erotic';

export type TargetAgeGroup = 'Children' | 'YA' | 'Adult';
export type ContentRating = 'G' | 'PG' | 'PG-13' | 'R';
export type ReadingLevel = 'Elementary' | 'Middle Grade' | 'High School' | 'College' | 'Advanced';
export type POV = 'First Person' | 'Third Limited' | 'Third Omniscient';
export type Tense = 'Past' | 'Present' | 'Future';
export type StoryStatus = 'draft' | 'planning' | 'generating' | 'complete' | 'archived' | 'failed';

export interface Story {
  id: string;
  userId: string;
  title: string;
  premise: string;
  genre: StoryGenre;
  subgenre?: string;
  targetLength: number;
  actualLength: number;
  targetAgeGroup?: TargetAgeGroup;
  contentRating?: ContentRating;
  readingLevel?: ReadingLevel;
  themes: string[];
  tone?: string;
  writingStyle?: string;
  pov?: POV;
  tense?: Tense;
  status: StoryStatus;
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  qualityScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoryData {
  userId: string;
  title: string;
  premise: string;
  genre: StoryGenre;
  subgenre?: string;
  targetLength: number;
  targetAgeGroup?: TargetAgeGroup;
  contentRating?: ContentRating;
  readingLevel?: ReadingLevel;
  themes?: string[];
  tone?: string;
  writingStyle?: string;
  pov?: POV;
  tense?: Tense;
}

export interface UpdateStoryData {
  title?: string;
  premise?: string;
  genre?: StoryGenre;
  subgenre?: string;
  targetLength?: number;
  actualLength?: number;
  targetAgeGroup?: TargetAgeGroup;
  contentRating?: ContentRating;
  readingLevel?: ReadingLevel;
  themes?: string[];
  tone?: string;
  writingStyle?: string;
  pov?: POV;
  tense?: Tense;
  status?: StoryStatus;
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  qualityScore?: number;
}

export interface StoryListItem {
  id: string;
  title: string;
  genre: StoryGenre;
  status: StoryStatus;
  targetLength: number;
  actualLength: number;
  qualityScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryFilters {
  userId?: string;
  status?: StoryStatus;
  genre?: StoryGenre;
  targetAgeGroup?: TargetAgeGroup;
  contentRating?: ContentRating;
  themes?: string[];
  minLength?: number;
  maxLength?: number;
  minQualityScore?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface StoryListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'actualLength' | 'qualityScore';
  sortOrder?: 'asc' | 'desc';
}

export class StoryModel {
  /**
   * Create a new story
   */
  static async create(storyData: CreateStoryData): Promise<Story> {
    const id = uuidv4();
    
    // Validate target length
    if (!this.isValidTargetLength(storyData.targetLength)) {
      throw new Error('Target length must be between 100 and 500,000 words');
    }

    // Validate genre
    if (!this.isValidGenre(storyData.genre)) {
      throw new Error(`Invalid genre: ${storyData.genre}`);
    }

    try {
      const result = await query(`
        INSERT INTO stories (
          id, user_id, title, premise, genre, subgenre, target_length,
          actual_length, target_age_group, content_rating, reading_level,
          themes, tone, writing_style, pov, tense, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING *
      `, [
        id,
        storyData.userId,
        storyData.title.trim(),
        storyData.premise.trim(),
        storyData.genre,
        storyData.subgenre || null,
        storyData.targetLength,
        0, // initial actual length
        storyData.targetAgeGroup || null,
        storyData.contentRating || null,
        storyData.readingLevel || null,
        JSON.stringify(storyData.themes || []),
        storyData.tone || null,
        storyData.writingStyle || null,
        storyData.pov || null,
        storyData.tense || null,
        'draft' as StoryStatus,
      ]);

      const story = this.mapDatabaseRowToStory(result.rows[0]);
      logger.info('Story created successfully', { storyId: id, userId: storyData.userId });
      
      return story;
    } catch (error) {
      logger.error('Failed to create story', { error, storyData });
      throw error;
    }
  }

  /**
   * Find story by ID
   */
  static async findById(id: string): Promise<Story | null> {
    try {
      const result = await query(`
        SELECT * FROM stories WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToStory(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find story by ID', { error, storyId: id });
      throw error;
    }
  }

  /**
   * Find story by ID with user permission check
   */
  static async findByIdForUser(id: string, userId: string): Promise<Story | null> {
    try {
      const result = await query(`
        SELECT * FROM stories WHERE id = $1 AND user_id = $2
      `, [id, userId]);

      return result.rows.length > 0 ? this.mapDatabaseRowToStory(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find story by ID for user', { error, storyId: id, userId });
      throw error;
    }
  }

  /**
   * Update story
   */
  static async update(id: string, updateData: UpdateStoryData): Promise<Story | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Validate target length if provided
    if (updateData.targetLength !== undefined && !this.isValidTargetLength(updateData.targetLength)) {
      throw new Error('Target length must be between 100 and 500,000 words');
    }

    // Validate genre if provided
    if (updateData.genre !== undefined && !this.isValidGenre(updateData.genre)) {
      throw new Error(`Invalid genre: ${updateData.genre}`);
    }

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        if (key === 'themes' && Array.isArray(value)) {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }
    });

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE stories 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const story = this.mapDatabaseRowToStory(result.rows[0]);
      logger.info('Story updated successfully', { storyId: id });
      
      return story;
    } catch (error) {
      logger.error('Failed to update story', { error, storyId: id, updateData });
      throw error;
    }
  }

  /**
   * List stories with filters and pagination
   */
  static async list(filters: StoryFilters = {}, options: StoryListOptions = {}): Promise<{
    stories: StoryListItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (filters.userId) {
      whereConditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.genre) {
      whereConditions.push(`genre = $${paramIndex++}`);
      values.push(filters.genre);
    }

    if (filters.targetAgeGroup) {
      whereConditions.push(`target_age_group = $${paramIndex++}`);
      values.push(filters.targetAgeGroup);
    }

    if (filters.contentRating) {
      whereConditions.push(`content_rating = $${paramIndex++}`);
      values.push(filters.contentRating);
    }

    if (filters.minLength) {
      whereConditions.push(`actual_length >= $${paramIndex++}`);
      values.push(filters.minLength);
    }

    if (filters.maxLength) {
      whereConditions.push(`actual_length <= $${paramIndex++}`);
      values.push(filters.maxLength);
    }

    if (filters.minQualityScore) {
      whereConditions.push(`quality_score >= $${paramIndex++}`);
      values.push(filters.minQualityScore);
    }

    if (filters.createdAfter) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      whereConditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.createdBefore);
    }

    if (filters.themes && filters.themes.length > 0) {
      whereConditions.push(`themes @> $${paramIndex++}`);
      values.push(JSON.stringify(filters.themes));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sortField = this.getDbFieldName(sortBy);

    try {
      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as count FROM stories ${whereClause}
      `, values);
      
      const total = parseInt(countResult.rows[0].count);

      // Get stories
      const result = await query(`
        SELECT id, title, genre, status, target_length, actual_length, 
               quality_score, created_at, updated_at
        FROM stories 
        ${whereClause}
        ORDER BY ${sortField} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...values, limit, offset]);

      const stories = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        genre: row.genre as StoryGenre,
        status: row.status as StoryStatus,
        targetLength: row.target_length,
        actualLength: row.actual_length,
        qualityScore: row.quality_score || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        stories,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error('Failed to list stories', { error, filters, options });
      throw error;
    }
  }

  /**
   * Delete story
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM stories WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Story deleted successfully', { storyId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete story', { error, storyId: id });
      throw error;
    }
  }

  /**
   * Update story status with validation
   */
  static async updateStatus(id: string, newStatus: StoryStatus): Promise<Story | null> {
    const currentStory = await this.findById(id);
    if (!currentStory) {
      return null;
    }

    // Validate status transition
    if (!this.isValidStatusTransition(currentStory.status, newStatus)) {
      throw new Error(`Invalid status transition from ${currentStory.status} to ${newStatus}`);
    }

    const updateData: UpdateStoryData = { status: newStatus };

    // Set timestamps based on status
    if (newStatus === 'generating') {
      updateData.generationStartedAt = new Date();
    } else if (newStatus === 'complete') {
      updateData.generationCompletedAt = new Date();
    }

    return this.update(id, updateData);
  }

  /**
   * Update actual word count
   */
  static async updateWordCount(id: string, wordCount: number): Promise<void> {
    try {
      await query(`
        UPDATE stories 
        SET actual_length = $1, updated_at = NOW()
        WHERE id = $2
      `, [wordCount, id]);
    } catch (error) {
      logger.error('Failed to update word count', { error, storyId: id, wordCount });
      throw error;
    }
  }

  /**
   * Get stories by user
   */
  static async findByUserId(userId: string, limit = 50): Promise<StoryListItem[]> {
    return (await this.list({ userId }, { limit, sortBy: 'updatedAt', sortOrder: 'desc' })).stories;
  }

  /**
   * Get stories by status
   */
  static async findByStatus(status: StoryStatus, limit = 100): Promise<Story[]> {
    try {
      const result = await query(`
        SELECT * FROM stories 
        WHERE status = $1 
        ORDER BY updated_at DESC 
        LIMIT $2
      `, [status, limit]);

      return result.rows.map(row => this.mapDatabaseRowToStory(row));
    } catch (error) {
      logger.error('Failed to find stories by status', { error, status });
      throw error;
    }
  }

  /**
   * Get story count by user
   */
  static async getCountByUserId(userId: string): Promise<number> {
    try {
      const result = await query(`
        SELECT COUNT(*) as count FROM stories WHERE user_id = $1
      `, [userId]);

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get story count by user', { error, userId });
      throw error;
    }
  }

  /**
   * Get available genres
   */
  static getAvailableGenres(): StoryGenre[] {
    return [
      'Romance', 'Thriller', 'Fantasy', 'Science Fiction', 'Mystery',
      'Horror', 'Literary Fiction', 'Historical Fiction', 'Adventure',
      'Young Adult', 'Children', 'Biography', 'Comedy', 'Drama',
      'Western', 'Crime', 'Supernatural', 'Dystopian', 'Contemporary', 'Erotic'
    ];
  }

  /**
   * Validate genre
   */
  static isValidGenre(genre: string): genre is StoryGenre {
    return this.getAvailableGenres().includes(genre as StoryGenre);
  }

  /**
   * Validate target length
   */
  static isValidTargetLength(length: number): boolean {
    return length >= 100 && length <= 500000;
  }

  /**
   * Validate status transition
   */
  static isValidStatusTransition(currentStatus: StoryStatus, newStatus: StoryStatus): boolean {
    const allowedTransitions: Record<StoryStatus, StoryStatus[]> = {
      draft: ['planning', 'archived'],
      planning: ['draft', 'generating', 'archived'],
      generating: ['planning', 'complete', 'failed', 'archived'],
      complete: ['archived'],
      failed: ['planning', 'archived'],
      archived: ['draft']
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      userId: 'user_id',
      targetLength: 'target_length',
      actualLength: 'actual_length',
      targetAgeGroup: 'target_age_group',
      contentRating: 'content_rating',
      readingLevel: 'reading_level',
      writingStyle: 'writing_style',
      qualityScore: 'quality_score',
      generationStartedAt: 'generation_started_at',
      generationCompletedAt: 'generation_completed_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Map database row to Story object
   */
  private static mapDatabaseRowToStory(row: any): Story {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      premise: row.premise,
      genre: row.genre as StoryGenre,
      subgenre: row.subgenre || undefined,
      targetLength: row.target_length,
      actualLength: row.actual_length,
      targetAgeGroup: row.target_age_group as TargetAgeGroup || undefined,
      contentRating: row.content_rating as ContentRating || undefined,
      readingLevel: row.reading_level as ReadingLevel || undefined,
      themes: typeof row.themes === 'string' ? JSON.parse(row.themes) : row.themes || [],
      tone: row.tone || undefined,
      writingStyle: row.writing_style || undefined,
      pov: row.pov as POV || undefined,
      tense: row.tense as Tense || undefined,
      status: row.status as StoryStatus,
      generationStartedAt: row.generation_started_at || undefined,
      generationCompletedAt: row.generation_completed_at || undefined,
      qualityScore: row.quality_score || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}