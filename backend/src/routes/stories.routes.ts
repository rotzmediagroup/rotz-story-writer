import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { storyService } from '../services/story.service';
import { validation, handleValidationErrors, rateLimitValidation } from '../middleware/validation.middleware';
import { authenticate, AuthenticatedRequest, requireSubscription } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Rate limiting
const apiLimiter = rateLimit(rateLimitValidation.api);
const generationLimiter = rateLimit(rateLimitValidation.generation);

/**
 * GET /stories
 * Get list of user's stories with filtering and pagination
 */
router.get('/',
  authenticate,
  apiLimiter,
  validation.pagination,
  validation.searchStories,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        limit = 20,
        offset = 0,
        q: search,
        genre,
        status,
        sortBy,
        sortOrder
      } = req.query;

      const result = await storyService.getStories({
        userId: req.user!.userId,
        search: search as string,
        genre: genre as any,
        status: status as any,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: result,
        meta: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.total,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      logger.error('Failed to get stories via API', { error, userId: req.user?.userId });
      
      res.status(500).json({
        error: 'Failed to get stories',
        message: 'An error occurred while retrieving stories'
      });
    }
  }
);

/**
 * POST /stories
 * Create a new story
 */
router.post('/',
  authenticate,
  apiLimiter,
  validation.createStory,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const storyData = req.body;
      const storyId = await storyService.createStory(req.user!.userId, storyData);

      logger.info('Story created via API', {
        userId: req.user!.userId,
        storyId,
        title: storyData.title
      });

      res.status(201).json({
        success: true,
        message: 'Story created successfully',
        data: { storyId }
      });

    } catch (error) {
      logger.error('Story creation failed via API', { error, userId: req.user?.userId });
      
      if (error.message.includes('limit')) {
        return res.status(403).json({
          error: 'Subscription limit reached',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Story creation failed',
        message: error.message
      });
    }
  }
);

/**
 * GET /stories/genres
 * Get available story genres
 */
router.get('/genres',
  async (req, res) => {
    try {
      const genres = storyService.getAvailableGenres();

      res.json({
        success: true,
        data: { genres }
      });

    } catch (error) {
      logger.error('Failed to get genres via API', { error });
      
      res.status(500).json({
        error: 'Failed to get genres',
        message: 'An error occurred while retrieving genres'
      });
    }
  }
);

/**
 * GET /stories/search
 * Search stories
 */
router.get('/search',
  authenticate,
  apiLimiter,
  validation.pagination,
  validation.searchStories,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        q: query,
        genre,
        status,
        limit = 20,
        offset = 0
      } = req.query;

      if (!query) {
        return res.status(400).json({
          error: 'Search query required',
          message: 'Please provide a search query'
        });
      }

      const result = await storyService.searchStories(req.user!.userId, query as string, {
        genre: genre as any,
        status: status as any,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: result,
        meta: {
          query,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.total,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      logger.error('Story search failed via API', { error, userId: req.user?.userId });
      
      res.status(500).json({
        error: 'Search failed',
        message: 'An error occurred while searching stories'
      });
    }
  }
);

/**
 * GET /stories/:storyId
 * Get story by ID with full details
 */
router.get('/:storyId',
  authenticate,
  apiLimiter,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const story = await storyService.getStoryById(storyId, req.user!.userId);

      if (!story) {
        return res.status(404).json({
          error: 'Story not found',
          message: 'The requested story could not be found'
        });
      }

      res.json({
        success: true,
        data: { story }
      });

    } catch (error) {
      logger.error('Failed to get story via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this story'
        });
      }

      res.status(500).json({
        error: 'Failed to get story',
        message: 'An error occurred while retrieving the story'
      });
    }
  }
);

/**
 * PUT /stories/:storyId
 * Update story
 */
router.put('/:storyId',
  authenticate,
  apiLimiter,
  validation.uuid('storyId'),
  validation.updateStory,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const updates = req.body;

      const updatedStory = await storyService.updateStory(storyId, req.user!.userId, updates);

      logger.info('Story updated via API', {
        userId: req.user!.userId,
        storyId,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'Story updated successfully',
        data: { story: updatedStory }
      });

    } catch (error) {
      logger.error('Story update failed via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Story update failed',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /stories/:storyId
 * Delete story
 */
router.delete('/:storyId',
  authenticate,
  apiLimiter,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      await storyService.deleteStory(storyId, req.user!.userId);

      logger.info('Story deleted via API', {
        userId: req.user!.userId,
        storyId
      });

      res.json({
        success: true,
        message: 'Story deleted successfully'
      });

    } catch (error) {
      logger.error('Story deletion failed via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Story deletion failed',
        message: 'An error occurred while deleting the story'
      });
    }
  }
);

/**
 * POST /stories/:storyId/plan
 * Generate story plan
 */
router.post('/:storyId/plan',
  authenticate,
  generationLimiter,
  validation.uuid('storyId'),
  validation.generatePlan,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const planData = req.body;

      const plan = await storyService.generateStoryPlan(storyId, req.user!.userId, planData);

      logger.info('Story plan generated via API', {
        userId: req.user!.userId,
        storyId
      });

      res.json({
        success: true,
        message: 'Story plan generated successfully',
        data: { plan }
      });

    } catch (error) {
      logger.error('Story plan generation failed via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      if (error.message.includes('planning status')) {
        return res.status(400).json({
          error: 'Invalid story status',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Plan generation failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /stories/:storyId/generate
 * Start story generation
 */
router.post('/:storyId/generate',
  authenticate,
  generationLimiter,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      await storyService.startGeneration(storyId, req.user!.userId);

      logger.info('Story generation started via API', {
        userId: req.user!.userId,
        storyId
      });

      res.json({
        success: true,
        message: 'Story generation started successfully'
      });

    } catch (error) {
      logger.error('Story generation start failed via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      if (error.message.includes('planned')) {
        return res.status(400).json({
          error: 'Story not ready for generation',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Generation start failed',
        message: error.message
      });
    }
  }
);

/**
 * GET /stories/:storyId/statistics
 * Get story statistics
 */
router.get('/:storyId/statistics',
  authenticate,
  apiLimiter,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const statistics = await storyService.getStoryStatistics(storyId, req.user!.userId);

      res.json({
        success: true,
        data: { statistics }
      });

    } catch (error) {
      logger.error('Failed to get story statistics via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get statistics',
        message: 'An error occurred while retrieving story statistics'
      });
    }
  }
);

/**
 * POST /stories/:storyId/export
 * Export story
 */
router.post('/:storyId/export',
  authenticate,
  apiLimiter,
  validation.uuid('storyId'),
  validation.exportStory,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const { format, options = {} } = req.body;

      const exportId = await storyService.exportStory(storyId, req.user!.userId, format, options);

      logger.info('Story export requested via API', {
        userId: req.user!.userId,
        storyId,
        format,
        exportId
      });

      res.json({
        success: true,
        message: 'Export started successfully',
        data: { exportId }
      });

    } catch (error) {
      logger.error('Story export failed via API', { error, storyId: req.params.storyId, userId: req.user?.userId });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      if (error.message.includes('limit')) {
        return res.status(403).json({
          error: 'Export limit reached',
          message: error.message
        });
      }

      if (error.message.includes('planning')) {
        return res.status(400).json({
          error: 'Story not ready for export',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Export failed',
        message: error.message
      });
    }
  }
);

export default router;