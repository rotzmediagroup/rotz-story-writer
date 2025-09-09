import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { userService } from '../services/user.service';
import { validation, handleValidationErrors, rateLimitValidation } from '../middleware/validation.middleware';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit(rateLimitValidation.auth);

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', 
  authLimiter,
  validation.registerUser,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password, subscriptionTier } = req.body;
      
      const authResponse = await userService.register({
        name,
        email,
        password,
        subscriptionTier: subscriptionTier || 'free'
      });

      logger.info('User registered via API', {
        userId: authResponse.user.id,
        email: authResponse.user.email
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: authResponse
      });

    } catch (error) {
      logger.error('Registration failed via API', { error: error.message, email: req.body.email });
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User already exists',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Registration failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /auth/login
 * Login user
 */
router.post('/login',
  authLimiter,
  validation.loginUser,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const authResponse = await userService.login({ email, password });

      logger.info('User logged in via API', {
        userId: authResponse.user.id,
        email: authResponse.user.email
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: authResponse
      });

    } catch (error) {
      logger.warn('Login failed via API', { error: error.message, email: req.body.email });
      
      res.status(401).json({
        error: 'Login failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh user token
 */
router.post('/refresh',
  authLimiter,
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Token required',
          message: 'Please provide a valid token to refresh'
        });
      }

      const token = authHeader.substring(7);
      const authResponse = await userService.refreshToken(token);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: authResponse
      });

    } catch (error) {
      logger.warn('Token refresh failed via API', { error: error.message });
      
      res.status(401).json({
        error: 'Token refresh failed',
        message: error.message
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userStats = await userService.getUserStats(req.user!.userId);
      
      res.json({
        success: true,
        data: {
          user: req.user,
          stats: userStats
        }
      });

    } catch (error) {
      logger.error('Failed to get user info via API', { error, userId: req.user?.userId });
      
      res.status(500).json({
        error: 'Failed to get user info',
        message: 'An error occurred while retrieving user information'
      });
    }
  }
);

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile',
  authenticate,
  validation.updateProfile,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const updatedUser = await userService.updateProfile(req.user!.userId, updates);

      logger.info('User profile updated via API', {
        userId: req.user!.userId,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      });

    } catch (error) {
      logger.error('Profile update failed via API', { error, userId: req.user?.userId });
      
      if (error.message.includes('Email already in use')) {
        return res.status(409).json({
          error: 'Email conflict',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Profile update failed',
        message: error.message
      });
    }
  }
);

/**
 * PUT /auth/password
 * Change user password
 */
router.put('/password',
  authenticate,
  validation.changePassword,
  handleValidationErrors,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      await userService.changePassword(req.user!.userId, currentPassword, newPassword);

      logger.info('User password changed via API', { userId: req.user!.userId });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.warn('Password change failed via API', { error, userId: req.user?.userId });
      
      if (error.message.includes('incorrect')) {
        return res.status(401).json({
          error: 'Invalid password',
          message: error.message
        });
      }

      res.status(400).json({
        error: 'Password change failed',
        message: error.message
      });
    }
  }
);

/**
 * PUT /auth/preferences
 * Update user preferences
 */
router.put('/preferences',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const preferences = req.body;
      const updatedUser = await userService.updatePreferences(req.user!.userId, preferences);

      logger.info('User preferences updated via API', {
        userId: req.user!.userId,
        preferences: Object.keys(preferences)
      });

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: { user: updatedUser }
      });

    } catch (error) {
      logger.error('Preferences update failed via API', { error, userId: req.user?.userId });
      
      res.status(400).json({
        error: 'Preferences update failed',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /auth/account
 * Deactivate user account
 */
router.delete('/account',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      await userService.deactivateAccount(req.user!.userId);

      logger.info('User account deactivated via API', { userId: req.user!.userId });

      res.json({
        success: true,
        message: 'Account deactivated successfully'
      });

    } catch (error) {
      logger.error('Account deactivation failed via API', { error, userId: req.user?.userId });
      
      res.status(500).json({
        error: 'Account deactivation failed',
        message: 'An error occurred while deactivating your account'
      });
    }
  }
);

export default router;