import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { logger } from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    subscriptionTier: 'free' | 'premium' | 'enterprise';
  };
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const session = await userService.verifyToken(token);
      
      req.user = {
        userId: session.userId,
        email: session.email,
        subscriptionTier: session.subscriptionTier
      };

      next();

    } catch (error) {
      logger.warn('Token verification failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please log in again'
      });
    }

  } catch (error) {
    logger.error('Authentication middleware error', { error });
    
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Middleware to check if user has required subscription tier
 */
export const requireSubscription = (requiredTier: 'premium' | 'enterprise') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const tierLevels = {
      'free': 0,
      'premium': 1,
      'enterprise': 2
    };

    const userLevel = tierLevels[req.user.subscriptionTier];
    const requiredLevel = tierLevels[requiredTier];

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Subscription upgrade required',
        message: `This feature requires ${requiredTier} subscription`,
        currentTier: req.user.subscriptionTier,
        requiredTier
      });
    }

    next();
  };
};

/**
 * Optional authentication - sets user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const session = await userService.verifyToken(token);
        req.user = {
          userId: session.userId,
          email: session.email,
          subscriptionTier: session.subscriptionTier
        };
      } catch (error) {
        // Ignore token errors for optional auth
      }
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error', { error });
    next(); // Continue even if auth fails
  }
};