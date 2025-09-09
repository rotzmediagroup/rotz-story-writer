import { logger } from '../../config/logger';
import { PromptTemplateModel, PromptTemplate, TemplateVariable, TemplateCategory } from '../../models/prompt-template.model';

export interface TemplateContext {
  story?: {
    id: string;
    title: string;
    premise: string;
    genre: string;
    tone?: string;
    writingStyle?: string;
    pov?: string;
    tense?: string;
    targetLength: number;
    actualLength: number;
  };
  plan?: {
    totalChapters: number;
    actStructure: any;
    chapterSummaries: any[];
  };
  chapter?: {
    number: number;
    title?: string;
    summary?: string;
    targetWordCount?: number;
    previousContext?: string;
    nextContext?: string;
  };
  characters?: Array<{
    name: string;
    role: string;
    description?: string;
    backstory?: string;
    goal?: string;
  }>;
  customInstructions?: string;
  metadata?: Record<string, any>;
}

export interface BuiltTemplate {
  content: string;
  variables: Record<string, any>;
  template: PromptTemplate;
  validationErrors: string[];
}

export class PromptTemplateService {
  /**
   * Get template for task type with fallback
   */
  async getTemplateForTask(
    taskType: string,
    userId?: string,
    genre?: string
  ): Promise<PromptTemplate | null> {
    try {
      // Try user-specific template first
      if (userId) {
        const userTemplate = await PromptTemplateModel.getDefault(taskType, userId);
        if (userTemplate && this.isTemplateApplicable(userTemplate, genre)) {
          return userTemplate;
        }
      }

      // Fallback to system template
      const systemTemplate = await PromptTemplateModel.getDefault(taskType);
      if (systemTemplate && this.isTemplateApplicable(systemTemplate, genre)) {
        return systemTemplate;
      }

      logger.warn('No template found for task type', { taskType, userId, genre });
      return null;

    } catch (error) {
      logger.error('Failed to get template for task', { error, taskType, userId });
      return null;
    }
  }

