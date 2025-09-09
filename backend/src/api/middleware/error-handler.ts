import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't leak stack traces in production
  const response: any = {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
      ...(error.details && { details: error.details })
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    response.error.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

export function createError(
  message: string, 
  statusCode: number = 500, 
  code?: string,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  if (details) {
    error.details = details;
  }
  return error;
}