import { Router } from 'express';
import authRoutes from './auth.routes';
import storiesRoutes from './stories.routes';
import generationRoutes from './generation.routes';
import aiConfigRoutes from './ai-config.routes';
import { logger } from '../config/logger';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Story Writer API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API version endpoint
router.get('/version', (req, res) => {
  res.json({
    success: true,
    data: {
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/stories', storiesRoutes);
router.use('/generation', generationRoutes);
router.use('/ai-config', aiConfigRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'AI Story Writer API',
      description: 'REST API for AI-powered story generation platform',
      version: process.env.npm_package_version || '1.0.0',
      endpoints: {
        auth: {
          'POST /auth/register': 'Register a new user account',
          'POST /auth/login': 'Login with email and password',
          'POST /auth/refresh': 'Refresh authentication token',
          'GET /auth/me': 'Get current user information and stats',
          'PUT /auth/profile': 'Update user profile',
          'PUT /auth/password': 'Change user password',
          'PUT /auth/preferences': 'Update user preferences',
          'DELETE /auth/account': 'Deactivate user account'
        },
        stories: {
          'GET /stories': 'Get list of user stories with filtering',
          'POST /stories': 'Create a new story',
          'GET /stories/genres': 'Get available story genres',
          'GET /stories/search': 'Search stories',
          'GET /stories/:storyId': 'Get story details',
          'PUT /stories/:storyId': 'Update story',
          'DELETE /stories/:storyId': 'Delete story',
          'POST /stories/:storyId/plan': 'Generate story plan',
          'POST /stories/:storyId/generate': 'Start story generation',
          'GET /stories/:storyId/statistics': 'Get story statistics',
          'POST /stories/:storyId/export': 'Export story to various formats'
        },
        generation: {
          'POST /generation/chapter/:chapterId': 'Generate single chapter',
          'POST /generation/story/:storyId': 'Generate entire story',
          'GET /generation/story/:storyId/status': 'Get generation status',
          'DELETE /generation/story/:storyId': 'Abort story generation',
          'POST /generation/chapter/:chapterId/revise': 'Revise chapter with feedback',
          'GET /generation/progress/:storyId': 'Real-time generation progress (SSE)'
        },
        'ai-config': {
          'GET /ai-config': 'Get user AI configurations',
          'POST /ai-config': 'Add new AI configuration',
          'PUT /ai-config/:configId': 'Update AI configuration',
          'DELETE /ai-config/:configId': 'Delete AI configuration',
          'PUT /ai-config/:configId/default': 'Set default AI configuration',
          'POST /ai-config/:configId/test': 'Test AI configuration',
          'GET /ai-config/providers': 'Get available AI providers',
          'GET /ai-config/:configId/models': 'Get available models for provider'
        }
      },
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <jwt_token>',
        note: 'Include JWT token in Authorization header for authenticated endpoints'
      },
      rateLimit: {
        auth: '20 requests per 15 minutes',
        api: '100 requests per 15 minutes',
        generation: '5 requests per minute'
      },
      subscriptionTiers: {
        free: {
          stories: 5,
          chaptersPerStory: 10,
          exportsPerMonth: 3
        },
        premium: {
          stories: 100,
          chaptersPerStory: 50,
          exportsPerMonth: 50
        },
        enterprise: {
          stories: 'unlimited',
          chaptersPerStory: 'unlimited',
          exportsPerMonth: 'unlimited'
        }
      }
    }
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  logger.warn('API route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: ['/health', '/version', '/docs', '/auth', '/stories', '/generation', '/ai-config']
  });
});

export default router;