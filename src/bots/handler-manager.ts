import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";

export interface BotHandler {
  name: string;
  prefix: string;
  handle: (api: Api, event: MessageEvent) => Promise<void>;
}

export class BotHandlerManager {
  private handlers: Map<string, BotHandler>;

  constructor() {
    this.handlers = new Map();
  }

  registerHandler(handler: BotHandler) {
    this.handlers.set(handler.prefix, handler);
    logger.info(`Registered bot handler: ${handler.name}`);
  }

  getHandler(message: string): BotHandler | null {
    for (const [prefix, handler] of this.handlers) {
      if (message.startsWith(prefix)) {
        return handler;
      }
    }
    return null;
  }

  getAllHandlers(): BotHandler[] {
    return Array.from(this.handlers.values());
  }
}

// Export a singleton instance
export const botHandlerManager = new BotHandlerManager();
