import winston from 'winston';
import 'winston-daily-rotate-file';
import chalk from 'chalk';
import path from 'path';
import util from 'util';

// Tạo thư mục logs nếu chưa tồn tại
const LOG_DIR = path.join(process.cwd(), 'logs');

// Định nghĩa custom levels
const levels = {
  critical: 0,
  error: 1,
  warn: 2,
  system: 3,
  info: 4,
  debug: 5,
};

// Custom format cho màu sắc
const colors = {
  critical: 'red.bold',
  error: 'red',
  warn: 'yellow',
  system: 'magenta',
  info: 'green',
  debug: 'blue',
};

// Format time đẹp hơn
const timeFormat = () => {
  return new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Tạo format cho console
const consoleFormat = winston.format.printf(({ level, message, metadata }) => {
  const color = colors[level] || 'white';

  // Xử lý level với màu
  const colorizedLevel = color.split('.').reduce((acc, cur) => chalk[cur](acc), level);

  // Format message
  let formattedMessage = `[${timeFormat()}] ${colorizedLevel.padEnd(8)}: ${message}`;

  // Thêm metadata nếu có
  if (metadata && Object.keys(metadata).length > 0) {
    formattedMessage += '\n' + util.inspect(metadata, { colors: true, depth: 5 });
  }

  return formattedMessage;
});

// Tạo winston logger instance
const winstonLogger = winston.createLogger({
  levels,
  level: 'debug', // Lưu tất cả các level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        consoleFormat
      ),
    }),

    // File transports cho từng level
    new winston.transports.DailyRotateFile({
      level: 'debug',
      filename: path.join(LOG_DIR, 'debug.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'info',
      filename: path.join(LOG_DIR, 'info.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'warn',
      filename: path.join(LOG_DIR, 'warn.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: path.join(LOG_DIR, 'error.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'critical',
      filename: path.join(LOG_DIR, 'critical.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'system',
      filename: path.join(LOG_DIR, 'system.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
});

// Hàm highlight text
const highlight = (text: string): string => chalk.cyan(text);

// Hàm tạo warning box
const warningBox = (text: string): string => {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length));
  const border = '═'.repeat(maxLength + 4);

  let result = chalk.yellow(`╔${border}╗\n`);
  for (const line of lines) {
    result += chalk.yellow(`║  ${line.padEnd(maxLength)}  ║\n`);
  }
  result += chalk.yellow(`╚${border}╝`);

  return result;
};

// Hàm lấy logs
const getLogs = (level?: string, limit = 100, from?: Date, to?: Date, search?: string) => {
  // Implement lấy logs từ file hoặc memory
  // Placeholder, cần implement theo yêu cầu cụ thể
  const filteredLogs = [];

  return filteredLogs;
};

// Export logger object với các hàm bổ sung
export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => winstonLogger.debug(message, { metadata }),
  info: (message: string, metadata?: Record<string, unknown>) => winstonLogger.info(message, { metadata }),
  warn: (message: string, metadata?: Record<string, unknown>) => winstonLogger.warn(message, { metadata }),
  error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    const errorData = error ? { error: error.message, stack: error.stack, ...metadata } : metadata;
    winstonLogger.error(message, { ...errorData });
  },
  critical: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    const errorData = error ? { error: error.message, stack: error.stack, ...metadata } : metadata;
    winstonLogger.log('critical', message, { ...errorData });
  },
  system: (message: string, metadata?: Record<string, unknown>) => winstonLogger.log('system', message, { metadata }),
  getLogs,
  highlight,
  warningBox,
};

// Đặt tên lại để sử dụng làm default export
const loggerExport = {
  debug: (message: string, metadata?: Record<string, unknown>) => winstonLogger.debug(message, { metadata }),
  info: (message: string, metadata?: Record<string, unknown>) => winstonLogger.info(message, { metadata }),
  warn: (message: string, metadata?: Record<string, unknown>) => winstonLogger.warn(message, { metadata }),
  error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    const errorData = error ? { error: error.message, stack: error.stack, ...metadata } : metadata;
    winstonLogger.error(message, { ...errorData });
  },
  critical: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    const errorData = error ? { error: error.message, stack: error.stack, ...metadata } : metadata;
    winstonLogger.log('critical', message, { ...errorData });
  },
  system: (message: string, metadata?: Record<string, unknown>) => winstonLogger.log('system', message, { metadata }),
  getLogs,
  highlight,
  warningBox,
};

export default loggerExport;