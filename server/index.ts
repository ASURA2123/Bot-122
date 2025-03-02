import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { logger } from "../src/utils/logger";
import { botStatus } from '../src/services/bot-status';
import { systemMonitor } from '../src/services/system-monitor';
import { errorHandler } from '../src/utils/error-handler';
import { requestLogger, errorLogger } from './middleware/logger';
// Import middleware
import { jsonErrorHandler } from './middleware/validation';


// Initialize express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(jsonErrorHandler); // Xử lý lỗi JSON parser

// Middleware để ghi log request
app.use(requestLogger({
    logBody: true,
    excludePaths: ['/health', '/favicon.ico', '/metrics']
}));

// Middleware xử lý lỗi
app.use(errorLogger());

// Middleware giới hạn tốc độ yêu cầu
const rateLimiter = (limit: number, windowMs: number) => {
  const requests = new Map<string, number[]>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Lấy hoặc khởi tạo mảng thời gian yêu cầu cho IP
    const timestamps = requests.get(ip) || [];

    // Lọc ra các yêu cầu trong khung thời gian hiện tại
    const recentRequests = timestamps.filter(time => now - time < windowMs);

    // Nếu số lượng yêu cầu gần đây vượt quá giới hạn
    if (recentRequests.length >= limit) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Vui lòng thử lại sau'
      });
    }

    // Thêm thời gian yêu cầu hiện tại vào danh sách
    recentRequests.push(now);
    requests.set(ip, recentRequests);

    next();
  };
};

app.use(rateLimiter(100, 60000)); // Giới hạn 100 yêu cầu/phút


// Simple health check route
app.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    status: "ok",
    time: new Date().toISOString()
  });
});

// Basic status route
app.get("/", (_req: Request, res: Response) => {
  res.json({ 
    status: "online",
    message: "Server is running!",
    time: new Date().toISOString()
  });
});

// Route kiểm tra sức khỏe
app.get('/health', (req, res) => {
    const status = botStatus.isRunning() ? 'online' : 'offline';
    res.json({
      status,
      message: status === 'online' ? 'Server is running!' : 'Server is offline!',
      time: new Date()
    });
  });

// Route giám sát hệ thống
app.get('/metrics', (req, res) => {
    res.json(systemMonitor.getMetrics());
  });

// Route báo cáo hệ thống
app.get('/system/report', (req, res) => {
    res.json({
      system: systemMonitor.getMetrics(),
      health: systemMonitor.checkHealth(),
      report: systemMonitor.generateReport()
    });
  });

// Route kiểm tra lỗi
app.get('/errors/report', (req, res) => {
    errorHandler.logErrorReport();
    res.json({
      message: 'Error report has been logged',
      time: new Date()
    });
  });


// Import routes (assuming these routes exist)
import dashboardRoutes from './routes/dashboard';
import apiRoutes from './routes/api';

// Register routes
app.use(dashboardRoutes);
app.use(apiRoutes);

//Custom error handling middleware
const errorMiddleware: express.ErrorRequestHandler = (err, req, res, next) => {
    logger.error('Error caught by middleware:', err);
    const status = err.status || 500;
    res.status(status).json({
        error: err.message,
        status,
        timestamp: new Date().toISOString()
    });
};

app.use(errorMiddleware);


// Global error handling middleware (this will likely never be reached due to the above middleware)
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled Express error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Đã xảy ra lỗi không mong muốn'
      : err.message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint không tồn tại',
    path: req.path
  });
});

// Start server
async function startServer() {
  try {
    logger.info("Starting server initialization...");

    // Validate port with safe defaults
    let PORT = 3001; // Default port (will map to external port 3002)

    if (process.env.PORT) {
      const parsedPort = Number(process.env.PORT);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        PORT = parsedPort;
      } else {
        logger.warn(`Invalid port specified: ${process.env.PORT}, using default port 3001`);
      }
    } else {
      logger.info("No PORT specified in environment variables, using default port 3001");
    }

    // Function to find an available port
    const findAvailablePort = async (startPort: number): Promise<number> => {
      return new Promise((resolve) => {
        import('node:net').then(({ default: net }) => {
          const server = net.createServer();
          server.unref();

        server.on('error', () => {
            // Port is in use, try the next one
            resolve(findAvailablePort(startPort + 1));
          });

          server.listen(startPort, '0.0.0.0', () => {
            server.close(() => {
              resolve(startPort);
            });
          });
        });
      });
    };

    // Find an available port and start the server
    return new Promise(async (resolve, reject) => {
      try {
        const availablePort = await findAvailablePort(PORT);
        if (availablePort !== PORT) {
          logger.warn(`Port ${PORT} is in use, using alternative port ${availablePort}`);
          PORT = availablePort;
        }

        logger.info(`Attempting to start server on port ${PORT}...`);
        const server = app.listen(PORT, "0.0.0.0", () => {
          logger.info(`Server started successfully on port ${PORT}`);
          logger.info(`Health check endpoint: http://0.0.0.0:${PORT}/health`);

          // Khởi động giám sát hệ thống
          systemMonitor.start(30000); // Cập nhật metrics mỗi 30 giây

          // Xử lý sự kiện health_issues - chỉ log ra một lần khi có vấn đề mới
          systemMonitor.on('health_issues', (issues) => {
            // Sự kiện này sẽ được xử lý trong SystemMonitor class
            // và chỉ thông báo khi có vấn đề mới
          });

          // Xử lý sự kiện lỗi từ errorHandler
          errorHandler.on('error_threshold_reached', (data) => {
            logger.warn(`Error threshold reached for ${data.name}`, { count: data.count });
          });
        }).on('error', (error: Error) => {
          logger.error("Failed to start server:", error);
          reject(error);
        });

        // Add connection event handler
        server.on('connection', (socket) => {
          logger.debug(`New connection from ${socket.remoteAddress}`);
        });

        // Handle server errors
        server.on('error', (error: Error) => {
          logger.error("Server error:", error);
          process.exit(1);
        });

        // Handle graceful shutdown
        const shutdown = () => {
          logger.info("Shutting down server...");
          server.close(() => {
            logger.info("Server closed");
            process.exit(0);
          });

          // Force close after 10s
          setTimeout(() => {
            logger.error("Could not close connections in time, forcefully shutting down");
            process.exit(1);
          }, 10000);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

        // Add unhandled rejection handler
        process.on('unhandledRejection', (error: Error) => {
          logger.error('Unhandled rejection:', error);
          shutdown();
        });
      } catch (error) {
        logger.error("Lỗi không xác định khi khởi tạo server:", error);
        reject(error);
      }
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Server initialization error:", err);
    throw err;
  }
}

// Start server with error handling and retry logic
let retryCount = 0;
const MAX_RETRIES = 3;

async function startWithRetry() {
  try {
    await startServer();
  } catch (error) {
    retryCount++;
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Server start attempt ${retryCount} failed:`, err);

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying in 5 seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      setTimeout(startWithRetry, 5000);
    } else {
      logger.error(`Failed to start server after ${MAX_RETRIES} attempts`);
      process.exit(1);
    }
  }
}

startWithRetry();