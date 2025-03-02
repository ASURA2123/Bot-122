import * as dotenv from "dotenv";
import { z } from "zod";
import { logger } from "../utils/logger";

// Load environment variables
dotenv.config();

// Define schema for environment variables
const envSchema = z.object({
  // Facebook credentials
  FB_EMAIL: z.string().min(1, "Facebook email/phone is required"),
  FB_PASSWORD: z.string().min(6, "Facebook password must be at least 6 characters"),

  // Bot configuration
  PREFIX: z.string().default("!"),
  ADMIN_PREFIX: z.string().default("/"),
  OWNER_ID: z.string().optional(),
  ADMIN_IDS: z.string().transform(str => str.split(",").filter(id => id.length > 0)),

  // Logging configuration
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_CONSOLE: z.boolean().default(true),
  LOG_FILE: z.boolean().default(true),
  LOG_DIR: z.string().default("logs"),
  LOG_MAX_SIZE: z.number().default(5242880), // 5MB
  LOG_MAX_FILES: z.number().default(5)
});

// Parse and validate environment variables
export function loadEnvConfig() {
  try {
    const env = envSchema.parse(process.env);

    // Validate Facebook credentials format
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FB_EMAIL);
    const isVietnamesePhone = /^(0|84)[1-9][0-9]{8,9}$/.test(env.FB_EMAIL);

    if (!isEmail && !isVietnamesePhone) {
      const error = new Error(
        'Email hoặc số điện thoại không hợp lệ\n' +
        '- Email phải có định dạng example@domain.com\n' +
        '- Số điện thoại phải bắt đầu bằng 0 hoặc 84, và có 10-11 số'
      );
      error.name = 'InvalidCredentialsError';
      throw error;
    }

    // Log non-sensitive config for debugging
    logger.debug('Loaded environment config:', {
      prefix: env.PREFIX,
      adminPrefix: env.ADMIN_PREFIX,
      logLevel: env.LOG_LEVEL,
      adminCount: env.ADMIN_IDS.length
    });

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
      const validationError = new Error(`Environment validation failed:\n${issues}`);
      validationError.name = 'EnvValidationError';
      logger.error('Environment validation failed', validationError);
      throw validationError;
    }

    // Rethrow other errors with proper error object
    const err = error instanceof Error ? error : new Error(String(error));
    err.name = err.name || 'EnvConfigError';
    logger.error('Environment configuration error', err);
    throw err;
  }
}