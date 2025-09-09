import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type TemplateCategory = 'planning' | 'chapter' | 'character' | 'revision' | 'export';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: string[];
  };
}

export interface PromptTemplate {
  id: string;
  userId?: string; // null for system templates
  name: string;
  category: TemplateCategory;
  genre?: string;
  taskType: string;
  templateContent: string;
  variables: TemplateVariable[];
  exampleOutput?: string;
  version: number;
  isPublic: boolean;
  isDefault: boolean;
  usageCount: number;
  averageRating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePromptTemplateData {
  userId?: string;
  name: string;
  category: TemplateCategory;
  genre?: string;
  taskType: string;
  templateContent: string;
  variables: TemplateVariable[];
  exampleOutput?: string;
  isPublic?: boolean;
  isDefault?: boolean;
}

export interface UpdatePromptTemplateData {
  name?: string;
  category?: TemplateCategory;
  genre?: string;
  taskType?: string;
  templateContent?: string;
  variables?: TemplateVariable[];
  exampleOutput?: string;
  version?: number;
  isPublic?: boolean;
  isDefault?: boolean;
  usageCount?: number;
  averageRating?: number;
}

export interface TemplateFilters {
  userId?: string;
  category?: TemplateCategory;
  genre?: string;
  taskType?: string;
  isPublic?: boolean;
  isDefault?: boolean;
  includeSystem?: boolean; // Include system templates (userId = null)
}

export interface TemplateSummary {
  id: string;
  name: string;
  category: TemplateCategory;
  taskType: string;
  genre?: string;
  isPublic: boolean;
  isDefault: boolean;
  usageCount: number;
  averageRating?: number;
  isSystem: boolean;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: Date;
}

export class PromptTemplateModel {
  /**
   * Create a new prompt template
   */
  static async create(templateData: CreatePromptTemplateData): Promise<PromptTemplate> {
    const id = uuidv4();
    
    // Validate template variables
    if (!this.validateTemplateVariables(templateData.templateContent, templateData.variables)) {
      throw new Error('Template content must include all required variables');
    }

    try {
      // If this is set as default for a task type, unset other defaults
      if (templateData.isDefault) {
        await this.unsetTaskDefaults(templateData.taskType, templateData.userId);
      }

      const result = await query(`
        INSERT INTO prompt_templates (
          id, user_id, name, category, genre, task_type, template_content,
          variables, example_output, version, is_public, is_default,
          usage_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *
      `, [
        id,
        templateData.userId || null,
        templateData.name.trim(),
        templateData.category,
        templateData.genre || null,
        templateData.taskType,
        templateData.templateContent,
        JSON.stringify(templateData.variables),
        templateData.exampleOutput || null,
        1, // initial version
        templateData.isPublic ?? false,
        templateData.isDefault ?? false,
        0, // initial usage count
      ]);

      const template = this.mapDatabaseRowToTemplate(result.rows[0]);
      logger.info('Prompt template created successfully', { 
        templateId: id, 
        userId: templateData.userId,
        category: templateData.category,
        taskType: templateData.taskType
      });
      
      return template;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`Template with name "${templateData.name}" already exists`);
      }
      logger.error('Failed to create prompt template', { error, templateData });
      throw error;
    }
  }

  /**
   * Find template by ID
   */
  static async findById(id: string): Promise<PromptTemplate | null> {
    try {
      const result = await query(`
        SELECT * FROM prompt_templates WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToTemplate(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find template by ID', { error, templateId: id });
      throw error;
    }
  }

  /**
   * Find templates with filters
   */
  static async find(filters: TemplateFilters = {}): Promise<TemplateSummary[]> {
    const whereConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (filters.userId !== undefined) {
      whereConditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.category) {
      whereConditions.push(`category = $${paramIndex++}`);
      values.push(filters.category);
    }

    if (filters.genre) {
      whereConditions.push(`genre = $${paramIndex++}`);
      values.push(filters.genre);
    }

    if (filters.taskType) {
      whereConditions.push(`task_type = $${paramIndex++}`);
      values.push(filters.taskType);
    }

    if (filters.isPublic !== undefined) {
      whereConditions.push(`is_public = $${paramIndex++}`);
      values.push(filters.isPublic);
    }

    if (filters.isDefault !== undefined) {
      whereConditions.push(`is_default = $${paramIndex++}`);
      values.push(filters.isDefault);
    }

    // Include system templates if requested
    if (filters.includeSystem === false) {
      whereConditions.push(`user_id IS NOT NULL`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    try {
      const result = await query(`
        SELECT id, name, category, task_type, genre, is_public, is_default,
               usage_count, average_rating, user_id
        FROM prompt_templates 
        ${whereClause}
        ORDER BY is_default DESC, usage_count DESC, name ASC
      `, values);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category as TemplateCategory,
        taskType: row.task_type,
        genre: row.genre || undefined,
        isPublic: row.is_public,
        isDefault: row.is_default,
        usageCount: row.usage_count,
        averageRating: row.average_rating || undefined,
        isSystem: row.user_id === null,
      }));
    } catch (error) {
      logger.error('Failed to find templates', { error, filters });
      throw error;
    }
  }

  /**
   * Get default template for a task type
   */
  static async getDefault(taskType: string, userId?: string): Promise<PromptTemplate | null> {
    try {
      // First try user-specific default, then system default
      const result = await query(`
        SELECT * FROM prompt_templates 
        WHERE task_type = $1 AND is_default = true
        AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id DESC NULLS LAST
        LIMIT 1
      `, [taskType, userId || null]);

      return result.rows.length > 0 ? this.mapDatabaseRowToTemplate(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get default template', { error, taskType, userId });
      throw error;
    }
  }

  /**
   * Update template
   */
  static async update(id: string, updateData: UpdatePromptTemplateData): Promise<PromptTemplate | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Validate template variables if both content and variables are provided
    if (updateData.templateContent && updateData.variables) {
      if (!this.validateTemplateVariables(updateData.templateContent, updateData.variables)) {
        throw new Error('Template content must include all required variables');
      }
    }

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        if (key === 'variables') {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }
    });

    // If setting as default for a task type, unset other defaults
    if (updateData.isDefault === true) {
      const currentTemplate = await this.findById(id);
      if (currentTemplate) {
        await this.unsetTaskDefaults(currentTemplate.taskType, currentTemplate.userId);
      }
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE prompt_templates 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const template = this.mapDatabaseRowToTemplate(result.rows[0]);
      logger.info('Prompt template updated successfully', { templateId: id });
      
      return template;
    } catch (error) {
      logger.error('Failed to update template', { error, templateId: id });
      throw error;
    }
  }

  /**
   * Delete template
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM prompt_templates WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Prompt template deleted successfully', { templateId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete template', { error, templateId: id });
      throw error;
    }
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(id: string): Promise<void> {
    try {
      await query(`
        UPDATE prompt_templates 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [id]);
    } catch (error) {
      logger.error('Failed to increment template usage', { error, templateId: id });
      throw error;
    }
  }

  /**
   * Interpolate template variables with values
   */
  static interpolateTemplate(template: PromptTemplate, variables: Record<string, any>): string {
    let result = template.templateContent;

    // Replace each variable in the template
    template.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      let value = variables[variable.name];

      // Use default value if variable not provided and has default
      if (value === undefined && variable.defaultValue !== undefined) {
        value = variable.defaultValue;
      }

      // Validate required variables
      if (variable.required && (value === undefined || value === null)) {
        throw new Error(`Required variable "${variable.name}" is missing`);
      }

      // Convert value to string
      const stringValue = this.convertValueToString(value, variable.type);
      
      // Replace all occurrences of the placeholder
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
    });

    // Check for any remaining unreplaced variables
    const remainingVariables = result.match(/\{\{[^}]+\}\}/g);
    if (remainingVariables) {
      logger.warn('Template has unreplaced variables', { 
        templateId: template.id, 
        remainingVariables 
      });
    }

    return result;
  }

  /**
   * Validate template variables against content
   */
  static validateTemplateVariables(content: string, variables: TemplateVariable[]): boolean {
    // Extract all variable placeholders from content
    const placeholders = content.match(/\{\{[^}]+\}\}/g) || [];
    const placeholderNames = placeholders.map(p => p.slice(2, -2));

    // Check that all required variables are defined
    const definedVariables = variables.map(v => v.name);
    const requiredVariables = variables.filter(v => v.required).map(v => v.name);

    // All placeholders in content must have corresponding variable definitions
    for (const placeholderName of placeholderNames) {
      if (!definedVariables.includes(placeholderName)) {
        logger.error('Template variable not defined', { 
          placeholder: placeholderName,
          definedVariables
        });
        return false;
      }
    }

    // All required variables must be used in the template
    for (const requiredVar of requiredVariables) {
      if (!placeholderNames.includes(requiredVar)) {
        logger.error('Required variable not used in template', { 
          requiredVariable: requiredVar,
          usedVariables: placeholderNames
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get available task types by category
   */
  static getAvailableTaskTypes(): Record<TemplateCategory, string[]> {
    return {
      planning: [
        'story_outline',
        'chapter_breakdown',
        'character_development',
        'plot_structure',
        'world_building',
      ],
      chapter: [
        'chapter_generation',
        'scene_description',
        'dialogue_writing',
        'action_sequence',
        'transition_writing',
      ],
      character: [
        'character_creation',
        'character_dialogue',
        'character_development',
        'relationship_building',
        'character_voice',
      ],
      revision: [
        'content_review',
        'style_improvement',
        'consistency_check',
        'quality_assessment',
        'proofreading',
      ],
      export: [
        'format_conversion',
        'metadata_generation',
        'summary_creation',
        'blurb_writing',
        'marketing_copy',
      ],
    };
  }

  /**
   * Create system template (for seeding)
   */
  static async createSystemTemplate(templateData: Omit<CreatePromptTemplateData, 'userId'>): Promise<PromptTemplate> {
    return this.create({ ...templateData, userId: undefined });
  }

  /**
   * Convert value to string based on type
   */
  private static convertValueToString(value: any, type: string): string {
    if (value === undefined || value === null) {
      return '';
    }

    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return String(value);
      case 'boolean':
        return String(value);
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'object':
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      default:
        return String(value);
    }
  }

  /**
   * Unset default templates for a task type
   */
  private static async unsetTaskDefaults(taskType: string, userId?: string): Promise<void> {
    try {
      await query(`
        UPDATE prompt_templates 
        SET is_default = false, updated_at = NOW()
        WHERE task_type = $1 AND is_default = true 
        AND (user_id = $2 OR ($2 IS NULL AND user_id IS NULL))
      `, [taskType, userId || null]);
    } catch (error) {
      logger.error('Failed to unset task defaults', { error, taskType, userId });
      throw error;
    }
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      userId: 'user_id',
      taskType: 'task_type',
      templateContent: 'template_content',
      exampleOutput: 'example_output',
      isPublic: 'is_public',
      isDefault: 'is_default',
      usageCount: 'usage_count',
      averageRating: 'average_rating',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Parse JSON field safely
   */
  private static parseJsonField<T>(value: any): T {
    if (value === null || value === undefined) {
      return [] as T;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [] as T;
      }
    }
    
    return value;
  }

  /**
   * Map database row to PromptTemplate object
   */
  private static mapDatabaseRowToTemplate(row: any): PromptTemplate {
    return {
      id: row.id,
      userId: row.user_id || undefined,
      name: row.name,
      category: row.category as TemplateCategory,
      genre: row.genre || undefined,
      taskType: row.task_type,
      templateContent: row.template_content,
      variables: this.parseJsonField<TemplateVariable[]>(row.variables),
      exampleOutput: row.example_output || undefined,
      version: row.version,
      isPublic: row.is_public,
      isDefault: row.is_default,
      usageCount: row.usage_count,
      averageRating: row.average_rating || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}