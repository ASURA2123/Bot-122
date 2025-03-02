import { Api, FacebookApiError } from "../types";
import { logger } from "./logger";
import { sessionManager } from "./session-manager";
import { ErrorHandler, ErrorCategory } from "./error-handler";

const INITIAL_RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_DELAY = 300000; // 5 minutes 
const MAX_RECONNECT_ATTEMPTS = 10;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

export class ConnectionManager {
  private api: Api | null = null;
  private reconnectAttempts = 0;
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  setApi(api: Api) {
    this.api = api;
    this.reconnectAttempts = 0;
    this.connected = false;
    this.startHealthCheck();
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.api || !this.connected) return;

      try {
        const isValid = await this.validateConnection();
        if (!isValid) {
          logger.warn("Phát hiện kết nối không ổn định trong health check");
          await this.handleConnectionFailure(new Error("Health check failed"));
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Lỗi trong quá trình health check", err);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private async validateConnection(): Promise<boolean> {
    if (!this.api) return false;

    try {
      // Check session validity
      if (!sessionManager.isValid()) {
        logger.warn("Phiên đăng nhập không hợp lệ, cần làm mới...");
        return false;
      }

      // Test basic API functionality
      const userId = this.api.getCurrentUserID();
      await this.api.getUserInfo(userId);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const handledError = ErrorHandler.getErrorDetails(err);

      logger.error("Lỗi kiểm tra kết nối", err);
      return false;
    }
  }

  private calculateBackoffDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    // Add random jitter ±20%
    const jitter = baseDelay * 0.2;
    return baseDelay + (Math.random() * 2 - 1) * jitter;
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async handleConnectionFailure(error: Error) {
    const handledError = ErrorHandler.getErrorDetails(error);

    // Reset connection state
    this.connected = false;

    // Handle based on error category
    switch (handledError.category) {
      case ErrorCategory.AUTH:
        logger.error("Lỗi xác thực - cần đăng nhập lại", error);
        throw error; // Let the main loop handle reauth

      case ErrorCategory.SESSION:
        if (await sessionManager.forceRefresh()) {
          logger.info("Đã làm mới phiên thành công");
          return this.connect();
        }
        throw error;

      case ErrorCategory.CONNECTION:
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = this.calculateBackoffDelay();

          logger.warn(
            `Mất kết nối MQTT, thử kết nối lại lần ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} sau ${delay/1000}s`
          );

          await new Promise(resolve => setTimeout(resolve, delay));
          return this.connect();
        }
        throw new Error("Vượt quá số lần thử kết nối lại tối đa");

      default:
        if (handledError.recoverable) {
          return this.connect();
        }
        throw error;
    }
  }

  async connect() {
    if (!this.api) {
      throw new Error("API chưa được khởi tạo");
    }

    this.clearReconnectTimeout();

    return new Promise<void>((resolve, reject) => {
      this.api!.listenMqtt(async (err) => {
        if (err) {
          try {
            await this.handleConnectionFailure(err as Error);
            resolve();
          } catch (error) {
            reject(error);
          }
          return;
        }

        // Connection successful
        if (!this.connected) {
          this.connected = true;
          this.reconnectAttempts = 0;
          logger.info("Kết nối MQTT thành công");
        }

        resolve();
      });
    });
  }

  async disconnect() {
    this.clearReconnectTimeout();

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;
  }

  getConnectionStatus(): string {
    if (!this.api) return 'Chưa khởi tạo';
    if (!this.connected) return 'Mất kết nối';
    if (!sessionManager.isValid()) return 'Phiên không hợp lệ';
    return 'Đã kết nối';
  }

  isConnected(): boolean {
    return this.connected && sessionManager.isValid();
  }

  async validateAndReconnect(): Promise<boolean> {
    if (!await this.validateConnection()) {
      logger.warn("Kết nối không hợp lệ, thử kết nối lại...");
      try {
        await this.connect();
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Không thể kết nối lại", err);
        return false;
      }
    }
    return true;
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();