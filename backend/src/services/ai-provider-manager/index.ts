import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google-ai/generativelanguage';
import { logger } from '../../config/logger';
import { AIConfigModel, AIProvider, AIConfigurationWithKeys } from '../../models/ai-config.model';

export interface GenerationRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface GenerationResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: AIProvider;
  cost?: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call' | 'error';
}

export interface ProviderError {
  provider: AIProvider;
  model: string;
  error: string;
  retryable: boolean;
}

export class AIProviderManager {
  private openaiClients = new Map<string, OpenAI>();
  private anthropicClients = new Map<string, Anthropic>();
  private googleClients = new Map<string, GoogleGenerativeAI>();

  /**
   * Generate text using specified AI configuration
   */
  async generateText(
    prompt: string,
    aiConfigId?: string,
    userId?: string,
    fallbackEnabled = true
  ): Promise<GenerationResponse> {
    try {
      // Get AI configuration
      const config = await this.getAIConfiguration(aiConfigId, userId);
      if (!config) {
        throw new Error('No AI configuration found');
      }

      // Generate using primary configuration
      try {
        const response = await this.generateWithProvider(prompt, config);
        
        // Update usage statistics
        await AIConfigModel.incrementUsage(config.id, response.usage.totalTokens);
        
        return response;
      } catch (error) {
        logger.warn('Primary AI provider failed', {
          provider: config.provider,
          model: config.model,
          error: error.message
        });

        // If fallback is enabled, try alternative providers
        if (fallbackEnabled) {
          return await this.generateWithFallback(prompt, config, [config.provider]);
        }

        throw error;
      }

    } catch (error) {
      logger.error('AI text generation failed', { error, prompt: prompt.substring(0, 100) });
      throw error;
    }
  }

  /**
   * Generate text with automatic fallback to alternative providers
   */
  async generateWithFallback(
    prompt: string,
    primaryConfig: AIConfigurationWithKeys,
    excludeProviders: AIProvider[] = []
  ): Promise<GenerationResponse> {
    const errors: ProviderError[] = [];
    const fallbackOrder: AIProvider[] = ['openai', 'anthropic', 'google']
      .filter(provider => !excludeProviders.includes(provider));

    for (const provider of fallbackOrder) {
      try {
        // Get fallback configuration for this provider
        const fallbackConfigs = await AIConfigModel.findByUserId(primaryConfig.userId);
        const fallbackConfig = fallbackConfigs.find(c => c.provider === provider);

        if (!fallbackConfig) {
          errors.push({
            provider,
            model: 'unknown',
            error: 'No configuration available for provider',
            retryable: false
          });
          continue;
        }

        // Get full config with API key
        const fullConfig = await AIConfigModel.findByIdWithKey(fallbackConfig.id);
        if (!fullConfig) {
          continue;
        }

        logger.info('Attempting fallback provider', {
          provider,
          model: fullConfig.model,
          userId: primaryConfig.userId
        });

        const response = await this.generateWithProvider(prompt, fullConfig);

        // Update usage statistics
        await AIConfigModel.incrementUsage(fullConfig.id, response.usage.totalTokens);

        logger.info('Fallback provider succeeded', {
          provider,
          model: response.model,
          tokens: response.usage.totalTokens
        });

        return response;

      } catch (error) {
        logger.warn('Fallback provider failed', {
          provider,
          error: error.message
        });

        errors.push({
          provider,
          model: 'unknown',
          error: error.message,
          retryable: this.isRetryableError(error)
        });
      }
    }

    // All providers failed
    const errorMessage = `All AI providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`;
    throw new Error(errorMessage);
  }

