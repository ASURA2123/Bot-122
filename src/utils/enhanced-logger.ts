import winston from 'winston';
import 'winston-daily-rotate-file';
import chalk from 'chalk';
import path from 'path';
import util from 'util';
import nodemailer from 'nodemailer';
import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Tạo thư mục logs nếu chưa tồn tại
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_MAX_SIZE = parseInt(process.env.LOG_MAX_SIZE || '5242880', 10); // 5MB default
const LOG_MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '5', 10);
const LOG_CONSOLE = process.env.LOG_CONSOLE !== 'false';
const LOG_FILE = process.env.LOG_FILE !== 'false';

// Email configuration
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true' && EMAIL_USER && EMAIL_PASS && EMAIL_TO;

// Slack configuration
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || '#bot-alerts';
const SLACK_ENABLED = process.env.SLACK_ENABLED === 'true' && SLACK_TOKEN;

// Khởi tạo Nodemailer (dùng để gửi email thông báo lỗi cho admin)
let transporter: any = null;
if (EMAIL_ENABLED) {
  transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

// Slack client để gửi thông báo cho admin
let slackClient: any = null;
if (SLACK_ENABLED) {
  slackClient = new WebClient(SLACK_TOKEN);
}

// Định nghĩa custom levels
const levels = {
  critical: 0,   // Lỗi nghiêm trọng cần thông báo ngay
  error: 1,      // Lỗi thông thường
  warn: 2,       // Cảnh báo
  system: 3,     // Thông tin hệ thống
  info: 4,       // Thông tin chung
  debug: 5,      // Thông tin debug
  admin: 6       // Thông tin dành cho admin
};

// Custom format cho màu sắc và biểu tượng
const colors = {
  critical: 'red.bold',
  error: 'red',
  warn: 'yellow',
  system: 'magenta',
  info: 'green',
  debug: 'blue',
  admin: 'cyan.bold'
};

// Biểu tượng cho từng loại log
const icons = {
  critical: '🔴',
  error: '❌',
  warn: '⚠️',
  system: '🔧',
  info: '✅',
  debug: '🔍',
  admin: '👑'
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
  const icon = icons[level] || '';

  // Xử lý level với màu
  const colorizedLevel = color.split('.').reduce((acc, cur) => chalk[cur](acc), level.toUpperCase());

  // Format message
  let formattedMessage = `${icon} [${timeFormat()}] ${colorizedLevel.padEnd(10)}: ${message}`;

  // Thêm metadata nếu có
  if (metadata && Object.keys(metadata).length > 0) {
    formattedMessage += '\n' + util.inspect(metadata, { colors: true, depth: 5 });
  }

  return formattedMessage;
});

// Tạo winston logger instance
const winstonLogger = winston.createLogger({
  levels,
  level: LOG_LEVEL, // Lấy từ biến môi trường
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: []
});

// Thêm console transport nếu được bật
if (LOG_CONSOLE) {
  winstonLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      consoleFormat
    ),
  }));
}

// Thêm file transports nếu được bật
if (LOG_FILE) {
  // File transports cho từng level
  const levels = ['debug', 'info', 'warn', 'error', 'critical', 'system', 'admin'];
  
  levels.forEach(level => {
    winstonLogger.add(new winston.transports.DailyRotateFile({
      level,
      filename: path.join(LOG_DIR, `${level}.log`),
      datePattern: 'YYYY-MM-DD',
      maxSize: `${LOG_MAX_SIZE}`,
      maxFiles: LOG_MAX_FILES,
    }));
  });
}

// Hàm gửi email thông báo lỗi cho admin
const sendEmailToAdmin = (subject: string, message: string) => {
  if (!EMAIL_ENABLED || !transporter) {
    winstonLogger.warn('Email notifications are disabled or not configured properly');
    return;
  }

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject: `${icons.critical} ${subject}`,
    text: `${message}\n\nTime: ${timeFormat()}\nEnvironment: ${process.env.NODE_ENV || 'development'}`
  };

  transporter.sendMail(mailOptions, (error: Error, info: any) => {
    if (error) {
      winstonLogger.error('Lỗi gửi email: ', { error: error.message });
    } else {
      winstonLogger.info('Email đã được gửi: ' + info.response);
    }
  });
};

// Hàm gửi thông báo Slack cho admin
const sendSlackMessageToAdmin = async (message: string) => {
  if (!SLACK_ENABLED || !slackClient) {
    winstonLogger.warn('Slack notifications are disabled or not configured properly');
    return;
  }

  try {
    await slackClient.chat.postMessage({
      channel: SLACK_CHANNEL,
      text: `${icons.critical} *Lỗi quan trọng*\n${message}\n_Time: ${timeFormat()}_\n_Environment: ${process.env.NODE_ENV || 'development'}_`
    });
    winstonLogger.info('Thông báo đã được gửi tới Slack!');
  } catch (error: any) {
    winstonLogger.error('Lỗi gửi thông báo Slack: ', { error: error.message });
  }
};

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

// Hàm tạo error box
const errorBox = (text: string): string => {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length));
  const border = '═'.repeat(maxLength + 4);

  let result = chalk.red(`╔${border}╗\n`);
  for (const line of lines) {
    result += chalk.red(`║  ${line.padEnd(maxLength)}  ║\n`);
  }
  result += chalk.red(`╚${border}╝`);

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
export const enhancedLogger = {
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
    
    // Gửi thông báo cho admin qua email và Slack khi có lỗi nghiêm trọng
    if (EMAIL_ENABLED) {
      sendEmailToAdmin('Lỗi nghiêm trọng từ Bot', message + (error ? `\n\nError: ${error.message}\n${error.stack}` : ''));
    }
    
    if (SLACK_ENABLED) {
      sendSlackMessageToAdmin(message + (error ? `\n\nError: ${error.message}` : ''));
    }
  },
  system: (message: string, metadata?: Record<string, unknown>) => winstonLogger.log('system', message, { metadata }),
  admin: (message: string, metadata?: Record<string, unknown>) => winstonLogger.log('admin', message, { metadata }),
  getLogs,
  highlight,
  warningBox,
  errorBox,
  sendEmailToAdmin,
  sendSlackMessageToAdmin
};

// Đặt tên lại để sử dụng làm default export
const loggerExport = enhancedLogger;

export default loggerExport;