import { FacebookApiError, LoggedError, ExtendedError } from "../types/errors";
import { logger } from "./logger";
import EventEmitter from 'events';
import fs from 'fs-extra';
import path from 'path';

export enum ErrorCategory {
  AUTH = 'auth',
  CONNECTION = 'connection',
  SESSION = 'session',
  API = 'api',
  DATA = 'data',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

export interface HandledError {
  name: string;
  category: ErrorCategory;
  code?: number | string;
  message: string;
  recoverable: boolean;
  originalError: Error;
  stack?: string;
}

interface ErrorRecord {
  timestamp: number;
  message: string;
  stack?: string;
  code?: string | number;
  context?: Record<string, any>;
  resolved: boolean;
}

export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler;
  private errorCounts: Map<string, number> = new Map();
  private readonly ERROR_THRESHOLD = 5;
  private readonly ERROR_RESET_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private errors: ErrorRecord[] = [];
  private readonly errorFile = path.join(process.cwd(), 'logs', 'error-records.json');
  private readonly maxErrors = 1000;
  private readonly errorRetryMap: Map<string, number> = new Map();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  private constructor() {
    super();
    this.loadErrors();

    // Reset error counts periodically
    setInterval(() => {
      this.errorCounts.clear();
    }, this.ERROR_RESET_INTERVAL);
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private async loadErrors(): Promise<void> {
    try {
      if (await fs.pathExists(this.errorFile)) {
        this.errors = await fs.readJSON(this.errorFile);
      } else {
        this.errors = [];
        await fs.ensureDir(path.dirname(this.errorFile));
        await fs.writeJSON(this.errorFile, this.errors, { spaces: 2 });
      }
    } catch (error) {
      logger.error(`Lỗi khi đọc error log: ${(error as Error).message}`);
      this.errors = [];
    }
  }

  private async saveErrors(): Promise<void> {
    try {
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors);
      }
      await fs.writeJSON(this.errorFile, this.errors, { spaces: 2 });
    } catch (error) {
      logger.error(`Lỗi khi lưu error log: ${(error as Error).message}`);
    }
  }

  public handleError(error: Error, context?: Record<string, any>): void {
    const errorName = error.name || 'UnknownError';
    const errorCount = (this.errorCounts.get(errorName) || 0) + 1;
    this.errorCounts.set(errorName, errorCount);

    // Add timestamp and error ID for better tracking
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const timestamp = new Date();
    
    logger.error(`[${errorId}] ${errorName}: ${error.message}`, {
      errorId,
      timestamp: timestamp.toISOString(),
      stack: error.stack,
      ...context
    });

    // Emit error event for other systems to listen
    this.emit('error', {
      id: errorId,
      name: errorName,
      message: error.message,
      stack: error.stack,
      context,
      count: errorCount,
      time: timestamp
    });

    // Check error threshold
    if (errorCount >= this.ERROR_THRESHOLD) {
      logger.warn(`Error threshold reached for ${errorName} (${errorCount} times)`);
      this.emit('error_threshold_reached', {
        id: errorId,
        name: errorName,
        count: errorCount
      });
    }

    // Provide recovery suggestions based on error type
    const suggestions = this.getSuggestions(errorName);
    if (suggestions.length > 0) {
      logger.info(`Suggestions for ${errorName}:`, { suggestions });
      this.emit('error_suggestions', {
        id: errorId,
        name: errorName,
        suggestions
      });
    }
    
    // Track error for potential automatic recovery
    this.trackErrorForRecovery(errorName, errorId);
  }

  public getSuggestions(errorName: string): string[] {
    let suggestions: string[] = [];

    switch (errorName) {
      case 'LoginError':
        suggestions = [
          'Kiểm tra thông tin đăng nhập Facebook',
          'Xóa cookies cũ và đăng nhập lại',
          'Kiểm tra xem tài khoản có yêu cầu xác minh 2FA không'
        ];
        break;

      case 'ApiError':
        suggestions = [
          'Kiểm tra kết nối internet',
          'Kiểm tra xem Facebook có bị chặn không',
          'Thử thay đổi proxy hoặc địa chỉ IP',
          'Giảm tần suất yêu cầu API để tránh bị chặn'
        ];
        break;

      case 'NetworkError':
        suggestions = [
          'Kiểm tra kết nối internet',
          'Thử thay đổi proxy hoặc VPN',
          'Kiểm tra tường lửa'
        ];
        break;

      default:
        break;
    }

    return suggestions;
  }

  /**
   * Log an error with context and return a unique error ID
   */
  public async logError(error: Error, context: Record<string, any> = {}): Promise<string> {
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const errorRecord: ErrorRecord = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      category: ErrorHandler.categorizeError(error),
      context,
      resolved: false
    };

    this.errors.push(errorRecord);
    await this.saveErrors();

    // Log error to console with structured data
    logger.error(`[${errorId}] ${error.message}`, {
      errorId,
      category: errorRecord.category,
      code: errorRecord.code,
      ...context
    });

    return errorId;
  }

  /**
   * Analyze error to identify the problem type
   */
  public analyzeError(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    
    // Network error analysis
    if (errorMessage.includes('econnrefused') || errorMessage.includes('network') || 
        errorMessage.includes('timeout') || errorMessage.includes('socket') ||
        errorMessage.includes('connection') || errorName.includes('network')) {
      return 'NETWORK_ERROR';
    }

    // Authentication error
    if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized') || 
        errorMessage.includes('permission') || errorMessage.includes('access denied') ||
        errorMessage.includes('login') || errorName.includes('auth')) {
      return 'AUTH_ERROR';
    }

    // Facebook API error
    if (errorMessage.includes('facebook') || errorMessage.includes('api') || 
        errorMessage.includes('rate limit') || errorMessage.includes('blocked') ||
        errorMessage.includes('throttle') || errorName.includes('api')) {
      return 'API_ERROR';
    }

    // Data error
    if (errorMessage.includes('data') || errorMessage.includes('invalid') || 
        errorMessage.includes('missing') || errorMessage.includes('null') ||
        errorMessage.includes('undefined') || errorMessage.includes('validation')) {
      return 'DATA_ERROR';
    }
    
    // Session error
    if (errorMessage.includes('session') || errorMessage.includes('cookie') || 
        errorMessage.includes('state') || errorName.includes('session')) {
      return 'SESSION_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Suggest solutions based on error type
   */
  public getSolution(errorType: string): string {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return 'Check network connection, change proxy, or try again later.';
      case 'AUTH_ERROR':
        return 'Check cookies, login credentials or expired tokens.';
      case 'API_ERROR':
        return 'Facebook may have rate limited your requests, wait or change IP/proxy.';
      case 'DATA_ERROR':
        return 'Check data format or ensure required fields are correctly filled.';
      case 'SESSION_ERROR':
        return 'Session may have expired. Try refreshing cookies or logging in again.';
      default:
        return 'Check logs for more details and try restarting the application.';
    }
  }

  /**
   * Track errors for potential automatic recovery
   */
  private trackErrorForRecovery(errorName: string, errorId: string): void {
    // Only attempt recovery for certain types of errors
    const errorCategory = ErrorHandler.categorizeError(new Error(errorName));
    if (errorCategory === ErrorCategory.NETWORK || 
        errorCategory === ErrorCategory.API || 
        errorCategory === ErrorCategory.TIMEOUT) {
      
      const retryCount = this.errorRetryMap.get(errorName) || 0;
      
      if (retryCount < this.MAX_RETRY_ATTEMPTS) {
        this.errorRetryMap.set(errorName, retryCount + 1);
        
        // Schedule recovery attempt
        setTimeout(() => {
          this.attemptRecovery(errorName, errorId, retryCount + 1);
        }, this.RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      } else {
        logger.warn(`Maximum retry attempts (${this.MAX_RETRY_ATTEMPTS}) reached for ${errorName}`);  
        this.emit('recovery_failed', { errorName, errorId, attempts: retryCount });
      }
    }
  }
  
  /**
   * Attempt to recover from an error
   */
  private attemptRecovery(errorName: string, errorId: string, attempt: number): void {
    logger.info(`Recovery attempt ${attempt} for error: ${errorName} (${errorId})`);
    
    const errorType = this.analyzeError(new Error(errorName));
    let recoveryAction = '';
    
    switch (errorType) {
      case 'NETWORK_ERROR':
        recoveryAction = 'Attempting to reconnect';
        this.emit('recovery_attempt', { type: 'reconnect', errorId });
        break;
      case 'API_ERROR':
        recoveryAction = 'Attempting to refresh API session';
        this.emit('recovery_attempt', { type: 'refresh_session', errorId });
        break;
      case 'TIMEOUT_ERROR':
        recoveryAction = 'Retrying with increased timeout';
        this.emit('recovery_attempt', { type: 'increase_timeout', errorId });
        break;
      default:
        recoveryAction = 'No automatic recovery available';
        break;
    }
    
    logger.info(`Recovery action: ${recoveryAction}`);
  }

  /**
   * Mark an error as resolved
   */
  public async markAsResolved(timestamp: number): Promise<void> {
    const index = this.errors.findIndex(e => e.timestamp === timestamp);
    if (index !== -1) {
      this.errors[index].resolved = true;
      await this.saveErrors();
    }
  }

  /**
   * Get all unresolved errors
   */
  public getUnresolvedErrors(): ErrorRecord[] {
    return this.errors.filter(e => !e.resolved);
  }

  /**
   * Check if a specific error type occurs too frequently
   */
  public isErrorFrequent(errorType: string, timeWindow: number = 3600000): boolean {
    const now = Date.now();
    const recentErrors = this.errors.filter(e => 
      now - e.timestamp < timeWindow && 
      this.analyzeError(new Error(e.message)) === errorType
    );

    return recentErrors.length >= 5; // If there are 5 or more errors in the time window
  }

  /**
   * Check system health based on recent errors
   */
  public checkSystemHealth(): { status: 'healthy' | 'degraded' | 'critical', issues: string[], metrics: Record<string, number> } {
    const now = Date.now();
    const recentErrors = this.errors.filter(e => now - e.timestamp < 3600000); // Errors in the last hour

    const issues: string[] = [];
    const metrics: Record<string, number> = {
      totalErrors: recentErrors.length,
      networkErrors: 0,
      authErrors: 0,
      apiErrors: 0,
      dataErrors: 0,
      sessionErrors: 0,
      unknownErrors: 0
    };

    // Count errors by type
    recentErrors.forEach(error => {
      const errorType = this.analyzeError(new Error(error.message));
      switch (errorType) {
        case 'NETWORK_ERROR': metrics.networkErrors++; break;
        case 'AUTH_ERROR': metrics.authErrors++; break;
        case 'API_ERROR': metrics.apiErrors++; break;
        case 'DATA_ERROR': metrics.dataErrors++; break;
        case 'SESSION_ERROR': metrics.sessionErrors++; break;
        default: metrics.unknownErrors++; break;
      }
    });
  }

  /**
   * Phân tích chi tiết lỗi và trả về thông tin có cấu trúc
   */
  public static getErrorDetails(error: Error): HandledError {
    const category = this.categorizeError(error);
    const recoverable = category !== ErrorCategory.AUTH;

    return {
      name: error.name || 'UnknownError',
      category,
      code: (error as any).code,
      message: error.message,
      recoverable,
      originalError: error,
      stack: error.stack
    };
  }

  /**
   * Phân loại lỗi theo danh mục
   */
  private static categorizeError(error: Error): ErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    if (errorName.includes('login') || 
        errorMessage.includes('login') || 
        errorMessage.includes('auth') || 
        errorMessage.includes('permission') || 
        errorMessage.includes('access denied')) {
      return ErrorCategory.AUTH;
    }

    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') || 
        errorMessage.includes('socket')) {
      return ErrorCategory.CONNECTION;
    }

    if (errorMessage.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }

    if (errorMessage.includes('rate') || 
        errorMessage.includes('limit') || 
        errorMessage.includes('throttle')) {
      return ErrorCategory.RATE_LIMIT;
    }

    if (errorMessage.includes('session') || 
        errorMessage.includes('cookie') || 
        errorMessage.includes('state')) {
      return ErrorCategory.SESSION;
    }

    if (errorMessage.includes('data') || 
        errorMessage.includes('validation') || 
        errorMessage.includes('invalid') || 
        errorMessage.includes('schema')) {
      return ErrorCategory.VALIDATION;
    }

    if (errorMessage.includes('api') || 
        errorMessage.includes('request') || 
        errorMessage.includes('response')) {
      return ErrorCategory.API;
    }

    return ErrorCategory.UNKNOWN;
  }
}

// Tạo hàm tiện ích bắt lỗi
export const errorHandler = ErrorHandler.getInstance();

export const catchError = (fn: Function) => async (...args: any[]) => {
  try {
    return await fn(...args);
  } catch (error) {
    errorHandler.handleError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};