  /**
   * Build template with context
   */
  async buildTemplate(
    template: PromptTemplate,
    context: TemplateContext
  ): Promise<BuiltTemplate> {
    try {
      // Extract variables from context
      const variables = this.extractVariables(template, context);
      
      // Validate required variables
      const validationErrors = this.validateVariables(template, variables);

      // Build template content
      let content = template.templateContent;
      
      // Replace variables in template
      for (const variable of template.variables) {
        const value = variables[variable.name];
        const placeholder = `{{${variable.name}}}`;
        
        if (value !== undefined && value !== null) {
          const stringValue = this.convertValueToString(value, variable.type);
          content = content.replace(new RegExp(this.escapeRegex(placeholder), 'g'), stringValue);
        } else if (variable.defaultValue !== undefined) {
          const defaultValue = this.convertValueToString(variable.defaultValue, variable.type);
          content = content.replace(new RegExp(this.escapeRegex(placeholder), 'g'), defaultValue);
        }
      }

      // Check for unreplaced variables
      const unreplacedVars = content.match(/\{\{[^}]+\}\}/g);
      if (unreplacedVars) {
        validationErrors.push(`Unreplaced variables found: ${unreplacedVars.join(', ')}`);
      }

      // Increment template usage
      await PromptTemplateModel.incrementUsage(template.id);

      return {
        content,
        variables,
        template,
        validationErrors,
      };

    } catch (error) {
      logger.error('Failed to build template', { error, templateId: template.id });
      throw error;
    }
  }

  /**
   * Create system template for seeding
   */
  async createSystemTemplate(
    name: string,
    category: TemplateCategory,
    taskType: string,
    templateContent: string,
    variables: TemplateVariable[],
    options: {
      genre?: string;
      exampleOutput?: string;
      isDefault?: boolean;
    } = {}
  ): Promise<PromptTemplate> {
    try {
      return await PromptTemplateModel.createSystemTemplate({
        name,
        category,
        taskType,
        templateContent,
        variables,
        genre: options.genre,
        exampleOutput: options.exampleOutput,
        isDefault: options.isDefault || false,
        isPublic: true,
      });
    } catch (error) {
      logger.error('Failed to create system template', { error, name, taskType });
      throw error;
    }
  }

  /**
   * Seed default templates
   */
  async seedDefaultTemplates(): Promise<void> {
    logger.info('Seeding default prompt templates');

    const templates = [
      // Story Planning Templates
      {
        name: 'Story Outline Generator',
        category: 'planning' as TemplateCategory,
        taskType: 'story_outline',
        templateContent: `Create a detailed story outline for "{{storyTitle}}" in the {{genre}} genre.

Story Premise: {{storyPremise}}
Target Length: {{targetLength}} words
Target Audience: {{targetAgeGroup}}
Content Rating: {{contentRating}}
Tone: {{tone}}

Please provide:
1. Three-act structure breakdown
2. Major plot points and turning points
3. Character arcs for main characters
4. Thematic elements
5. Estimated chapter count (aim for {{estimatedChapters}} chapters)

Focus on {{themes}} themes and maintain a {{tone}} tone throughout.`,
        variables: [
          { name: 'storyTitle', type: 'string', description: 'Title of the story', required: true },
          { name: 'genre', type: 'string', description: 'Story genre', required: true },
          { name: 'storyPremise', type: 'string', description: 'Brief story premise', required: true },
          { name: 'targetLength', type: 'number', description: 'Target word count', required: true },
          { name: 'targetAgeGroup', type: 'string', description: 'Target age group', required: false, defaultValue: 'Adult' },
          { name: 'contentRating', type: 'string', description: 'Content rating', required: false, defaultValue: 'PG' },
          { name: 'tone', type: 'string', description: 'Story tone', required: false, defaultValue: 'engaging' },
          { name: 'themes', type: 'array', description: 'Story themes', required: false, defaultValue: [] },
          { name: 'estimatedChapters', type: 'number', description: 'Estimated chapter count', required: false, defaultValue: 10 },
        ],
        isDefault: true,
      },

      // Chapter Generation Template
      {
        name: 'Chapter Generator',
        category: 'chapter' as TemplateCategory,
        taskType: 'chapter_generation',
        templateContent: `Write Chapter {{chapterNumber}} of "{{storyTitle}}" titled "{{chapterTitle}}".

STORY CONTEXT:
Genre: {{genre}}
Tone: {{tone}}
Writing Style: {{writingStyle}}
Point of View: {{pov}}
Tense: {{tense}}

CHAPTER DETAILS:
Target Word Count: {{targetWordCount}} words
Chapter Summary: {{chapterSummary}}

CHARACTERS:
{{characters}}

STORY CONTEXT:
Previous Context:
{{previousContext}}

Upcoming Context:
{{nextContext}}

{{#if customInstructions}}
SPECIAL INSTRUCTIONS:
{{customInstructions}}
{{/if}}

Write the complete chapter content. Focus on:
1. Advancing the plot as outlined in the chapter summary
2. Developing characters naturally
3. Maintaining consistent tone and style
4. Creating engaging dialogue and description
5. Building towards the next chapter

The chapter should be approximately {{targetWordCount}} words and written in {{pov}} point of view using {{tense}} tense.`,
        variables: [
          { name: 'chapterNumber', type: 'number', description: 'Chapter number', required: true },
          { name: 'storyTitle', type: 'string', description: 'Story title', required: true },
          { name: 'chapterTitle', type: 'string', description: 'Chapter title', required: false },
          { name: 'genre', type: 'string', description: 'Story genre', required: true },
          { name: 'tone', type: 'string', description: 'Story tone', required: false, defaultValue: 'engaging' },
          { name: 'writingStyle', type: 'string', description: 'Writing style', required: false, defaultValue: 'descriptive' },
          { name: 'pov', type: 'string', description: 'Point of view', required: false, defaultValue: 'Third Limited' },
          { name: 'tense', type: 'string', description: 'Narrative tense', required: false, defaultValue: 'Past' },
          { name: 'targetWordCount', type: 'number', description: 'Target word count', required: false, defaultValue: 2000 },
          { name: 'chapterSummary', type: 'string', description: 'Chapter summary/outline', required: true },
          { name: 'characters', type: 'string', description: 'Character descriptions', required: false, defaultValue: '' },
          { name: 'previousContext', type: 'string', description: 'Previous chapter context', required: false, defaultValue: '' },
          { name: 'nextContext', type: 'string', description: 'Upcoming chapter context', required: false, defaultValue: '' },
          { name: 'customInstructions', type: 'string', description: 'Custom instructions', required: false, defaultValue: '' },
        ],
        isDefault: true,
      },

      // Character Development Template
      {
        name: 'Character Creator',
        category: 'character' as TemplateCategory,
        taskType: 'character_creation',
        templateContent: `Create a detailed character profile for the {{role}} character in "{{storyTitle}}" ({{genre}} genre).

CHARACTER REQUIREMENTS:
Name: {{characterName}}
Role: {{role}}
Archetype: {{archetype}}

STORY CONTEXT:
{{storyPremise}}

Please provide:

1. PHYSICAL DESCRIPTION:
   - Age, gender, physical appearance
   - Distinctive features or characteristics
   - Style of dress and demeanor

2. PERSONALITY:
   - Core personality traits
   - Strengths and weaknesses  
   - Fears, desires, and motivations
   - Speech patterns and mannerisms

3. BACKGROUND:
   - Personal history and backstory
   - Family, education, career
   - Formative experiences

4. CHARACTER ARC:
   - Initial state and goals
   - Internal conflicts and flaws to overcome
   - Growth trajectory throughout the story
   - Relationship to main plot and themes

5. RELATIONSHIPS:
   - Key relationships with other characters
   - How they interact with the protagonist

Make the character three-dimensional, relatable, and appropriate for the {{genre}} genre with a {{tone}} tone.`,
        variables: [
          { name: 'storyTitle', type: 'string', description: 'Story title', required: true },
          { name: 'genre', type: 'string', description: 'Story genre', required: true },
          { name: 'tone', type: 'string', description: 'Story tone', required: false, defaultValue: 'engaging' },
          { name: 'characterName', type: 'string', description: 'Character name', required: true },
          { name: 'role', type: 'string', description: 'Character role', required: true },
          { name: 'archetype', type: 'string', description: 'Character archetype', required: false, defaultValue: 'Hero' },
          { name: 'storyPremise', type: 'string', description: 'Story premise', required: true },
        ],
        isDefault: true,
      },

      // Content Review Template
      {
        name: 'Content Reviewer',
        category: 'revision' as TemplateCategory,
        taskType: 'content_review',
        templateContent: `Review and analyze the following chapter content for "{{storyTitle}}" (Chapter {{chapterNumber}}).

CHAPTER CONTENT:
{{chapterContent}}

EVALUATION CRITERIA:
1. Plot advancement and pacing
2. Character development and consistency
3. Dialogue quality and authenticity
4. Setting and atmosphere
5. Writing style and tone consistency
6. Grammar and technical issues

STORY CONTEXT:
Genre: {{genre}}
Tone: {{tone}}
Target Audience: {{targetAgeGroup}}
POV: {{pov}}
Tense: {{tense}}

Please provide:

1. STRENGTHS:
   - What works well in this chapter
   - Effective scenes and moments
   - Strong character interactions

2. AREAS FOR IMPROVEMENT:
   - Pacing issues
   - Character inconsistencies
   - Plot holes or logic issues
   - Dialogue improvements needed

3. TECHNICAL ISSUES:
   - Grammar and syntax errors
   - POV slips
   - Tense inconsistencies

4. SUGGESTIONS:
   - Specific recommendations for improvement
   - Alternative approaches to consider
   - Additional content needed

5. OVERALL RATING: (1-10 scale)
   - Plot: _/10
   - Characters: _/10  
   - Dialogue: _/10
   - Pacing: _/10
   - Style: _/10

Provide constructive feedback to help improve the chapter quality.`,
        variables: [
          { name: 'storyTitle', type: 'string', description: 'Story title', required: true },
          { name: 'chapterNumber', type: 'number', description: 'Chapter number', required: true },
          { name: 'chapterContent', type: 'string', description: 'Chapter content to review', required: true },
          { name: 'genre', type: 'string', description: 'Story genre', required: true },
          { name: 'tone', type: 'string', description: 'Story tone', required: false, defaultValue: 'engaging' },
          { name: 'targetAgeGroup', type: 'string', description: 'Target age group', required: false, defaultValue: 'Adult' },
          { name: 'pov', type: 'string', description: 'Point of view', required: false, defaultValue: 'Third Limited' },
          { name: 'tense', type: 'string', description: 'Narrative tense', required: false, defaultValue: 'Past' },
        ],
        isDefault: true,
      },
    ];

    for (const templateData of templates) {
      try {
        await this.createSystemTemplate(
          templateData.name,
          templateData.category,
          templateData.taskType,
          templateData.templateContent,
          templateData.variables,
          { isDefault: templateData.isDefault }
        );
        
        logger.info('Seeded template', { name: templateData.name, taskType: templateData.taskType });
      } catch (error) {
        // Template might already exist
        logger.warn('Failed to seed template (may already exist)', { 
          name: templateData.name, 
          error: error.message 
        });
      }
    }

    logger.info('Default templates seeding completed');
  }

  /**
   * Extract variables from context
   */
  private extractVariables(template: PromptTemplate, context: TemplateContext): Record<string, any> {
    const variables: Record<string, any> = {};

    // Map context to template variables
    for (const variable of template.variables) {
      const value = this.getVariableValue(variable.name, context);
      if (value !== undefined) {
        variables[variable.name] = value;
      }
    }

    return variables;
  }

  /**
   * Get variable value from context
   */
  private getVariableValue(variableName: string, context: TemplateContext): any {
    // Direct mapping of common variables
    const mappings: Record<string, () => any> = {
      storyTitle: () => context.story?.title,
      storyPremise: () => context.story?.premise,
      genre: () => context.story?.genre,
      tone: () => context.story?.tone,
      writingStyle: () => context.story?.writingStyle,
      pov: () => context.story?.pov,
      tense: () => context.story?.tense,
      targetLength: () => context.story?.targetLength,
      actualLength: () => context.story?.actualLength,
      
      chapterNumber: () => context.chapter?.number,
      chapterTitle: () => context.chapter?.title,
      chapterSummary: () => context.chapter?.summary,
      targetWordCount: () => context.chapter?.targetWordCount,
      previousContext: () => context.chapter?.previousContext,
      nextContext: () => context.chapter?.nextContext,
      
      totalChapters: () => context.plan?.totalChapters,
      estimatedChapters: () => context.plan?.totalChapters,
      
      characters: () => context.characters?.map(c => 
        `${c.name} (${c.role}): ${c.description || 'No description'}`
      ).join('\n'),
      
      customInstructions: () => context.customInstructions,
    };

    if (mappings[variableName]) {
      return mappings[variableName]();
    }

    // Check metadata
    if (context.metadata?.[variableName] !== undefined) {
      return context.metadata[variableName];
    }

    return undefined;
  }

  /**
   * Validate template variables
   */
  private validateVariables(template: PromptTemplate, variables: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${variable.name}' is missing or empty`);
        continue;
      }

      // Skip validation if value is undefined/null and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateVariableType(value, variable.type)) {
        errors.push(`Variable '${variable.name}' has incorrect type. Expected ${variable.type}, got ${typeof value}`);
      }

      // Additional validation rules
      if (variable.validation) {
        const validationErrors = this.validateVariableConstraints(variable.name, value, variable.validation);
        errors.push(...validationErrors);
      }
    }

    return errors;
  }

  /**
   * Validate variable type
   */
  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate variable constraints
   */
  private validateVariableConstraints(name: string, value: any, validation: any): string[] {
    const errors: string[] = [];

    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      errors.push(`Variable '${name}' is too short. Minimum length: ${validation.minLength}`);
    }

    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      errors.push(`Variable '${name}' is too long. Maximum length: ${validation.maxLength}`);
    }

    if (validation.min && typeof value === 'number' && value < validation.min) {
      errors.push(`Variable '${name}' is too small. Minimum value: ${validation.min}`);
    }

    if (validation.max && typeof value === 'number' && value > validation.max) {
      errors.push(`Variable '${name}' is too large. Maximum value: ${validation.max}`);
    }

    if (validation.enum && !validation.enum.includes(value)) {
      errors.push(`Variable '${name}' has invalid value. Allowed values: ${validation.enum.join(', ')}`);
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push(`Variable '${name}' does not match required pattern`);
      }
    }

    return errors;
  }

  /**
   * Check if template is applicable for genre
   */
  private isTemplateApplicable(template: PromptTemplate, genre?: string): boolean {
    if (!template.genre || !genre) {
      return true; // Generic template or no genre specified
    }
    return template.genre === genre;
  }

  /**
   * Convert value to string for template replacement
   */
  private convertValueToString(value: any, type: string): string {
    if (value === undefined || value === null) {
      return '';
    }

    switch (type) {
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'object':
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}