import chalk from 'chalk';
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs-extra';
import { createLogger, format, transports } from 'winston';
import boxen from 'boxen';

// Define log levels with icons and colors
const logLevels = {
  critical: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  system: 5
};

const logIcons = {
  critical: '🔥',
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  debug: '🔍',
  system: '🔧'
};

const logColors = {
  critical: 'redBright',
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  debug: 'magenta',
  system: 'cyan'
};

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, ...metadata }) => {
    const icon = logIcons[level] || '📝';
    const coloredLevel = chalk[logColors[level]](level.toUpperCase());
    let logMessage = `${timestamp} ${icon} [${coloredLevel}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
      logMessage += '\n' + chalk.gray(metadata.stack);
    } else if (Object.keys(metadata).length > 0) {
      try {
        const metadataStr = JSON.stringify(metadata, null, 2);
        if (metadataStr !== '{}') {
          logMessage += '\n' + chalk.gray(metadataStr);
        }
      } catch (e) {
        // Ignore circular reference errors
      }
    }
    
    return logMessage;
  })
);

// Custom format for file output (without colors)
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, ...metadata }) => {
    const icon = logIcons[level] || '📝';
    let logMessage = `${timestamp} ${icon} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      try {
        const metadataStr = JSON.stringify(metadata, null, 2);
        if (metadataStr !== '{}') {
          logMessage += '\n' + metadataStr;
        }
      } catch (e) {
        // Ignore circular reference errors
      }
    }
    
    return logMessage;
  }),
  format.json()
);

// Create separate transports for each log level
const createFileTransport = (level: string) => {
  return new transports.DailyRotateFile({
    filename: path.join('logs', `${level}.log`),
    datePattern: 'YYYY-MM-DD',
    level,
    maxFiles: '14d',
    maxSize: '20m',
    zippedArchive: true,
    format: fileFormat
  });
};

// Create the logger instance
export const logger = createLogger({
  levels: logLevels,
  transports: [
    new transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    createFileTransport('critical'),
    createFileTransport('error'),
    createFileTransport('warn'),
    createFileTransport('info'),
    createFileTransport('debug'),
    createFileTransport('system')
  ],
  exitOnError: false
});

// Add critical level method
logger.critical = (message: string, meta?: any) => logger.log('critical', message, meta);

// Helper functions for different log levels
export const logError = (message: string, error?: Error, meta?: any) => {
  if (error) {
    logger.error(message, { ...meta, error: error.message, stack: error.stack });
  } else {
    logger.error(message, meta);
  }
};

export const logCritical = (message: string, error?: Error, meta?: any) => {
  if (error) {
    logger.critical(message, { ...meta, error: error.message, stack: error.stack });
  } else {
    logger.critical(message, meta);
  }
};

export const logWarn = (message: string, meta?: any) => logger.warn(message, meta);
export const logInfo = (message: string, meta?: any) => logger.info(message, meta);
export const logDebug = (message: string, meta?: any) => logger.debug(message, meta);
export const logSystem = (message: string, meta?: any) => logger.log('system', message, meta);

// Box styled logging for important messages
export const logBox = (message: string, options?: boxen.Options) => {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue',
    ...options
  });
  console.log(boxedMessage);
};

// Error box for critical errors
export const errorBox = (message: string) => {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'red',
    backgroundColor: '#400'
  });
  console.log(boxedMessage);
  logger.critical(message);
};

// Success box for successful operations
export const successBox = (message: string) => {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'green',
    backgroundColor: '#040'
  });
  console.log(boxedMessage);
  logger.info(message);
};

// Export default logger instance
export default logger;