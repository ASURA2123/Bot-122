import { logger, logError, logInfo, logSystem } from '../utils/enhanced-logger';
import path from 'path';
import fs from 'fs-extra';
import { formatError } from '../types/errors';

/**
 * Logger Integration
 * 
 * This module provides integration between the enhanced logger and the legacy JavaScript modules.
 * It ensures that all modules use the same logging system for consistent error handling and reporting.
 */

// Function to initialize the logger integration
export async function initializeLoggerIntegration(): Promise<boolean> {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create error records file if it doesn't exist
    const errorRecordsPath = path.join(logsDir, 'error-records.json');
    if (!fs.existsSync(errorRecordsPath)) {
      fs.writeJSONSync(errorRecordsPath, { errors: [] }, { spaces: 2 });
    }
    
    logger.info('Logger integration initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize logger integration:', error);
    return false;
  }
}

// Function to record an error in the error records file
export async function recordError(error: Error, context?: string): Promise<void> {
  try {
    const errorRecordsPath = path.join(process.cwd(), 'logs', 'error-records.json');
    let errorRecords = { errors: [] };
    
    if (fs.existsSync(errorRecordsPath)) {
      errorRecords = fs.readJSONSync(errorRecordsPath);
    }
    
    // Format the error with additional metadata
    const formattedError = formatError(error);
    
    errorRecords.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      category: formattedError.category,
      code: formattedError.code,
      details: formattedError.details,
      context: context || 'unknown'
    });
    
    // Keep only the last 100 errors
    if (errorRecords.errors.length > 100) {
      errorRecords.errors = errorRecords.errors.slice(-100);
    }
    
    fs.writeJSONSync(errorRecordsPath, errorRecords, { spaces: 2 });
    
    // Log the error to the enhanced logger
    logError(`Error recorded: ${error.message}`, error, { context });
  } catch (recordError) {
    if (recordError instanceof Error) {
      logger.error(`Failed to record error: ${recordError.message}`, { stack: recordError.stack });
    } else {
      logger.error(`Failed to record error: Unknown error`);
    }
  }
}

// Function to get recent errors
export async function getRecentErrors(count: number = 10): Promise<any[]> {
  try {
    const errorRecordsPath = path.join(process.cwd(), 'logs', 'error-records.json');
    
    if (!fs.existsSync(errorRecordsPath)) {
      return [];
    }
    
    const errorRecords = fs.readJSONSync(errorRecordsPath);
    return errorRecords.errors.slice(-count);
  } catch (error) {
    logger.error(`Failed to get recent errors: ${error.message}`);
    return [];
  }
}

// Export the logger functions for use in JavaScript modules
export const loggerFunctions = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  error: (message: string, error?: Error, meta?: any) => {
    if (error) {
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
      recordError(error, message);
    } else {
      logger.error(message, meta);
    }
  },
  critical: (message: string, error?: Error, meta?: any) => {
    if (error) {
      logger.log('critical', message, { ...meta, error: error.message, stack: error.stack });
      recordError(error, `CRITICAL: ${message}`);
    } else {
      logger.log('critical', message, meta);
    }
  },
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  system: (message: string, meta?: any) => logger.log('system', message, meta),
  box: (message: string) => {
    console.log('='.repeat(50));
    console.log(message);
    console.log('='.repeat(50));
    logger.info(message);
  },
  errorBox: (message: string) => {
    console.log('!'.repeat(50));
    console.log(message);
    console.log('!'.repeat(50));
    logger.error(message);
  },
  successBox: (message: string) => {
    console.log('+'.repeat(50));
    console.log(message);
    console.log('+'.repeat(50));
    logger.info(message);
  }
};

// Export default logger functions
export default loggerFunctions;