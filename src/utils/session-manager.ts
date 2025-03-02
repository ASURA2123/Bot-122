import { Api } from "../types";
import { logger } from "./logger";
import { CookieManager } from "./cookie-manager";
import fs from "fs-extra";
import { ErrorHandler, ErrorCategory } from "./error-handler";

const STATE_FILE = "fbstate.json";
const STATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours 

export class SessionManager {
  private api: Api | null = null;
  private lastValidation: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  private sessionErrors: number = 0;
  private readonly MAX_SESSION_ERRORS = 3;

  constructor() {
    this.startSessionCheck();
  }

  setApi(api: Api) {
    this.api = api;
    this.lastValidation = Date.now();
    this.sessionErrors = 0;
  }

  private startSessionCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        const isValid = await this.validateSession();
        if (!isValid) {
          this.sessionErrors++;
          if (this.sessionErrors >= this.MAX_SESSION_ERRORS) {
            const error = new Error(`Phiên không hợp lệ sau ${this.MAX_SESSION_ERRORS} lần kiểm tra`);
            error.name = 'SessionValidationError';
            logger.error("Phiên liên tục không hợp lệ", error);
            throw error;
          }
          await this.refreshSession();
        } else {
          this.sessionErrors = 0;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Lỗi kiểm tra phiên", err);
      }
    }, STATE_CHECK_INTERVAL);
  }

  private async validateSession(): Promise<boolean> {
    if (!this.api) return false;

    try {
      // Check if session is too old
      if (Date.now() - this.lastValidation > SESSION_TIMEOUT) {
        logger.warn("Phiên đăng nhập quá cũ, cần làm mới...");
        return false;
      }

      // Verify API functionality 
      const userId = this.api.getCurrentUserID();
      if (!userId) return false;

      // Test basic API call
      await this.api.getUserInfo(userId);

      // Update validation timestamp
      this.lastValidation = Date.now();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const handledError = ErrorHandler.getErrorDetails(err);

      // Only count as error if it's session-related
      if (handledError.category === ErrorCategory.SESSION || 
          handledError.category === ErrorCategory.AUTH) {
        this.sessionErrors++;
      }

      logger.error("Lỗi xác thực phiên", err);
      return false;
    }
  }

  async refreshSession(): Promise<boolean> {
    if (!this.api) return false;

    try {
      // Get current state
      const newState = this.api.getAppState();

      // Save state
      await fs.writeJSON(STATE_FILE, newState, { spaces: 2 });

      // Extract and save cookies
      const cookies = newState.map(cookie => ({
        key: cookie.key,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path
      }));

      await CookieManager.saveCookies(cookies);

      // Reset error count on successful refresh
      this.sessionErrors = 0;
      this.lastValidation = Date.now();

      logger.info("Đã làm mới phiên đăng nhập thành công");

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'SessionRefreshError';
      logger.error("Lỗi làm mới phiên", err);
      return false;
    }
  }

  async forceRefresh(): Promise<boolean> {
    const success = await this.refreshSession();
    if (success) {
      this.lastValidation = Date.now();
      this.sessionErrors = 0;
    }
    return success;
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isValid(): boolean {
    return this.api !== null && 
           Date.now() - this.lastValidation < SESSION_TIMEOUT &&
           this.sessionErrors < this.MAX_SESSION_ERRORS;
  }

  getSessionStatus(): string {
    if (!this.api) return 'Chưa khởi tạo';
    if (this.sessionErrors >= this.MAX_SESSION_ERRORS) return 'Lỗi liên tục';
    if (Date.now() - this.lastValidation > SESSION_TIMEOUT) return 'Hết hạn';
    return 'Hoạt động';
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();