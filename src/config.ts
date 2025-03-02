import { BotConfig, AntiOutConfig } from "./types";
import * as dotenv from "dotenv";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

// Kiểm tra và lấy giá trị từ env với validation
function getEnvVar(key: string, required = true, defaultValue = ''): string {
  const value = process.env[key];
  if (required && !value && !defaultValue) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${key}`);
  }
  return value || defaultValue;
}

// Cấu hình chính của bot
const config: BotConfig = {
  email: getEnvVar('FB_EMAIL', true),
  password: getEnvVar('FB_PASSWORD', true),
  prefix: getEnvVar('PREFIX', false, '!'),
  adminPrefix: getEnvVar('ADMIN_PREFIX', false, '/'), 
  owner: getEnvVar('OWNER_ID', false, ''),
  admins: getEnvVar('ADMIN_IDS', false, '').split(',').filter(id => id.length > 0),
};

// Cấu hình chống out nhóm
export const ANTI_OUT_CONFIG: AntiOutConfig = {
  enabled: true,
  whitelist: [],
  message: "⚠️ Bot đã thêm bạn lại vào nhóm vì tính năng chống out đang bật!"
};

// Cấu hình logging
export const LOGGING_CONFIG = {
  level: (getEnvVar('LOG_LEVEL', false, 'info')).toLowerCase(),
  enableConsole: getEnvVar('LOG_CONSOLE', false, 'true') !== 'false',
  enableFile: getEnvVar('LOG_FILE', false, 'true') !== 'false',
  directory: getEnvVar('LOG_DIR', false, 'logs'),
  maxSize: parseInt(getEnvVar('LOG_MAX_SIZE', false, '5242880'), 10), // 5MB default
  maxFiles: parseInt(getEnvVar('LOG_MAX_FILES', false, '5'), 10),
};

// Validate cấu hình
try {
  // Kiểm tra các giá trị bắt buộc
  if (!config.email || !config.password) {
    throw new Error('Thiếu thông tin đăng nhập Facebook');
  }

  // Debug log - safely show credential format without exposing values
  logger.debug(JSON.stringify({
    auth_check: {
      email_length: config.email.length,
      email_type: config.email.includes('@') ? 'email' : 'phone',
      starts_with: config.email.charAt(0)
    }
  }));

  // Kiểm tra định dạng email/phone
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email);
  const isVietnamesePhone = /^(0|84)[1-9][0-9]{8,9}$/.test(config.email);

  if (!isEmail && !isVietnamesePhone) {
    throw new Error(
      'Email hoặc số điện thoại không hợp lệ\n' +
      '- Email phải có định dạng example@domain.com\n' +
      '- Số điện thoại phải bắt đầu bằng 0 hoặc 84, và có 10-11 số'
    );
  }

  // Kiểm tra độ dài password
  if (config.password.length < 6) {
    throw new Error('Mật khẩu quá ngắn, cần ít nhất 6 ký tự');
  }

  // Log cấu hình (ẩn thông tin nhạy cảm)
  logger.info('Đã tải cấu hình:');
  logger.info(`- Prefix lệnh: ${config.prefix}`);
  logger.info(`- Prefix admin: ${config.adminPrefix}`);
  logger.info(`- Owner: ${config.owner || 'Chưa cấu hình'}`);
  logger.info(`- Số lượng admin: ${config.admins.length}`);
  logger.info(`- Cấp độ log: ${LOGGING_CONFIG.level}`);

} catch (error) {
  logger.error('Lỗi cấu hình:', error as Error);
  process.exit(1);
}

export default config;