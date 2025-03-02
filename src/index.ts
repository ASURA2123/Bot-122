import { loginBot, refreshState } from "./utils/login";
import { registerEvents } from "./events";
import { logger } from "./utils/logger"; 
import { Api } from "./types";
import { sessionManager } from "./utils/session-manager";
import { connectionManager } from "./utils/connection-manager";
import { statsManager } from "./services/stats-manager";
import { systemMonitor } from "./services/system-monitor";
import { ErrorHandler } from "./utils/error-handler";
import { initializeModules } from "./utils/module-integration";
import { initializeLoggerIntegration } from "./utils/logger-integration";

const RECONNECT_DELAY = 30000; // 30 seconds
const STATE_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour
let isShuttingDown = false;
let api: Api | null = null;

// Initialize services in a non-blocking way
async function initializeServices() {
  try {
    logger.info("Initializing services...");

    // Initialize logger integration
    await initializeLoggerIntegration();
    logger.info("Logger integration initialized");

    // Start system monitoring
    systemMonitor.updateThreadCount(0);
    logger.info("System monitoring started");

    // Initialize stats manager
    await statsManager.initialize();
    logger.info("Stats manager initialized");

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    err.name = 'ServiceInitializationError';
    logger.error("Service initialization failed:", err);
    return false;
  }
}

// Export bot startup function for server to use
export async function startBot(): Promise<Api> {
  try {
    logger.info("Starting Facebook Messenger Bot...");

    // Initialize services before bot login
    const servicesReady = await initializeServices();
    if (!servicesReady) {
      throw new Error("Services initialization failed");
    }

    const newApi = await loginBot();
    api = newApi;

    // Initialize module system
    const modulesReady = await initializeModules(newApi);
    if (!modulesReady) {
      logger.warn("Module system initialization failed, continuing without modules");
    }

    // Register event handlers
    registerEvents(newApi);
    logger.info("Bot event handlers registered");

    // Set up periodic state refresh in a non-blocking way
    setInterval(() => {
      if (api) {
        refreshState(api).catch(error => {
          const err = error instanceof Error ? error : new Error(String(error));
          err.name = 'StateRefreshError';
          logger.error("State refresh failed:", err);
        });
      }
    }, STATE_REFRESH_INTERVAL);

    return newApi;
  } catch (error) {
    const handledError = ErrorHandler.getErrorDetails(error instanceof Error ? error : new Error(String(error)));
    logger.error("Bot startup failed:", new Error(handledError.message));
    systemMonitor.recordError(new Error(handledError.message));
    throw error;
  }
}

// Graceful shutdown function
export function shutdownBot() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Shutting down bot gracefully...");

  // Stop managers
  sessionManager.stop();
  connectionManager.disconnect();

  if (api) {
    try {
      refreshState(api);
      logger.info("Final state saved");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'ShutdownError';
      logger.error("Error saving final state:", err);
    }
  }
}

async function main() {
  try {
    logger.info("Starting main application loop");

    while (!isShuttingDown) {
      try {
        // Start bot in a non-blocking way
        api = await new Promise((resolve, reject) => {
          setImmediate(async () => {
            try {
              const botApi = await startBot();
              resolve(botApi);
            } catch (error) {
              reject(error);
            }
          });
        });

        await new Promise<void>((_, reject) => {
          if (!api) {
            const error = new Error("API instance doesn't exist");
            error.name = 'APINotFoundError';
            reject(error);
            return;
          }

          // Check connection and session status periodically
          const healthCheck = setInterval(() => {
            const sessionStatus = sessionManager.getSessionStatus();
            const connectionStatus = connectionManager.getConnectionStatus();

            logger.debug("Health check status:", {
              session: sessionStatus,
              connection: connectionStatus
            });

            if (sessionStatus !== 'active' || connectionStatus !== 'connected') {
              clearInterval(healthCheck);
              const error = new Error(`Issue detected: Session=${sessionStatus}, Connection=${connectionStatus}`);
              error.name = 'HealthCheckError';
              reject(error);
            }
          }, 60000); // Check every minute
        });
      } catch (error) {
        if (isShuttingDown) break;

        const handledError = ErrorHandler.getErrorDetails(error instanceof Error ? error : new Error(String(error)));
        logger.error("Bot operation error:", new Error(handledError.message));

        await connectionManager.disconnect();

        logger.info(`Waiting ${RECONNECT_DELAY/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    err.name = 'MainLoopError';
    logger.error("Fatal error in main loop:", err);
    process.exit(1);
  }
}

// Start bot with delay to allow server to start first
setTimeout(() => {
  main().catch(error => {
    logger.errorBox('❌ Lỗi khởi động bot');
    logger.error(`Chi tiết lỗi: ${error.message}`);
    logger.debug(error.stack || 'Không có stack trace');
    process.exit(1);
  });
}, 5000); // Wait 5 seconds before starting bot

// Handle shutdown signals
process.on("SIGINT", shutdownBot);
process.on("SIGTERM", shutdownBot);

// Handle uncaught errors
process.on("uncaughtException", (error: Error) => {
  const handledError = ErrorHandler.getErrorDetails(error);
  logger.error("Uncaught exception:", new Error(handledError.message));
  systemMonitor.recordError(new Error(handledError.message));
  shutdownBot();
});

process.on("unhandledRejection", (error: unknown) => {
  const handledError = error instanceof Error ? error : new Error(String(error));
  logger.error("Unhandled promise rejection:", handledError);
  systemMonitor.recordError(handledError);
  shutdownBot();
});