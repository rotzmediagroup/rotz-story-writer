import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { userService } from '../services/user.service';
import { validation, handleValidationErrors, rateLimitValidation } from '../middleware/validation.middleware';
import { authenticate, AuthenticatedRequest, requireSubscription } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Rate limiting
const apiLimiter = rateLimit(rateLimitValidation.api);

/**
 * GET /ai-config
 * Get user's AI configurations
 */
router.get('/',
  authenticate,
  apiLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const configurations = await userService.getAIConfigurations(req.user!.userId);

      res.json({
        success: true,
        data: { configurations }
      });

    } catch (error) {
      logger.error('Failed to get AI configurations via API', { error, userId: req.user?.userId });
      
      res.status(500).json({
        error: 'Failed to get configurations',
        message: 'An error occurred while retrieving AI configurations'
      });
    }
  }
);

/**
 * POST /ai-config
 * Add new AI configuration
 */
router.post('/',
  authenticate,
  apiLimiter,
  validation.createAIConfig,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const configData = req.body;
      const configId = await userService.addAIConfiguration(req.user!.userId, configData);

      logger.info('AI configuration added via API', {
        userId: req.user!.userId,
        configId,
        provider: configData.provider
      });

      res.status(201).json({
        success: true,
        message: 'AI configuration added successfully',
        data: { configId }
      });

    } catch (error) {
      logger.error('AI configuration creation failed via API', { error, userId: req.user?.userId });
      
      res.status(400).json({
        error: 'Configuration creation failed',
        message: error.message
      });
    }
  }
);

/**
 * PUT /ai-config/:configId
 * Update AI configuration
 */
router.put('/:configId',
  authenticate,
  apiLimiter,
  validation.uuid('configId'),
  validation.updateAIConfig,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { configId } = req.params;
      const updates = req.body;

      await userService.updateAIConfiguration(req.user!.userId, configId, updates);

      logger.info('AI configuration updated via API', {
        userId: req.user!.userId,
        configId,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'AI configuration updated successfully'
      });

    } catch (error) {
      logger.error('AI configuration update failed via API', { 
        error, 
        configId: req.params.configId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Configuration update failed',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /ai-config/:configId
 * Delete AI configuration
 */
router.delete('/:configId',
  authenticate,
  apiLimiter,
  validation.uuid('configId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { configId } = req.params;
      await userService.deleteAIConfiguration(req.user!.userId, configId);

      logger.info('AI configuration deleted via API', {
        userId: req.user!.userId,
        configId
      });

      res.json({
        success: true,
        message: 'AI configuration deleted successfully'
      });

    } catch (error) {
      logger.error('AI configuration deletion failed via API', { 
        error, 
        configId: req.params.configId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message
        });
      }

      if (error.message.includes('only AI configuration')) {
        return res.status(400).json({
          error: 'Cannot delete configuration',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Configuration deletion failed',
        message: 'An error occurred while deleting the configuration'
      });
    }
  }
);

/**
 * PUT /ai-config/:configId/default
 * Set default AI configuration
 */
router.put('/:configId/default',
  authenticate,
  apiLimiter,
  validation.uuid('configId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { configId } = req.params;
      await userService.setDefaultAIConfiguration(req.user!.userId, configId);

      logger.info('Default AI configuration set via API', {
        userId: req.user!.userId,
        configId
      });

      res.json({
        success: true,
        message: 'Default AI configuration set successfully'
      });

    } catch (error) {
      logger.error('Failed to set default AI configuration via API', { 
        error, 
        configId: req.params.configId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to set default',
        message: 'An error occurred while setting the default configuration'
      });
    }
  }
);

/**
 * POST /ai-config/:configId/test
 * Test AI configuration
 */
router.post('/:configId/test',
  authenticate,
  apiLimiter,
  validation.uuid('configId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { configId } = req.params;
      const testResult = await userService.testAIConfiguration(req.user!.userId, configId);

      logger.info('AI configuration tested via API', {
        userId: req.user!.userId,
        configId,
        success: testResult.success,
        responseTime: testResult.responseTime
      });

      res.json({
        success: true,
        data: { testResult }
      });

    } catch (error) {
      logger.error('AI configuration test failed via API', { 
        error, 
        configId: req.params.configId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Configuration test failed',
        message: error.message
      });
    }
  }
);

/**
 * GET /ai-config/providers
 * Get available AI providers and their models
 */
router.get('/providers',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Import AIProviderManager to get available models
      const { AIProviderManager } = await import('../services/ai-provider-manager');
      const aiManager = new AIProviderManager();

      const providers = {
        openai: {
          name: 'OpenAI',
          models: await aiManager.getAvailableModels('openai', 'test-key').catch(() => [
            'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'
          ])
        },
        anthropic: {
          name: 'Anthropic',
          models: await aiManager.getAvailableModels('anthropic', 'test-key').catch(() => [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
          ])
        },
        google: {
          name: 'Google',
          models: await aiManager.getAvailableModels('google', 'test-key').catch(() => [
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-pro'
          ])
        }
      };

      res.json({
        success: true,
        data: { providers }
      });

    } catch (error) {
      logger.error('Failed to get AI providers via API', { error });
      
      res.status(500).json({
        error: 'Failed to get providers',
        message: 'An error occurred while retrieving AI providers'
      });
    }
  }
);

/**
 * GET /ai-config/:configId/models
 * Get available models for a specific configuration's provider
 */
router.get('/:configId/models',
  authenticate,
  requireSubscription('premium'),
  validation.uuid('configId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { configId } = req.params;
      
      // This endpoint could fetch models using the actual API key
      // For now, we'll return the static list
      const { AIProviderManager } = await import('../services/ai-provider-manager');
      const aiManager = new AIProviderManager();

      // Get the configuration to determine provider
      const configurations = await userService.getAIConfigurations(req.user!.userId);
      const config = configurations.find(c => c.id === configId);
      
      if (!config) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: 'The requested AI configuration could not be found'
        });
      }

      const models = await aiManager.getAvailableModels(config.provider, 'test-key').catch(() => []);

      res.json({
        success: true,
        data: { 
          provider: config.provider,
          models 
        }
      });

    } catch (error) {
      logger.error('Failed to get models for configuration via API', { 
        error, 
        configId: req.params.configId, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        error: 'Failed to get models',
        message: 'An error occurred while retrieving available models'
      });
    }
  }
);

export default router;