import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';
import { encryptText, decryptText, maskApiKey } from '../lib/crypto';

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface ModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  contextWindow?: number;
  costPerToken?: number;
  description?: string;
}

export interface AIConfiguration {
  id: string;
  userId: string;
  name: string;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  isDefault: boolean;
  monthlyUsage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfigurationWithKeys extends AIConfiguration {
  apiKey: string; // This is the decrypted version, never stored
  maskedApiKey: string; // For display purposes
}

export interface CreateAIConfigData {
  userId: string;
  name: string;
  provider: AIProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  isDefault?: boolean;
}

export interface UpdateAIConfigData {
  name?: string;
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  isDefault?: boolean;
  monthlyUsage?: number;
  isActive?: boolean;
}

export interface AIConfigSummary {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  isDefault: boolean;
  monthlyUsage: number;
  maskedApiKey: string;
  isActive: boolean;
}

export class AIConfigModel {
  /**
   * Create a new AI configuration
   */
  static async create(configData: CreateAIConfigData): Promise<AIConfiguration> {
    const id = uuidv4();
    
    // Validate parameters
    if (!this.isValidTemperature(configData.temperature ?? 0.7)) {
      throw new Error('Temperature must be between 0 and 2');
    }

    if (!this.isValidProvider(configData.provider)) {
      throw new Error(`Invalid provider: ${configData.provider}`);
    }

    if (!this.isValidModelForProvider(configData.provider, configData.model)) {
      throw new Error(`Invalid model ${configData.model} for provider ${configData.provider}`);
    }

    // Encrypt API key
    const encryptedApiKey = encryptText(configData.apiKey);

    try {
      // If this is set as default, unset other defaults for this user
      if (configData.isDefault) {
        await this.unsetAllDefaults(configData.userId);
      }

      const result = await query(`
        INSERT INTO ai_configurations (
          id, user_id, name, provider, model, encrypted_api_key,
          temperature, max_tokens, top_p, frequency_penalty, 
          presence_penalty, is_default, monthly_usage, is_active,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING id, user_id, name, provider, model, temperature, max_tokens,
                  top_p, frequency_penalty, presence_penalty, is_default,
                  monthly_usage, is_active, created_at, updated_at
      `, [
        id,
        configData.userId,
        configData.name.trim(),
        configData.provider,
        configData.model,
        encryptedApiKey,
        configData.temperature ?? 0.7,
        configData.maxTokens ?? this.getDefaultMaxTokens(configData.provider, configData.model),
        configData.topP ?? 1.0,
        configData.frequencyPenalty ?? 0,
        configData.presencePenalty ?? 0,
        configData.isDefault ?? false,
        0, // initial monthly usage
        true, // initially active
      ]);

      const aiConfig = this.mapDatabaseRowToAIConfig(result.rows[0]);
      logger.info('AI configuration created successfully', { 
        configId: id, 
        userId: configData.userId,
        provider: configData.provider,
        model: configData.model
      });
      
      return aiConfig;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`AI configuration with name "${configData.name}" already exists for this user`);
      }
      logger.error('Failed to create AI configuration', { error, configData: { ...configData, apiKey: '[REDACTED]' } });
      throw error;
    }
  }

  /**
   * Find AI configuration by ID
   */
  static async findById(id: string): Promise<AIConfiguration | null> {
    try {
      const result = await query(`
        SELECT id, user_id, name, provider, model, temperature, max_tokens,
               top_p, frequency_penalty, presence_penalty, is_default,
               monthly_usage, is_active, created_at, updated_at
        FROM ai_configurations WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToAIConfig(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find AI configuration by ID', { error, configId: id });
      throw error;
    }
  }

  /**
   * Find AI configuration by ID with decrypted API key
   */
  static async findByIdWithKey(id: string): Promise<AIConfigurationWithKeys | null> {
    try {
      const result = await query(`
        SELECT * FROM ai_configurations WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const aiConfig = this.mapDatabaseRowToAIConfig(row);
      const decryptedApiKey = decryptText(row.encrypted_api_key);

      return {
        ...aiConfig,
        apiKey: decryptedApiKey,
        maskedApiKey: maskApiKey(decryptedApiKey),
      };
    } catch (error) {
      logger.error('Failed to find AI configuration with key', { error, configId: id });
      throw error;
    }
  }

  /**
   * Find all AI configurations for a user
   */
  static async findByUserId(userId: string): Promise<AIConfigSummary[]> {
    try {
      const result = await query(`
        SELECT id, name, provider, model, is_default, monthly_usage,
               encrypted_api_key, is_active
        FROM ai_configurations 
        WHERE user_id = $1 AND is_active = true
        ORDER BY is_default DESC, name ASC
      `, [userId]);

      return result.rows.map(row => {
        const decryptedApiKey = decryptText(row.encrypted_api_key);
        return {
          id: row.id,
          name: row.name,
          provider: row.provider as AIProvider,
          model: row.model,
          isDefault: row.is_default,
          monthlyUsage: row.monthly_usage,
          maskedApiKey: maskApiKey(decryptedApiKey),
          isActive: row.is_active,
        };
      });
    } catch (error) {
      logger.error('Failed to find AI configurations by user ID', { error, userId });
      throw error;
    }
  }

  /**
   * Get default AI configuration for a user
   */
  static async getDefault(userId: string): Promise<AIConfigurationWithKeys | null> {
    try {
      const result = await query(`
        SELECT * FROM ai_configurations 
        WHERE user_id = $1 AND is_default = true AND is_active = true
        LIMIT 1
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const aiConfig = this.mapDatabaseRowToAIConfig(row);
      const decryptedApiKey = decryptText(row.encrypted_api_key);

      return {
        ...aiConfig,
        apiKey: decryptedApiKey,
        maskedApiKey: maskApiKey(decryptedApiKey),
      };
    } catch (error) {
      logger.error('Failed to get default AI configuration', { error, userId });
      throw error;
    }
  }

  /**
   * Update AI configuration
   */
  static async update(id: string, updateData: UpdateAIConfigData): Promise<AIConfiguration | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Validate temperature if provided
    if (updateData.temperature !== undefined && !this.isValidTemperature(updateData.temperature)) {
      throw new Error('Temperature must be between 0 and 2');
    }

    // Validate provider and model if provided
    if (updateData.provider !== undefined && !this.isValidProvider(updateData.provider)) {
      throw new Error(`Invalid provider: ${updateData.provider}`);
    }

    if (updateData.provider && updateData.model && !this.isValidModelForProvider(updateData.provider, updateData.model)) {
      throw new Error(`Invalid model ${updateData.model} for provider ${updateData.provider}`);
    }

    // Handle API key encryption
    let encryptedApiKey: string | undefined;
    if (updateData.apiKey !== undefined) {
      encryptedApiKey = encryptText(updateData.apiKey);
      updates.push(`encrypted_api_key = $${paramIndex++}`);
      values.push(encryptedApiKey);
    }

    // Build dynamic update query for other fields
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'apiKey') {
        const dbField = this.getDbFieldName(key);
        updates.push(`${dbField} = $${paramIndex++}`);
        values.push(value);
      }
    });

    // If setting as default, unset other defaults for this user
    if (updateData.isDefault === true) {
      const currentConfig = await this.findById(id);
      if (currentConfig) {
        await this.unsetAllDefaults(currentConfig.userId);
      }
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE ai_configurations 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING id, user_id, name, provider, model, temperature, max_tokens,
                  top_p, frequency_penalty, presence_penalty, is_default,
                  monthly_usage, is_active, created_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const aiConfig = this.mapDatabaseRowToAIConfig(result.rows[0]);
      logger.info('AI configuration updated successfully', { configId: id });
      
      return aiConfig;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`AI configuration name already exists for this user`);
      }
      logger.error('Failed to update AI configuration', { error, configId: id });
      throw error;
    }
  }

  /**
   * Delete AI configuration (soft delete)
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE ai_configurations 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('AI configuration deleted successfully', { configId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete AI configuration', { error, configId: id });
      throw error;
    }
  }

  /**
   * Increment monthly usage
   */
  static async incrementUsage(id: string, tokens: number): Promise<void> {
    try {
      await query(`
        UPDATE ai_configurations 
        SET monthly_usage = monthly_usage + $1, updated_at = NOW()
        WHERE id = $2
      `, [tokens, id]);
    } catch (error) {
      logger.error('Failed to increment AI config usage', { error, configId: id, tokens });
      throw error;
    }
  }

  /**
   * Reset monthly usage for all configurations
   */
  static async resetMonthlyUsage(): Promise<number> {
    try {
      const result = await query(`
        UPDATE ai_configurations 
        SET monthly_usage = 0, updated_at = NOW()
        WHERE monthly_usage > 0
      `);

      const updatedCount = result.rowCount || 0;
      logger.info('Monthly AI usage reset', { configurationsUpdated: updatedCount });
      
      return updatedCount;
    } catch (error) {
      logger.error('Failed to reset monthly AI usage', { error });
      throw error;
    }
  }

  /**
   * Get available models for each provider
   */
  static getAvailableModels(): Record<AIProvider, ModelConfig[]> {
    return {
      openai: [
        { provider: 'openai', model: 'gpt-4o', maxTokens: 4096, contextWindow: 128000, description: 'Latest GPT-4o model' },
        { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 4096, contextWindow: 128000, description: 'Faster, cheaper GPT-4o' },
        { provider: 'openai', model: 'gpt-4-turbo', maxTokens: 4096, contextWindow: 128000, description: 'GPT-4 Turbo with vision' },
        { provider: 'openai', model: 'gpt-4', maxTokens: 4096, contextWindow: 8192, description: 'Standard GPT-4' },
        { provider: 'openai', model: 'gpt-3.5-turbo', maxTokens: 4096, contextWindow: 16385, description: 'Fast and efficient' },
      ],
      anthropic: [
        { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', maxTokens: 8192, contextWindow: 200000, description: 'Latest Claude 3.5 Sonnet' },
        { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', maxTokens: 8192, contextWindow: 200000, description: 'Latest Claude 3.5 Haiku' },
        { provider: 'anthropic', model: 'claude-3-opus-20240229', maxTokens: 4096, contextWindow: 200000, description: 'Most capable Claude model' },
        { provider: 'anthropic', model: 'claude-3-sonnet-20240229', maxTokens: 4096, contextWindow: 200000, description: 'Balanced Claude model' },
        { provider: 'anthropic', model: 'claude-3-haiku-20240307', maxTokens: 4096, contextWindow: 200000, description: 'Fastest Claude model' },
      ],
      google: [
        { provider: 'google', model: 'gemini-1.5-pro', maxTokens: 8192, contextWindow: 2000000, description: 'Most capable Gemini model' },
        { provider: 'google', model: 'gemini-1.5-flash', maxTokens: 8192, contextWindow: 1000000, description: 'Fast Gemini model' },
        { provider: 'google', model: 'gemini-pro', maxTokens: 4096, contextWindow: 32768, description: 'Standard Gemini model' },
      ],
    };
  }

  /**
   * Validate AI provider
   */
  static isValidProvider(provider: string): provider is AIProvider {
    return ['openai', 'anthropic', 'google'].includes(provider);
  }

  /**
   * Validate model for provider
   */
  static isValidModelForProvider(provider: AIProvider, model: string): boolean {
    const availableModels = this.getAvailableModels();
    return availableModels[provider].some(m => m.model === model);
  }

  /**
   * Validate temperature value
   */
  static isValidTemperature(temperature: number): boolean {
    return temperature >= 0 && temperature <= 2;
  }

  /**
   * Get default max tokens for provider and model
   */
  static getDefaultMaxTokens(provider: AIProvider, model: string): number {
    const availableModels = this.getAvailableModels();
    const modelConfig = availableModels[provider].find(m => m.model === model);
    return modelConfig?.maxTokens || 4000;
  }

  /**
   * Unset all default configurations for a user
   */
  private static async unsetAllDefaults(userId: string): Promise<void> {
    try {
      await query(`
        UPDATE ai_configurations 
        SET is_default = false, updated_at = NOW()
        WHERE user_id = $1 AND is_default = true
      `, [userId]);
    } catch (error) {
      logger.error('Failed to unset default AI configurations', { error, userId });
      throw error;
    }
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      userId: 'user_id',
      maxTokens: 'max_tokens',
      topP: 'top_p',
      frequencyPenalty: 'frequency_penalty',
      presencePenalty: 'presence_penalty',
      isDefault: 'is_default',
      monthlyUsage: 'monthly_usage',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Map database row to AIConfiguration object
   */
  private static mapDatabaseRowToAIConfig(row: any): AIConfiguration {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      provider: row.provider as AIProvider,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      topP: row.top_p,
      frequencyPenalty: row.frequency_penalty,
      presencePenalty: row.presence_penalty,
      isDefault: row.is_default,
      monthlyUsage: row.monthly_usage,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}