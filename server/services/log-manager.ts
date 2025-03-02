import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { z } from 'zod';

const LogEntrySchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'error', 'warn', 'debug']),
  message: z.string(),
  timestamp: z.string(),
  details: z.record(z.unknown()).optional()
});

type LogEntry = z.infer<typeof LogEntrySchema>;

class LogManager extends EventEmitter {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;
  private readonly logDir = 'logs';
  private readonly systemLogFile = 'system.log';
  private readonly errorLogFile = 'error.log';

  constructor() {
    super();
    // Thiết lập giới hạn listener để tránh memory leak
    this.setMaxListeners(20);
    this.initializeLogDirectory();
    logger.info('LogManager initialized with max listeners: 20');
  }

  private async initializeLogDirectory() {
    try {
      await fs.ensureDir(this.logDir);
      await fs.ensureFile(path.join(this.logDir, this.systemLogFile));
      await fs.ensureFile(path.join(this.logDir, this.errorLogFile));
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
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

      // Save to appropriate log file
      const logPath = path.join(this.logDir, level === 'error' ? this.errorLogFile : this.systemLogFile);
      await fs.appendFile(logPath, JSON.stringify(log) + '\n');

      // Maintain max logs limit
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      return log;
    } catch (error) {
      console.error('Failed to add log:', error);
      throw error;
    }
  }

  getLogs(level: string = 'all'): LogEntry[] {
    if (level === 'all') {
      return this.logs.slice(-100);
    }

    const levelOrder = ['debug', 'info', 'warn', 'error'];
    const minLevel = levelOrder.indexOf(level);

    if (minLevel === -1) {
      throw new Error('Invalid log level specified');
    }

    return this.logs
      .filter(log => levelOrder.indexOf(log.level) >= minLevel)
      .slice(-100);
  }
}

export const logManager = new LogManager();