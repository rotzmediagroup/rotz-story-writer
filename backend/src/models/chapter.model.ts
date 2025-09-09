import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type ChapterStatus = 'planned' | 'generating' | 'generated' | 'revised' | 'approved' | 'failed';

export interface QualityMetrics {
  readability: {
    fleschKincaidGrade: number;
    fleschReadingEase: number;
    avgSentenceLength: number;
    avgWordsPerSentence: number;
  };
  consistency: {
    characterVoiceScore: number; // 0-100
    toneConsistencyScore: number; // 0-100
    styleConsistencyScore: number; // 0-100
  };
  structure: {
    paragraphCount: number;
    avgParagraphLength: number;
    dialoguePercentage: number;
    actionPercentage: number;
  };
  aiMetrics: {
    coherenceScore: number; // 0-100
    creativityScore: number; // 0-100
    engagementScore: number; // 0-100
  };
  overallScore: number; // 0-100 weighted average
}

export interface GenerationAttempt {
  attemptNumber: number;
  timestamp: Date;
  prompt: string;
  model: string;
  tokens: number;
  success: boolean;
  error?: string;
  qualityScore?: number;
}

export interface Chapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title?: string;
  plannedSummary?: string;
  content?: string;
  wordCount: number;
  targetWordCount?: number;
  status: ChapterStatus;
  generationAttempts: number;
  lastGeneratedAt?: Date;
  qualityMetrics?: QualityMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChapterData {
  storyId: string;
  chapterNumber: number;
  title?: string;
  plannedSummary?: string;
  targetWordCount?: number;
}

export interface UpdateChapterData {
  title?: string;
  plannedSummary?: string;
  content?: string;
  wordCount?: number;
  targetWordCount?: number;
  status?: ChapterStatus;
  generationAttempts?: number;
  lastGeneratedAt?: Date;
  qualityMetrics?: QualityMetrics;
}

export interface ChapterWithAttempts extends Chapter {
  attempts: GenerationAttempt[];
}

