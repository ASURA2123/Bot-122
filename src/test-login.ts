import fbChat from "facebook-chat-api";
import { logger } from "./utils/logger";
import { checkCookies } from "./utils/check-cookies";
import fs from "fs-extra";
import { ErrorHandler, ErrorCategory } from "./utils/error-handler";
import { CookieManager } from "./utils/cookie-manager";

interface FacebookCookie {
  key: string;
  value: string;
  domain: string;
  path: string;
}

interface AppState {
  key: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  creation: string;
  lastAccessed: string;
}

// Add type definitions for facebook-chat-api options
interface FacebookChatOptions {
  appState: AppState[];
  [key: string]: unknown;
}

async function testLogin() {
  try {
    logger.info("Bắt đầu kiểm tra đăng nhập...");

    // Kiểm tra cookies
    const isValid = await checkCookies();
    if (!isValid) {
      const error = new Error("Cookie validation failed");
      error.name = "CookieValidationError";
      logger.error("Kiểm tra cookies thất bại", error);
      process.exit(1);
    }

    // Đọc cookies sử dụng CookieManager
    const cookies = await CookieManager.loadCookies();
    logger.info(`Tìm thấy ${cookies.length} cookies`);

    // Format thành appState sử dụng CookieManager
    const appState = CookieManager.formatCookiesForState(cookies);

    // Thử đăng nhập
    logger.info("Đang thử đăng nhập...");
    await new Promise((resolve, reject) => {
      const options: FacebookChatOptions = {
        appState,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        logLevel: 'silly', // Chi tiết hơn để debug
        forceLogin: true,
        selfListen: true,
        listenEvents: true,
        updatePresence: false,
        autoMarkDelivery: true,
        autoMarkRead: false,
        // Thêm timeout dài hơn
        timeout: 60000
      };

      fbChat(options, (err, api) => {
        if (err) {
          // Kiểm tra cụ thể hơn về lỗi
          let errorMessage = '';
          let errorCategory = ErrorCategory.UNKNOWN;
          
          if (typeof err === 'object') {
            if (err.error === 'login-approval') {
              errorMessage = 'Cần xác minh 2FA để đăng nhập. Vui lòng đăng nhập thủ công và lấy cookies.';
              errorCategory = ErrorCategory.AUTH;
            } else if (typeof err.error === 'string' && err.error.includes('HTML')) {
              errorMessage = 'Facebook yêu cầu xác thực bổ sung hoặc thay đổi tạm thời. Vui lòng đăng nhập thủ công qua trình duyệt.';
              errorCategory = ErrorCategory.AUTH;
            } else if (err.error === 'Not logged in') {
              errorMessage = 'Cookies không hợp lệ hoặc đã hết hạn. Vui lòng cập nhật cookies mới.';
              errorCategory = ErrorCategory.AUTH;
            } else if (err.error && typeof err.error === 'string' && err.error.includes('rate limit')) {
              errorMessage = 'Bị giới hạn tốc độ truy cập. Vui lòng thử lại sau.';
              errorCategory = ErrorCategory.RATE_LIMIT;
            } else {
              errorMessage = JSON.stringify(err, null, 2);
            }
          } else {
            errorMessage = String(err);
          }
          const error = new Error(errorMessage);
          error.name = "FacebookLoginError";
          logger.error("Chi tiết lỗi đăng nhập:", error);
          reject(error);
        } else {
          const userID = api.getCurrentUserID();
          logger.info(`Đăng nhập thành công! ID: ${userID}`);
          // Lưu appState cho lần sau
          fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()), 'utf8');
          logger.info('Đã lưu appState mới');
          resolve(api);
        }
      });
    });

    process.exit(0);
  } catch (error) {
    const handledError = ErrorHandler.getErrorDetails(error instanceof Error ? error : new Error(String(error)));
    logger.error("Lỗi kiểm tra đăng nhập", new Error(handledError.message));
    process.exit(1);
  }
}

testLogin();