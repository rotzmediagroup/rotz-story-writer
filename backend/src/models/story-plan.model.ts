import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export interface ActStructure {
  act1: {
    percentage: number;
    description: string;
    keyEvents: string[];
  };
  act2: {
    percentage: number;
    description: string;
    keyEvents: string[];
  };
  act3: {
    percentage: number;
    description: string;
    keyEvents: string[];
  };
}

export interface ChapterSummary {
  chapterNumber: number;
  title: string;
  summary: string;
  wordCount: number;
  keyEvents: string[];
  characters: string[];
  themes: string[];
  notes?: string;
}

export interface StoryArc {
  setup: {
    description: string;
    chapters: number[];
  };
  incitingIncident: {
    description: string;
    chapter: number;
  };
  risingAction: {
    description: string;
    chapters: number[];
    majorPlotPoints: string[];
  };
  climax: {
    description: string;
    chapter: number;
  };
  fallingAction: {
    description: string;
    chapters: number[];
  };
  resolution: {
    description: string;
    chapters: number[];
  };
}

export interface ThematicProgression {
  primaryTheme: {
    theme: string;
    introduction: number; // chapter number
    development: number[];
    climax: number;
    resolution: number;
  };
  secondaryThemes: Array<{
    theme: string;
    introduction: number;
    development: number[];
    resolution: number;
  }>;
}

export interface PacingMap {
  chapters: Array<{
    chapterNumber: number;
    tensionLevel: number; // 1-10 scale
    paceLevel: number; // 1-10 scale (1=slow, 10=fast)
    emotionalTone: string;
    notes?: string;
  }>;
  overallPacing: 'slow' | 'moderate' | 'fast' | 'variable';
}

export interface StoryPlan {
  id: string;
  storyId: string;
  totalChapters: number;
  actStructure: ActStructure;
  chapterSummaries: ChapterSummary[];
  storyArc: StoryArc;
  thematicProgression?: ThematicProgression;
  pacingMap?: PacingMap;
  estimatedGenerationTime?: number;
  approved: boolean;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoryPlanData {
  storyId: string;
  totalChapters: number;
  actStructure: ActStructure;
  chapterSummaries: ChapterSummary[];
  storyArc: StoryArc;
  thematicProgression?: ThematicProgression;
  pacingMap?: PacingMap;
  estimatedGenerationTime?: number;
}

export interface UpdateStoryPlanData {
  totalChapters?: number;
  actStructure?: ActStructure;
  chapterSummaries?: ChapterSummary[];
  storyArc?: StoryArc;
  thematicProgression?: ThematicProgression;
  pacingMap?: PacingMap;
  estimatedGenerationTime?: number;
  approved?: boolean;
  approvedAt?: Date;
}

export class StoryPlanModel {
  /**
   * Create a new story plan
   */
  static async create(planData: CreateStoryPlanData): Promise<StoryPlan> {
    const id = uuidv4();
    
    // Validate chapter summaries count matches total chapters
    if (planData.chapterSummaries.length !== planData.totalChapters) {
      throw new Error('Chapter summaries count must match total chapters');
    }

    // Validate act structure percentages sum to 100
    if (!this.validateActStructure(planData.actStructure)) {
      throw new Error('Act structure percentages must sum to 100');
    }

    // Validate chapter summaries sequence
    if (!this.validateChapterSummaries(planData.chapterSummaries)) {
      throw new Error('Chapter summaries must be in sequential order starting from 1');
    }

    try {
      const result = await query(`
        INSERT INTO story_plans (
          id, story_id, total_chapters, act_structure, chapter_summaries,
          story_arc, thematic_progression, pacing_map, estimated_generation_time,
          approved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `, [
        id,
        planData.storyId,
        planData.totalChapters,
        JSON.stringify(planData.actStructure),
        JSON.stringify(planData.chapterSummaries),
        JSON.stringify(planData.storyArc),
        planData.thematicProgression ? JSON.stringify(planData.thematicProgression) : null,
        planData.pacingMap ? JSON.stringify(planData.pacingMap) : null,
        planData.estimatedGenerationTime || null,
        false, // initially not approved
      ]);

      const storyPlan = this.mapDatabaseRowToStoryPlan(result.rows[0]);
      logger.info('Story plan created successfully', { planId: id, storyId: planData.storyId });
      
      return storyPlan;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error('Story plan already exists for this story');
      }
      logger.error('Failed to create story plan', { error, planData });
      throw error;
    }
  }

