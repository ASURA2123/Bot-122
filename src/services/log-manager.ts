import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import zod from 'zod';

const LogEntrySchema = zod.object({
  id: zod.string(),
  level: zod.enum(['info', 'error', 'warn', 'debug']),
  message: zod.string(),
  timestamp: zod.string(),
  details: zod.record(zod.unknown()).optional()
});

type LogEntry = zod.infer<typeof LogEntrySchema>;

interface LogConfig {
  maxLogs: number;
  logDir: string;
  systemLogFile: string;
  errorLogFile: string;
  rotateSize: number; // in bytes
  maxBackups: number;
  maxLogSizeInMemory: number; // in bytes
}

class LogManager extends EventEmitter {
  private logs: LogEntry[] = [];
  private _hasInitError: boolean = false; // Flag to track initialization errors
  private config: LogConfig = {
    maxLogs: 1000,
    logDir: 'logs',
    systemLogFile: 'system.log',
    errorLogFile: 'error.log',
    rotateSize: 5 * 1024 * 1024, // 5MB
    maxBackups: 5,
    maxLogSizeInMemory: 10 * 1024 * 1024 // 10MB in memory
  };

  constructor() {
    super();
    this.initializeLogDirectory();
    this.loadExistingLogs();
    this.startPeriodicCleanup();
  }

  private async initializeLogDirectory() {
    try {
      await fs.ensureDir(this.config.logDir);
      await fs.ensureFile(path.join(this.config.logDir, this.config.systemLogFile));
      await fs.ensureFile(path.join(this.config.logDir, this.config.errorLogFile));
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
      this._hasInitError = true; // Set flag if initialization fails
    }
  }

  private async loadExistingLogs() {
    try {
      const systemLogPath = path.join(this.config.logDir, this.config.systemLogFile);
      if (await fs.pathExists(systemLogPath)) {
        const content = await fs.readFile(systemLogPath, 'utf8');
        this.logs = content
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              const parsed = JSON.parse(line);
              return LogEntrySchema.parse(parsed);
            } catch {
              return null;
            }
          })
          .filter((log): log is LogEntry => log !== null)
          .slice(-this.config.maxLogs);
      }
    } catch (error) {
      console.error('Failed to load existing logs:', error);
      // Continue with empty logs array
      this.logs = [];
    }
  }

  private startPeriodicCleanup() {
    setInterval(() => {
      this.rotateLogsIfNeeded();
      this.cleanupOldLogs();
    }, 60 * 60 * 1000); // Check every hour
  }

  private async rotateLogsIfNeeded() {
    try {
      const systemLogPath = path.join(this.config.logDir, this.config.systemLogFile);
      const stats = await fs.stat(systemLogPath);

      if (stats.size > this.config.rotateSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(
          this.config.logDir,
          `system.${timestamp}.log`
        );

        await fs.move(systemLogPath, backupPath);
        await fs.writeFile(systemLogPath, ''); // Create new empty log file

        // Remove old backups if exceeding maxBackups
        const files = await fs.readdir(this.config.logDir);
        const backups = files
          .filter(f => f.startsWith('system.') && f.endsWith('.log'))
          .sort()
          .reverse();

        for (const backup of backups.slice(this.config.maxBackups)) {
          await fs.remove(path.join(this.config.logDir, backup));
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private async cleanupOldLogs() {
    try {
      // Giới hạn số lượng logs trong bộ nhớ
      if (this.logs.length > this.config.maxLogs) {
        console.log(`Cleaning up logs: ${this.logs.length} items exceeds limit of ${this.config.maxLogs}`);
        this.logs = this.logs.slice(-this.config.maxLogs);
      }

      // Kiểm tra tổng kích thước logs trong bộ nhớ
      let totalSize = 0;
      for (const log of this.logs) {
        totalSize += JSON.stringify(log).length;
      }

      // Nếu vượt quá giới hạn, loại bỏ logs cũ
      if (totalSize > this.config.maxLogSizeInMemory) {
        console.warn(`Log memory size (${totalSize} bytes) exceeds limit (${this.config.maxLogSizeInMemory} bytes)`);

        // Giảm số logs đi 20% để tránh phải cleanup liên tục
        const keepCount = Math.floor(this.logs.length * 0.8);
        this.logs = this.logs.slice(-keepCount);
        console.log(`Reduced log count to ${this.logs.length} items to save memory`);
      }

      // Lưu logs sau khi đã clean up
      await this.saveLogsToFile();
    } catch (error) {
      console.error('Error during log cleanup:', error);
      // Không throw lỗi, tiếp tục hoạt động
    }
  }

  private async saveLogsToFile() {
    if (this._hasInitError) {
      console.warn('Skipping log file write due to initialization error');
      return;
    }

    try {
      // Kiểm tra thư mục logs tồn tại trước khi ghi
      await fs.ensureDir(this.config.logDir);

      const systemLogPath = path.join(this.config.logDir, this.config.systemLogFile);
      const content = this.logs.map(log => JSON.stringify(log)).join('\n') + '\n';

      await fs.writeFile(systemLogPath, content);
    } catch (error) {
      console.error('Failed to save logs:', error);
      // Không throw lỗi, chỉ ghi log lỗi ra console
      this._hasInitError = true;
    }
  }

  async addLog(level: LogEntry['level'], message: string, details?: Record<string, unknown>) {
    try {
      const log: LogEntry = {
        id: Date.now().toString(),
        level,
        message,
        timestamp: new Date().toISOString(),
        details
      };

      // Validate log entry
      LogEntrySchema.parse(log);

      this.logs.push(log);
      this.emit('newLog', log);

      // Save errors to separate error log file
      if (level === 'error') {
        const errorLogPath = path.join(this.config.logDir, this.config.errorLogFile);
        await fs.appendFile(
          errorLogPath,
          JSON.stringify(log) + '\n'
        );
      }

      await this.saveLogsToFile();
      return log;
    } catch (error) {
      console.error('Failed to add log:', error);
      // Do not throw error, just log it.
    }
  }

  getLogs(level: string = 'all', limit: number = 100): LogEntry[] {
    if (limit <= 0 || limit > this.config.maxLogs) {
      throw new Error(`Invalid limit: must be between 1 and ${this.config.maxLogs}`);
    }

    if (level === 'all') {
      return this.logs.slice(-limit);
    }

    const levelOrder = ['debug', 'info', 'warn', 'error'];
    const minLevel = levelOrder.indexOf(level);

    if (minLevel === -1) {
      throw new Error('Invalid log level specified');
    }

    return this.logs
      .filter(log => levelOrder.indexOf(log.level) >= minLevel)
      .slice(-limit);
  }

  async clearLogs() {
    this.logs = [];
    await this.saveLogsToFile();
    this.emit('logsCleared');
  }

  getLogStats() {
    const levelCounts = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLogs: this.logs.length,
      byLevel: levelCounts,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp
    };
  }
}

export const logManager = new LogManager();