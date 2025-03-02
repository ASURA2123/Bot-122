
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../../src/utils/logger';

/**
 * Middleware để xác thực dữ liệu request với Zod schema
 */
export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error', {
          path: req.path,
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        
        return res.status(400).json({
          error: 'Validation Error',
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          })),
          timestamp: new Date().toISOString()
        });
      }
      
      next(error);
    }
  };
};

/**
 * Middleware để xử lý lỗi từ JSON parser
 */
export const jsonErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('JSON parse error', { path: req.path });
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Dữ liệu JSON không hợp lệ',
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
};