  /**
   * Test AI configuration
   */
  async testConfiguration(configId: string): Promise<{
    success: boolean;
    provider: AIProvider;
    model: string;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const config = await AIConfigModel.findByIdWithKey(configId);
      if (!config) {
        throw new Error('Configuration not found');
      }

      const testPrompt = 'Respond with exactly: "API connection successful"';
      
      const response = await this.generateWithProvider(testPrompt, config);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        provider: config.provider,
        model: config.model,
        responseTime,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        provider: 'unknown' as AIProvider,
        model: 'unknown',
        responseTime,
        error: error.message,
      };
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: AIProvider, apiKey: string): Promise<string[]> {
    try {
      switch (provider) {
        case 'openai':
          return this.getOpenAIModels(apiKey);
        case 'anthropic':
          return this.getAnthropicModels();
        case 'google':
          return this.getGoogleModels();
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error('Failed to get available models', { provider, error });
      return [];
    }
  }

  /**
   * Generate text using specific provider
   */
  private async generateWithProvider(
    prompt: string,
    config: AIConfigurationWithKeys
  ): Promise<GenerationResponse> {
    switch (config.provider) {
      case 'openai':
        return await this.generateWithOpenAI(prompt, config);
      case 'anthropic':
        return await this.generateWithAnthropic(prompt, config);
      case 'google':
        return await this.generateWithGoogle(prompt, config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Generate text using OpenAI
   */
  private async generateWithOpenAI(
    prompt: string,
    config: AIConfigurationWithKeys
  ): Promise<GenerationResponse> {
    const client = this.getOpenAIClient(config.apiKey);

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No content generated from OpenAI');
    }

    return {
      content: choice.message.content,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model: config.model,
      provider: 'openai',
      cost: this.calculateCost('openai', config.model, response.usage?.total_tokens || 0),
      finishReason: this.mapFinishReason(choice.finish_reason),
    };
  }

  /**
   * Generate text using Anthropic
   */
  private async generateWithAnthropic(
    prompt: string,
    config: AIConfigurationWithKeys
  ): Promise<GenerationResponse> {
    const client = this.getAnthropicClient(config.apiKey);

    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return {
      content: content.text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: config.model,
      provider: 'anthropic',
      cost: this.calculateCost('anthropic', config.model, response.usage.input_tokens + response.usage.output_tokens),
      finishReason: this.mapFinishReason(response.stop_reason),
    };
  }

  /**
   * Generate text using Google
   */
  private async generateWithGoogle(
    prompt: string,
    config: AIConfigurationWithKeys
  ): Promise<GenerationResponse> {
    const client = this.getGoogleClient(config.apiKey);
    const model = client.getGenerativeModel({ model: config.model });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
      },
    });

    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error('No content generated from Google');
    }

    // Note: Google AI doesn't provide detailed usage metrics in the same way
    const estimatedTokens = Math.ceil((prompt.length + content.length) / 4);

    return {
      content,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: estimatedTokens,
      },
      model: config.model,
      provider: 'google',
      cost: this.calculateCost('google', config.model, estimatedTokens),
      finishReason: 'stop', // Google doesn't provide finish reason in the same format
    };
  }

  /**
   * Get OpenAI client (cached)
   */
  private getOpenAIClient(apiKey: string): OpenAI {
    if (!this.openaiClients.has(apiKey)) {
      this.openaiClients.set(apiKey, new OpenAI({ apiKey }));
    }
    return this.openaiClients.get(apiKey)!;
  }

  /**
   * Get Anthropic client (cached)
   */
  private getAnthropicClient(apiKey: string): Anthropic {
    if (!this.anthropicClients.has(apiKey)) {
      this.anthropicClients.set(apiKey, new Anthropic({ apiKey }));
    }
    return this.anthropicClients.get(apiKey)!;
  }

  /**
   * Get Google client (cached)
   */
  private getGoogleClient(apiKey: string): GoogleGenerativeAI {
    if (!this.googleClients.has(apiKey)) {
      this.googleClients.set(apiKey, new GoogleGenerativeAI(apiKey));
    }
    return this.googleClients.get(apiKey)!;
  }

  /**
   * Get AI configuration by ID or user's default
   */
  private async getAIConfiguration(
    aiConfigId?: string,
    userId?: string
  ): Promise<AIConfigurationWithKeys | null> {
    if (aiConfigId) {
      return await AIConfigModel.findByIdWithKey(aiConfigId);
    }

    if (userId) {
      return await AIConfigModel.getDefault(userId);
    }

    return null;
  }

  /**
   * Get available OpenAI models
   */
  private async getOpenAIModels(apiKey: string): Promise<string[]> {
    try {
      const client = this.getOpenAIClient(apiKey);
      const models = await client.models.list();
      
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      logger.error('Failed to fetch OpenAI models', { error });
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    }
  }

  /**
   * Get available Anthropic models
   */
  private getAnthropicModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  /**
   * Get available Google models
   */
  private getGoogleModels(): string[] {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro'
    ];
  }

  /**
   * Calculate estimated cost for API usage
   */
  private calculateCost(provider: AIProvider, model: string, tokens: number): number {
    // Simplified cost calculation - would need to be updated with actual pricing
    const rates = {
      openai: {
        'gpt-4o': 0.00003,
        'gpt-4o-mini': 0.000001,
        'gpt-4-turbo': 0.00003,
        'gpt-4': 0.00006,
        'gpt-3.5-turbo': 0.0000005,
      },
      anthropic: {
        'claude-3-5-sonnet-20241022': 0.000015,
        'claude-3-5-haiku-20241022': 0.0000008,
        'claude-3-opus-20240229': 0.000075,
        'claude-3-sonnet-20240229': 0.000015,
        'claude-3-haiku-20240307': 0.0000008,
      },
      google: {
        'gemini-1.5-pro': 0.0000035,
        'gemini-1.5-flash': 0.00000035,
        'gemini-pro': 0.0000005,
      }
    };

    const rate = rates[provider]?.[model] || 0.00001;
    return tokens * rate;
  }

  /**
   * Map provider-specific finish reasons to standard format
   */
  private mapFinishReason(reason: any): GenerationResponse['finishReason'] {
    if (!reason) return 'stop';

    const reasonStr = String(reason).toLowerCase();

    if (reasonStr.includes('stop') || reasonStr.includes('end_turn')) return 'stop';
    if (reasonStr.includes('length') || reasonStr.includes('max_tokens')) return 'length';
    if (reasonStr.includes('content') || reasonStr.includes('filter')) return 'content_filter';
    if (reasonStr.includes('function') || reasonStr.includes('tool')) return 'function_call';

    return 'stop';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Retryable errors
    if (message.includes('timeout')) return true;
    if (message.includes('rate limit')) return true;
    if (message.includes('service unavailable')) return true;
    if (message.includes('internal server error')) return true;
    if (message.includes('502') || message.includes('503') || message.includes('504')) return true;

    // Non-retryable errors
    if (message.includes('invalid api key')) return false;
    if (message.includes('unauthorized')) return false;
    if (message.includes('forbidden')) return false;
    if (message.includes('not found')) return false;
    if (message.includes('bad request')) return false;

    // Default to retryable for unknown errors
    return true;
  }
}