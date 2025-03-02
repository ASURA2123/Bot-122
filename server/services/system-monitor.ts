import os from 'os';
import { EventEmitter } from 'events';

interface SystemStatus {
  status: 'online' | 'offline' | 'error';
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  cpu: number;
  lastError?: {
    message: string;
    timestamp: string;
  };
  connectedThreads: number;
}

class SystemMonitor extends EventEmitter {
  private startTime: number;
  private lastError?: {
    message: string;
    timestamp: string;
  };
  private connectedThreads: number = 0;
  private readonly maxCpuThreshold = 90; // 90% CPU usage threshold
  private readonly maxMemThreshold = 0.9; // 90% memory usage threshold

  constructor() {
    super();
    this.startTime = Date.now();
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      this.emit('status', this.getCurrentStatus());
    }, 5000);
  }

  getCurrentStatus(): SystemStatus {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      status: this.lastError ? 'error' : this.connectedThreads > 0 ? 'online' : 'offline',
      uptime,
      memory: {
        used: usedMemory,
        total: totalMemory
      },
      cpu: Math.min(os.loadavg()[0] * 100, 100), // Ensure CPU % doesn't exceed 100
      lastError: this.lastError,
      connectedThreads: this.connectedThreads
    };
  }

  recordError(error: Error) {
    if (!error || typeof error.message !== 'string') {
      throw new Error('Invalid error object provided to recordError');
    }

    this.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    this.emit('error', this.lastError);
  }

  clearError() {
    this.lastError = undefined;
    this.emit('errorCleared');
  }

  updateThreadCount(count: number) {
    if (typeof count !== 'number' || count < 0) {
      throw new Error('Thread count must be a non-negative number');
    }

    this.connectedThreads = count;
    this.emit('threadsUpdated', count);
  }
}

export const systemMonitor = new SystemMonitor();