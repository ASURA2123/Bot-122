
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../src/utils';
import chalk from 'chalk';

export interface LoggerOptions {
  logBody?: boolean;
  logQuery?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
  excludeMethods?: string[];
}

export function requestLogger(options: LoggerOptions = {}) {
  const {
    logBody = false,
    logQuery = true,
    logHeaders = false,
    excludePaths = ['/health', '/favicon.ico'],
    excludeMethods = ['OPTIONS']
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Bỏ qua các đường dẫn và phương thức được loại trừ
    if (
      excludePaths.some(path => req.path.startsWith(path)) ||
      excludeMethods.includes(req.method)
    ) {
      return next();
    }

    const startTime = Date.now();
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Ghi log thông tin yêu cầu
    const logMeta = {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    if (logQuery && Object.keys(req.query).length > 0) {
      Object.assign(logMeta, { query: req.query });
    }

    if (logBody && req.body && Object.keys(req.body).length > 0) {
      Object.assign(logMeta, { 
        body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined 
      });
    }

    if (logHeaders && req.headers) {
      const safeHeaders = { ...req.headers };
      // Loại bỏ các header nhạy cảm
      delete safeHeaders.authorization;
      delete safeHeaders.cookie;
      Object.assign(logMeta, { headers: safeHeaders });
    }

    logger.info(`Request: ${req.method} ${req.path}`, logMeta);

    // Theo dõi và ghi log kết quả
    const originalSend = res.send;
    
    res.send = function (body) {
      const responseTime = Date.now() - startTime;
      
      const statusCode = res.statusCode;
      const statusColor = statusCode >= 500
        ? chalk.red(statusCode)
        : statusCode >= 400
          ? chalk.yellow(statusCode)
          : statusCode >= 300
            ? chalk.cyan(statusCode)
            : chalk.green(statusCode);
      
      // Xác định function log dựa trên status code
      let logFn;
      if (statusCode >= 500) {
        logFn = (msg: string, meta?: any) => logger.error(msg, undefined, meta);
      } else if (statusCode >= 400) {
        logFn = (msg: string, meta?: any) => logger.warn(msg, meta);
      } else {
        logFn = (msg: string, meta?: any) => logger.info(msg, meta);
      }
      
      const responseInfo = {
        requestId,
        responseTime: `${responseTime}ms`,
        status: statusCode,
        contentLength: body ? (body.length || 0) : 0
      };

      // Gọi hàm log phù hợp
      logFn(`Response: ${req.method} ${req.path} ${statusColor} ${responseTime}ms`, responseInfo);
      
      // Gọi hàm gốc
      // @ts-ignore
      return originalSend.call(this, body);
    };

    next();
  };
}

export function errorLogger() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`API Error: ${err.message}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      stack: err.stack,
      statusCode: res.statusCode
    });
    
    next(err);
  };
}