  /**
   * Find story plan by ID
   */
  static async findById(id: string): Promise<StoryPlan | null> {
    try {
      const result = await query(`
        SELECT * FROM story_plans WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToStoryPlan(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find story plan by ID', { error, planId: id });
      throw error;
    }
  }

  /**
   * Find story plan by story ID
   */
  static async findByStoryId(storyId: string): Promise<StoryPlan | null> {
    try {
      const result = await query(`
        SELECT * FROM story_plans WHERE story_id = $1
      `, [storyId]);

      return result.rows.length > 0 ? this.mapDatabaseRowToStoryPlan(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find story plan by story ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Update story plan
   */
  static async update(id: string, updateData: UpdateStoryPlanData): Promise<StoryPlan | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Validate chapter summaries count if provided
    if (updateData.totalChapters !== undefined && updateData.chapterSummaries !== undefined) {
      if (updateData.chapterSummaries.length !== updateData.totalChapters) {
        throw new Error('Chapter summaries count must match total chapters');
      }
    }

    // Validate act structure if provided
    if (updateData.actStructure !== undefined && !this.validateActStructure(updateData.actStructure)) {
      throw new Error('Act structure percentages must sum to 100');
    }

    // Validate chapter summaries if provided
    if (updateData.chapterSummaries !== undefined && !this.validateChapterSummaries(updateData.chapterSummaries)) {
      throw new Error('Chapter summaries must be in sequential order starting from 1');
    }

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        if (this.isJsonField(key)) {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }
    });

    // Set approval timestamp when approving
    if (updateData.approved === true && updateData.approvedAt === undefined) {
      updates.push(`approved_at = NOW()`);
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE story_plans 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const storyPlan = this.mapDatabaseRowToStoryPlan(result.rows[0]);
      logger.info('Story plan updated successfully', { planId: id });
      
      return storyPlan;
    } catch (error) {
      logger.error('Failed to update story plan', { error, planId: id, updateData });
      throw error;
    }
  }

  /**
   * Approve story plan
   */
  static async approve(id: string): Promise<StoryPlan | null> {
    return this.update(id, { approved: true, approvedAt: new Date() });
  }

  /**
   * Unapprove story plan
   */
  static async unapprove(id: string): Promise<StoryPlan | null> {
    return this.update(id, { approved: false, approvedAt: undefined });
  }

  /**
   * Delete story plan
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM story_plans WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Story plan deleted successfully', { planId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete story plan', { error, planId: id });
      throw error;
    }
  }

  /**
   * Get chapter summary by chapter number
   */
  static getChapterSummary(plan: StoryPlan, chapterNumber: number): ChapterSummary | null {
    return plan.chapterSummaries.find(ch => ch.chapterNumber === chapterNumber) || null;
  }

  /**
   * Update chapter summary
   */
  static async updateChapterSummary(
    planId: string, 
    chapterNumber: number, 
    updates: Partial<ChapterSummary>
  ): Promise<StoryPlan | null> {
    const plan = await this.findById(planId);
    if (!plan) {
      return null;
    }

    const chapterIndex = plan.chapterSummaries.findIndex(ch => ch.chapterNumber === chapterNumber);
    if (chapterIndex === -1) {
      throw new Error(`Chapter ${chapterNumber} not found in plan`);
    }

    // Update chapter summary
    plan.chapterSummaries[chapterIndex] = {
      ...plan.chapterSummaries[chapterIndex],
      ...updates,
      chapterNumber, // Ensure chapter number doesn't change
    };

    return this.update(planId, { chapterSummaries: plan.chapterSummaries });
  }

  /**
   * Get estimated word count for story plan
   */
  static getEstimatedWordCount(plan: StoryPlan): number {
    return plan.chapterSummaries.reduce((total, chapter) => total + chapter.wordCount, 0);
  }

  /**
   * Get chapters by act
   */
  static getChaptersByAct(plan: StoryPlan, act: 'act1' | 'act2' | 'act3'): ChapterSummary[] {
    const actPercentage = plan.actStructure[act].percentage;
    const totalChapters = plan.totalChapters;
    
    let startChapter: number;
    let endChapter: number;
    
    if (act === 'act1') {
      startChapter = 1;
      endChapter = Math.ceil(totalChapters * (actPercentage / 100));
    } else if (act === 'act2') {
      const act1End = Math.ceil(totalChapters * (plan.actStructure.act1.percentage / 100));
      startChapter = act1End + 1;
      endChapter = act1End + Math.ceil(totalChapters * (actPercentage / 100));
    } else { // act3
      const act2End = totalChapters - Math.ceil(totalChapters * (actPercentage / 100));
      startChapter = act2End + 1;
      endChapter = totalChapters;
    }
    
    return plan.chapterSummaries.filter(
      ch => ch.chapterNumber >= startChapter && ch.chapterNumber <= endChapter
    );
  }

  /**
   * Validate act structure percentages sum to 100
   */
  private static validateActStructure(actStructure: ActStructure): boolean {
    const total = actStructure.act1.percentage + actStructure.act2.percentage + actStructure.act3.percentage;
    return Math.abs(total - 100) < 0.01; // Allow for floating point precision
  }

  /**
   * Validate chapter summaries are in sequential order
   */
  private static validateChapterSummaries(chapterSummaries: ChapterSummary[]): boolean {
    const sortedChapters = [...chapterSummaries].sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    for (let i = 0; i < sortedChapters.length; i++) {
      if (sortedChapters[i].chapterNumber !== i + 1) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if field is JSON field
   */
  private static isJsonField(field: string): boolean {
    const jsonFields = [
      'actStructure', 'chapterSummaries', 'storyArc', 
      'thematicProgression', 'pacingMap'
    ];
    return jsonFields.includes(field);
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      storyId: 'story_id',
      totalChapters: 'total_chapters',
      actStructure: 'act_structure',
      chapterSummaries: 'chapter_summaries',
      storyArc: 'story_arc',
      thematicProgression: 'thematic_progression',
      pacingMap: 'pacing_map',
      estimatedGenerationTime: 'estimated_generation_time',
      approvedAt: 'approved_at',
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
   * Map database row to StoryPlan object
   */
  private static mapDatabaseRowToStoryPlan(row: any): StoryPlan {
    return {
      id: row.id,
      storyId: row.story_id,
      totalChapters: row.total_chapters,
      actStructure: this.parseJsonField<ActStructure>(row.act_structure)!,
      chapterSummaries: this.parseJsonField<ChapterSummary[]>(row.chapter_summaries) || [],
      storyArc: this.parseJsonField<StoryArc>(row.story_arc)!,
      thematicProgression: this.parseJsonField<ThematicProgression>(row.thematic_progression),
      pacingMap: this.parseJsonField<PacingMap>(row.pacing_map),
      estimatedGenerationTime: row.estimated_generation_time || undefined,
      approved: row.approved,
      approvedAt: row.approved_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}