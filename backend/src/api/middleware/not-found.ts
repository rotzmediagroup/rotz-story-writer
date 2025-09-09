import { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler';

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = createError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'NOT_FOUND'
  );
  next(error);
}