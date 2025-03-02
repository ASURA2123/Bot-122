
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../src/utils/logger';
import { errorHandler } from '../../src/utils/error-handler';
import { formatError } from '../../src/types/errors';

// Express error handling middleware
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  // Log detailed error information
  logger.error(`[${errorId}] Server error: ${err.message}`, {
    errorId,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Record error in the error handler system
  const context = {
    url: req.url,
    method: req.method,
    ip: req.ip,
    requestId: req.headers['x-request-id'] || errorId
  };
  
  errorHandler.handleError(err, context);

  // Ensure detailed error information is not sent to client in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Return error to client
  res.status(err.status || 500).json({
    error: {
      message: isDev ? err.message : 'A server error occurred',
      code: err.code || 'SERVER_ERROR',
      errorId,
      // Only send stack trace in development environment
      ...(isDev && { stack: err.stack })
    }
  });
}

// Async error handler wrapper
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(error => {
      // Add request context to error
      const enhancedError = error instanceof Error ? error : new Error(String(error));
      enhancedError['requestUrl'] = req.url;
      enhancedError['requestMethod'] = req.method;
      enhancedError['requestId'] = req.headers['x-request-id'] || Date.now().toString(36);
      
      next(enhancedError);
    });
  };
}
