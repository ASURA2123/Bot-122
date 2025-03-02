import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';
import { botConfig } from '../config';
import facebookChatApi from 'facebook-chat-api';
import { promisify } from 'util';
import { Api, AppState } from '../types';
import { ErrorHandler, ErrorCategory } from './error-handler';
import https from 'https';
import { getHttpsProxyAgent } from './proxy';
import { CookieManager } from './cookie-manager';

const COOKIE_PATH = path.join(process.cwd(), 'appstate.json');
const LOGIN_RETRY_DELAY = 5000; // 5 seconds
const MAX_LOGIN_RETRIES = 3;

export async function refreshState(api: Api): Promise<boolean> {
  try {
    logger.info("Lưu trạng thái đăng nhập...");
    const appState = api.getAppState();

    fs.writeFileSync(
      COOKIE_PATH,
      JSON.stringify(appState, null, 2)
    );

    logger.info("Đã lưu trạng thái đăng nhập thành công");
    return true;
  } catch (error) {
    logger.error("Lỗi khi lưu trạng thái đăng nhập:", error);
    return false;
  }
}

async function reportProxyFailure(error: Error): Promise<void> {
  // Implement logic to report proxy failure (e.g., to a database or logging service)
  logger.warn("Proxy failure reported:", error.message);
  // Placeholder implementation - replace with actual reporting mechanism
}

export async function loginBot(options: { retry?: boolean } = {}): Promise<Api> {
  let retryCount = 0;
  let lastError: Error | null = null;

  async function attemptLogin(): Promise<Api> {
    try {
      logger.info("Đang đăng nhập vào Facebook...");

      // Tạo agent proxy nếu cần
      const agent = await getHttpsProxyAgent();

      // Kiểm tra file trạng thái đăng nhập
      let loginMethod: any = {};

      if (fs.existsSync(COOKIE_PATH)) {
        logger.info("Tìm thấy file trạng thái đăng nhập, đang sử dụng...");
        const appState = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
        loginMethod = { appState };
      } else {
        logger.info("Không tìm thấy file trạng thái đăng nhập, đăng nhập bằng email/password...");
        if (!botConfig.email || !botConfig.password) {
          throw new Error("Email hoặc mật khẩu không được cung cấp trong cấu hình");
        }

        loginMethod = {
          email: botConfig.email,
          password: botConfig.password
        };
      }

      // Tạo Promise từ login callback
      const loginPromise = promisify<any, any, Api>((credentials, options, callback) => {
        facebookChatApi(credentials, options, (err, api) => {
          if (err) callback(err);
          else callback(null, api as unknown as Api);
        });
      });

      // Đặt timeout để tránh đợi mãi mãi
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Login timeout after 30 seconds")), 30000);
      });

      // Thực hiện đăng nhập với timeout
      const api = await Promise.race([
        loginPromise(loginMethod, { forceLogin: true, userAgent: getRandomUserAgent(), httpsOptions: { agent } }),
        timeoutPromise
      ]);

      // Cài đặt handlers
      api.setOptions({
        listenEvents: true,
        selfListen: false,
        updatePresence: false,
        forceLogin: false
      });

      // Lưu trạng thái đăng nhập
      await refreshState(api);

      logger.info("Đăng nhập thành công");
      return api;
    } catch (error) {
      const handledError = ErrorHandler.categorizeError(error instanceof Error ? error : new Error(String(error)));
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Lỗi khi đăng nhập (Lần thử ${retryCount + 1}/${MAX_LOGIN_RETRIES})`, errorMessage);
      logger.debug("Error stack:", error instanceof Error ? error.stack : "No stack trace available");

      if (agent) {
        await reportProxyFailure(error instanceof Error ? error : new Error(String(error)));
      }

      // Kiểm tra nếu là lỗi có thể thử lại
      if (options.retry && retryCount < MAX_LOGIN_RETRIES &&
          (handledError.category === ErrorCategory.CONNECTION ||
           handledError.category === ErrorCategory.RATE_LIMIT)) {
        retryCount++;
        logger.info(`Đang thử đăng nhập lại sau ${LOGIN_RETRY_DELAY / 1000} giây...`);
        await new Promise(resolve => setTimeout(resolve, LOGIN_RETRY_DELAY));
        return attemptLogin();
      }

      throw error;
    }
  }

  return attemptLogin();
}

// Hàm tạo User-Agent ngẫu nhiên để tránh bị phát hiện
function getRandomUserAgent(): string {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}