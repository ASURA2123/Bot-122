import { Api, FacebookApiError } from "../types";
import { handleMessage } from "./message";
import { logger } from "../utils/logger";
import { connectionManager } from "../utils/connection-manager";

// Known Facebook API error codes that can be safely ignored
const IGNORABLE_FB_ERRORS = [1357001, 1357004, 1357007];

export function registerEvents(api: Api) {
  connectionManager.setApi(api);

  // Set up message handler
  api.listenMqtt(async (err, event) => {
    if (err) {
      const fbError = err as FacebookApiError;
      logger.debug(`MQTT error: ${fbError.message} [${fbError.error}]`);

      // Handle ignorable errors
      if (IGNORABLE_FB_ERRORS.includes(fbError.error as number)) {
        logger.debug("Non-critical Facebook API error, continuing...");
        return;
      }

      // For other errors, let connection manager handle reconnect
      return;
    }

    // Handle messages
    try {
      if (event && event.type === "message" && event.threadID) {
        await handleMessage(api, event);
      }
    } catch (error) {
      logger.error(`Lỗi xử lý tin nhắn: ${(error as Error).message}`);
    }
  });

  // Start initial connection
  connectionManager.connect().catch(err => {
    logger.error("Lỗi kết nối ban đầu:", err);
    throw err;
  });

  logger.info("Đã đăng ký xử lý sự kiện");
}