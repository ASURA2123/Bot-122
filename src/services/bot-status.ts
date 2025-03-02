import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface BotStatusData {
  isRunning: boolean;
  startTime: number | null;
  lastError: Error | null;
  connectedUsers: number;
  connectedThreads: number;
  lastActivity: Date | null;
  initialized: boolean;
}

class BotStatus extends EventEmitter {
  private status: BotStatusData;

  constructor() {
    super();
    this.status = {
      isRunning: false,
      startTime: null,
      lastError: null,
      connectedUsers: 0,
      connectedThreads: 0,
      lastActivity: null,
      initialized: false,
    };
    logger.info('Bot status service initialized');
    this.status.initialized = true;
  }

  start(): void {
    this.status.isRunning = true;
    this.status.startTime = Date.now();
    this.emit('bot_started');
    logger.info('Bot marked as running');
  }

  stop(reason?: string): void {
    this.status.isRunning = false;
    this.emit('bot_stopped', reason);
    logger.info(`Bot marked as stopped${reason ? `: ${reason}` : ''}`);
  }

  isRunning(): boolean {
    return this.status.isRunning && this.status.initialized;
  }

  isInitialized(): boolean {
    return this.status.initialized;
  }

  setError(error: Error): void {
    this.status.lastError = error;
    this.emit('bot_error', error);
    logger.error('Bot encountered an error:', error);
  }

  clearError(): void {
    this.status.lastError = null;
  }

  getLastError(): Error | null {
    return this.status.lastError;
  }

  setConnections(users: number, threads: number): void {
    this.status.connectedUsers = users;
    this.status.connectedThreads = threads;
    this.status.lastActivity = new Date();
    this.emit('connections_updated', { users, threads });
  }

  getConnectionsInfo(): { users: number; threads: number } {
    return {
      users: this.status.connectedUsers,
      threads: this.status.connectedThreads
    };
  }

  getUptime(): number | null {
    if (!this.status.startTime) return null;
    return Math.floor((Date.now() - this.status.startTime) / 1000);
  }

  getStatus(): BotStatusData {
    return { ...this.status };
  }

  recordActivity(): void {
    this.status.lastActivity = new Date();
  }

  getLastActivity(): Date | null {
    return this.status.lastActivity;
  }

  performHealthCheck(): boolean {
    // During startup phase, we'll be more lenient with health checks
    const startupPhase = this.status.startTime && (Date.now() - this.status.startTime < 2 * 60 * 1000); // 2 minutes grace period
    
    // Base health check on running status only during startup
    if (startupPhase) {
      return this.status.isRunning;
    }
    
    // Regular health check after startup phase
    const activityTimeout = 10 * 60 * 1000; // 10 minutes (more lenient than before)
    const hasRecentActivity = !this.status.lastActivity || (Date.now() - this.status.lastActivity.getTime()) < activityTimeout;
    
    // We don't require connected users during development/testing
    const isHealthy = this.status.isRunning && hasRecentActivity;
    
    if (!isHealthy) {
      logger.warn("Health issues detected:");
      logger.warn(`Bot is running: ${this.status.isRunning}, Connected Users: ${this.status.connectedUsers}, Last Activity: ${this.status.lastActivity ? this.status.lastActivity.toISOString() : 'none'}`);
    }
    return isHealthy;
  }
}

// Export a singleton instance
export const botStatus = new BotStatus();