export class ChapterModel {
  /**
   * Create a new chapter
   */
  static async create(chapterData: CreateChapterData): Promise<Chapter> {
    const id = uuidv4();
    
    try {
      const result = await query(`
        INSERT INTO chapters (
          id, story_id, chapter_number, title, planned_summary, 
          word_count, target_word_count, status, generation_attempts,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `, [
        id,
        chapterData.storyId,
        chapterData.chapterNumber,
        chapterData.title || null,
        chapterData.plannedSummary || null,
        0, // initial word count
        chapterData.targetWordCount || null,
        'planned' as ChapterStatus,
        0, // initial generation attempts
      ]);

      const chapter = this.mapDatabaseRowToChapter(result.rows[0]);
      logger.info('Chapter created successfully', { 
        chapterId: id, 
        storyId: chapterData.storyId, 
        chapterNumber: chapterData.chapterNumber 
      });
      
      return chapter;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`Chapter ${chapterData.chapterNumber} already exists for this story`);
      }
      logger.error('Failed to create chapter', { error, chapterData });
      throw error;
    }
  }

  /**
   * Find chapter by ID
   */
  static async findById(id: string): Promise<Chapter | null> {
    try {
      const result = await query(`
        SELECT * FROM chapters WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToChapter(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find chapter by ID', { error, chapterId: id });
      throw error;
    }
  }

  /**
   * Find chapter by story ID and chapter number
   */
  static async findByStoryAndNumber(storyId: string, chapterNumber: number): Promise<Chapter | null> {
    try {
      const result = await query(`
        SELECT * FROM chapters 
        WHERE story_id = $1 AND chapter_number = $2
      `, [storyId, chapterNumber]);

      return result.rows.length > 0 ? this.mapDatabaseRowToChapter(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find chapter by story and number', { error, storyId, chapterNumber });
      throw error;
    }
  }

  /**
   * Find all chapters for a story
   */
  static async findByStoryId(storyId: string): Promise<Chapter[]> {
    try {
      const result = await query(`
        SELECT * FROM chapters 
        WHERE story_id = $1 
        ORDER BY chapter_number ASC
      `, [storyId]);

      return result.rows.map(row => this.mapDatabaseRowToChapter(row));
    } catch (error) {
      logger.error('Failed to find chapters by story ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Update chapter
   */
  static async update(id: string, updateData: UpdateChapterData): Promise<Chapter | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        if (key === 'qualityMetrics' && value !== null) {
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
        UPDATE chapters 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const chapter = this.mapDatabaseRowToChapter(result.rows[0]);
      logger.info('Chapter updated successfully', { chapterId: id });
      
      return chapter;
    } catch (error) {
      logger.error('Failed to update chapter', { error, chapterId: id, updateData });
      throw error;
    }
  }

  /**
   * Update chapter content and calculate word count
   */
  static async updateContent(id: string, content: string): Promise<Chapter | null> {
    const wordCount = this.calculateWordCount(content);
    
    return this.update(id, {
      content,
      wordCount,
      status: 'generated',
      lastGeneratedAt: new Date(),
    });
  }

  /**
   * Update chapter status
   */
  static async updateStatus(id: string, status: ChapterStatus): Promise<Chapter | null> {
    const updateData: UpdateChapterData = { status };
    
    // Set timestamp for certain status changes
    if (status === 'generating') {
      updateData.lastGeneratedAt = new Date();
    }

    return this.update(id, updateData);
  }

  /**
   * Increment generation attempts
   */
  static async incrementGenerationAttempts(id: string): Promise<Chapter | null> {
    try {
      const result = await query(`
        UPDATE chapters 
        SET generation_attempts = generation_attempts + 1, 
            last_generated_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToChapter(result.rows[0]);
    } catch (error) {
      logger.error('Failed to increment generation attempts', { error, chapterId: id });
      throw error;
    }
  }

  /**
   * Delete chapter
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM chapters WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Chapter deleted successfully', { chapterId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete chapter', { error, chapterId: id });
      throw error;
    }
  }

  /**
   * Delete all chapters for a story
   */
  static async deleteByStoryId(storyId: string): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM chapters WHERE story_id = $1
      `, [storyId]);

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        logger.info('Chapters deleted for story', { storyId, deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete chapters by story ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Find chapters by status
   */
  static async findByStatus(status: ChapterStatus, limit = 100): Promise<Chapter[]> {
    try {
      const result = await query(`
        SELECT * FROM chapters 
        WHERE status = $1 
        ORDER BY updated_at DESC 
        LIMIT $2
      `, [status, limit]);

      return result.rows.map(row => this.mapDatabaseRowToChapter(row));
    } catch (error) {
      logger.error('Failed to find chapters by status', { error, status });
      throw error;
    }
  }

  /**
   * Get next chapter to generate for a story
   */
  static async getNextToGenerate(storyId: string): Promise<Chapter | null> {
    try {
      const result = await query(`
        SELECT * FROM chapters 
        WHERE story_id = $1 AND status IN ('planned', 'failed')
        ORDER BY chapter_number ASC 
        LIMIT 1
      `, [storyId]);

      return result.rows.length > 0 ? this.mapDatabaseRowToChapter(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get next chapter to generate', { error, storyId });
      throw error;
    }
  }

  /**
   * Get chapter progress for a story
   */
  static async getStoryProgress(storyId: string): Promise<{
    total: number;
    planned: number;
    generating: number;
    generated: number;
    revised: number;
    approved: number;
    failed: number;
  }> {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned,
          COUNT(CASE WHEN status = 'generating' THEN 1 END) as generating,
          COUNT(CASE WHEN status = 'generated' THEN 1 END) as generated,
          COUNT(CASE WHEN status = 'revised' THEN 1 END) as revised,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM chapters 
        WHERE story_id = $1
      `, [storyId]);

      const row = result.rows[0];
      return {
        total: parseInt(row.total),
        planned: parseInt(row.planned),
        generating: parseInt(row.generating),
        generated: parseInt(row.generated),
        revised: parseInt(row.revised),
        approved: parseInt(row.approved),
        failed: parseInt(row.failed),
      };
    } catch (error) {
      logger.error('Failed to get story progress', { error, storyId });
      throw error;
    }
  }

  /**
   * Get total word count for a story
   */
  static async getStoryWordCount(storyId: string): Promise<number> {
    try {
      const result = await query(`
        SELECT COALESCE(SUM(word_count), 0) as total_words
        FROM chapters 
        WHERE story_id = $1 AND status IN ('generated', 'revised', 'approved')
      `, [storyId]);

      return parseInt(result.rows[0].total_words);
    } catch (error) {
      logger.error('Failed to get story word count', { error, storyId });
      throw error;
    }
  }

  /**
   * Calculate word count from content
   */
  static calculateWordCount(content: string): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }
    
    // Remove extra whitespace and split by whitespace
    const words = content.trim().split(/\s+/);
    return words.length;
  }

  /**
   * Calculate reading time in minutes
   */
  static calculateReadingTime(wordCount: number, wordsPerMinute = 250): number {
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Validate chapter number sequence for a story
   */
  static async validateChapterSequence(storyId: string): Promise<{
    valid: boolean;
    missingChapters: number[];
    duplicateChapters: number[];
  }> {
    try {
      const result = await query(`
        SELECT chapter_number 
        FROM chapters 
        WHERE story_id = $1 
        ORDER BY chapter_number ASC
      `, [storyId]);

      const chapters = result.rows.map(row => row.chapter_number);
      const maxChapter = Math.max(...chapters);
      const expectedChapters = Array.from({ length: maxChapter }, (_, i) => i + 1);
      
      const missingChapters = expectedChapters.filter(num => !chapters.includes(num));
      const duplicateChapters = chapters.filter((num, index) => chapters.indexOf(num) !== index);

      return {
        valid: missingChapters.length === 0 && duplicateChapters.length === 0,
        missingChapters,
        duplicateChapters,
      };
    } catch (error) {
      logger.error('Failed to validate chapter sequence', { error, storyId });
      throw error;
    }
  }

  /**
   * Create chapters from story plan
   */
  static async createFromPlan(storyId: string, chapterSummaries: Array<{
    chapterNumber: number;
    title: string;
    summary: string;
    wordCount: number;
  }>): Promise<Chapter[]> {
    const createdChapters: Chapter[] = [];

    for (const summary of chapterSummaries) {
      try {
        const chapter = await this.create({
          storyId,
          chapterNumber: summary.chapterNumber,
          title: summary.title,
          plannedSummary: summary.summary,
          targetWordCount: summary.wordCount,
        });
        createdChapters.push(chapter);
      } catch (error) {
        // If chapter already exists, skip it
        if ((error as Error).message.includes('already exists')) {
          logger.warn('Chapter already exists, skipping', { storyId, chapterNumber: summary.chapterNumber });
          continue;
        }
        throw error;
      }
    }

    return createdChapters;
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      storyId: 'story_id',
      chapterNumber: 'chapter_number',
      plannedSummary: 'planned_summary',
      wordCount: 'word_count',
      targetWordCount: 'target_word_count',
      generationAttempts: 'generation_attempts',
      lastGeneratedAt: 'last_generated_at',
      qualityMetrics: 'quality_metrics',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Parse JSON field safely
   */
  private static parseJsonField<T>(value: any): T | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Map database row to Chapter object
   */
  private static mapDatabaseRowToChapter(row: any): Chapter {
    return {
      id: row.id,
      storyId: row.story_id,
      chapterNumber: row.chapter_number,
      title: row.title || undefined,
      plannedSummary: row.planned_summary || undefined,
      content: row.content || undefined,
      wordCount: row.word_count || 0,
      targetWordCount: row.target_word_count || undefined,
      status: row.status as ChapterStatus,
      generationAttempts: row.generation_attempts || 0,
      lastGeneratedAt: row.last_generated_at || undefined,
      qualityMetrics: this.parseJsonField<QualityMetrics>(row.quality_metrics),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}