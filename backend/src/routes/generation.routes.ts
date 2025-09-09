import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generationService } from '../services/generation.service';
import { validation, handleValidationErrors, rateLimitValidation } from '../middleware/validation.middleware';
import { authenticate, AuthenticatedRequest, requireSubscription } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Strict rate limiting for generation endpoints
const generationLimiter = rateLimit(rateLimitValidation.generation);

/**
 * POST /generation/chapter/:chapterId
 * Generate a single chapter
 */
router.post('/chapter/:chapterId',
  authenticate,
  generationLimiter,
  validation.uuid('chapterId'),
  validation.generateChapter,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { chapterId } = req.params;
      const { contextChapters, regenerate } = req.body;

      const chapter = await generationService.generateChapter({
        chapterId,
        userId: req.user!.userId,
        contextChapters,
        regenerate
      });

      logger.info('Chapter generated via API', {
        userId: req.user!.userId,
        chapterId,
        wordCount: chapter.wordCount
      });

      res.json({
        success: true,
        message: 'Chapter generated successfully',
        data: { chapter }
      });

    } catch (error) {
      logger.error('Chapter generation failed via API', { 
        error, 
        chapterId: req.params.chapterId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Chapter not found',
          message: error.message
        });
      }

      if (error.message.includes('already generated')) {
        return res.status(409).json({
          error: 'Chapter already generated',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Chapter generation failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /generation/story/:storyId
 * Generate entire story or continue from specific chapter
 */
router.post('/story/:storyId',
  authenticate,
  generationLimiter,
  validation.uuid('storyId'),
  validation.generateStory,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const { startFromChapter, maxChapters, contextChapters } = req.body;

      // Start generation asynchronously
      generationService.generateStory({
        storyId,
        userId: req.user!.userId,
        startFromChapter,
        maxChapters,
        contextChapters
      }).catch(error => {
        logger.error('Story generation failed asynchronously', {
          error,
          storyId,
          userId: req.user!.userId
        });
      });

      logger.info('Story generation started via API', {
        userId: req.user!.userId,
        storyId,
        startFromChapter,
        maxChapters
      });

      res.json({
        success: true,
        message: 'Story generation started successfully',
        data: {
          storyId,
          status: 'started',
          message: 'Generation is running in the background. Use the progress endpoint to monitor status.'
        }
      });

    } catch (error) {
      logger.error('Story generation start failed via API', { 
        error, 
        storyId: req.params.storyId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Story not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Story generation failed',
        message: error.message
      });
    }
  }
);

/**
 * GET /generation/story/:storyId/status
 * Get generation status for a story
 */
router.get('/story/:storyId/status',
  authenticate,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const status = await generationService.getGenerationStatus(storyId);

      res.json({
        success: true,
        data: { status }
      });

    } catch (error) {
      logger.error('Failed to get generation status via API', { 
        error, 
        storyId: req.params.storyId, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        error: 'Failed to get status',
        message: 'An error occurred while retrieving generation status'
      });
    }
  }
);

/**
 * DELETE /generation/story/:storyId
 * Abort ongoing story generation
 */
router.delete('/story/:storyId',
  authenticate,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      await generationService.abortGeneration(storyId);

      logger.info('Story generation aborted via API', {
        userId: req.user!.userId,
        storyId
      });

      res.json({
        success: true,
        message: 'Story generation aborted successfully'
      });

    } catch (error) {
      logger.error('Failed to abort generation via API', { 
        error, 
        storyId: req.params.storyId, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        error: 'Failed to abort generation',
        message: 'An error occurred while aborting generation'
      });
    }
  }
);

/**
 * POST /generation/chapter/:chapterId/revise
 * Revise chapter content based on feedback
 */
router.post('/chapter/:chapterId/revise',
  authenticate,
  generationLimiter,
  validation.uuid('chapterId'),
  validation.reviseChapter,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { chapterId } = req.params;
      const { feedback } = req.body;

      const chapter = await generationService.reviseChapter(
        chapterId,
        req.user!.userId,
        feedback
      );

      logger.info('Chapter revised via API', {
        userId: req.user!.userId,
        chapterId,
        revisionCount: chapter.revisionCount
      });

      res.json({
        success: true,
        message: 'Chapter revised successfully',
        data: { chapter }
      });

    } catch (error) {
      logger.error('Chapter revision failed via API', { 
        error, 
        chapterId: req.params.chapterId, 
        userId: req.user?.userId 
      });
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({
          error: 'Chapter not found',
          message: error.message
        });
      }

      if (error.message.includes('only revise generated')) {
        return res.status(400).json({
          error: 'Chapter not ready for revision',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Chapter revision failed',
        message: error.message
      });
    }
  }
);

/**
 * Server-Sent Events endpoint for real-time generation progress
 */
router.get('/progress/:storyId',
  authenticate,
  validation.uuid('storyId'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const { storyId } = req.params;
    const userId = req.user!.userId;

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      storyId,
      message: 'Connected to generation progress stream'
    })}\n\n`);

    // Progress event handler
    const progressHandler = (progress: any) => {
      if (progress.storyId === storyId) {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          ...progress
        })}\n\n`);
      }
    };

    // Listen for progress updates
    generationService.on(`progress:${storyId}`, progressHandler);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      generationService.removeListener(`progress:${storyId}`, progressHandler);
      clearInterval(heartbeatInterval);
      
      logger.debug('SSE connection closed for generation progress', {
        userId,
        storyId
      });
    });

    // Keep connection alive
    req.on('end', () => {
      generationService.removeListener(`progress:${storyId}`, progressHandler);
      clearInterval(heartbeatInterval);
    });

    logger.debug('SSE connection established for generation progress', {
      userId,
      storyId
    });
  }
);

export default router;