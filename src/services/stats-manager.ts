
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface MessageStats {
  id: string;
  content: string;
  senderID: string;
  threadID: string;
  timestamp: Date;
}

class StatsManager extends EventEmitter {
  private messageCount: number = 0;
  private commandCount: number = 0;
  private activeUsers: Set<string> = new Set();
  private recentMessages: MessageStats[] = [];
  private commandUsage: Map<string, number> = new Map();
  private hourlyActivity: number[] = new Array(24).fill(0);
  private resetTimer: NodeJS.Timeout | null = null;
  private readonly MAX_MESSAGES = 100; // Giới hạn số lượng tin nhắn lưu trữ
  private readonly MAX_COMMAND_TYPES = 1000; // Giới hạn số loại command khác nhau

  constructor() {
    super();
    // Thiết lập giới hạn số lượng listener để tránh memory leak
    this.setMaxListeners(20);
    this.resetDailyStats();
    logger.info('StatsManager initialized with max listeners: 20');
  }

  private resetDailyStats() {
    try {
      // Hủy timer cũ nếu có để tránh memory leak
      if (this.resetTimer) {
        clearInterval(this.resetTimer);
      }

      // Thiết lập timer mới
      this.resetTimer = setInterval(() => {
        try {
          const previousMessageCount = this.messageCount;
          const previousActiveUsers = this.activeUsers.size;
          
          this.messageCount = 0;
          this.activeUsers.clear();
          this.hourlyActivity = new Array(24).fill(0);
          
          logger.info(`Daily stats reset successful: ${previousMessageCount} messages, ${previousActiveUsers} users cleared`);
          this.emit('statsReset');
        } catch (error) {
          logger.error('Error resetting daily stats:', error);
        }
      }, 24 * 60 * 60 * 1000); // Reset every 24 hours
      
      logger.info('Daily stats reset timer initialized');
    } catch (error) {
      logger.error('Failed to initialize daily stats reset:', error);
    }
  }

  recordMessage(message: MessageStats) {
    try {
      // Kiểm tra dữ liệu đầu vào
      if (!message || !message.id || !message.senderID) {
        logger.warn('Invalid message data provided to recordMessage');
        return;
      }

      this.messageCount++;
      this.activeUsers.add(message.senderID);
      
      // Áp dụng giới hạn bộ nhớ cho recentMessages
      if (this.recentMessages.length >= this.MAX_MESSAGES) {
        this.recentMessages.pop(); // Xóa tin nhắn cũ nhất nếu đạt giới hạn
      }
      this.recentMessages.unshift(message);
      
      // Ghi lại hoạt động theo giờ
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 24) {
        this.hourlyActivity[hour]++;
      }

      // Kiểm tra kích thước bộ nhớ
      if (this.messageCount % 1000 === 0) {
        const memoryUsage = process.memoryUsage();
        logger.info(`Memory usage after ${this.messageCount} messages: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      }

      this.emit('messageReceived', message);
    } catch (error) {
      logger.error('Error recording message:', error);
    }
  }

  recordCommand(command: string) {
    try {
      if (!command) {
        logger.warn('Empty command provided to recordCommand');
        return;
      }

      this.commandCount++;
      
      // Kiểm tra giới hạn số lượng command types để tránh OOM
      if (this.commandUsage.size >= this.MAX_COMMAND_TYPES) {
        // Nếu command hiện tại không có trong map, xóa command ít dùng nhất
        if (!this.commandUsage.has(command)) {
          let leastUsedCommand = '';
          let leastUsedCount = Number.MAX_SAFE_INTEGER;
          
          for (const [cmd, count] of this.commandUsage.entries()) {
            if (count < leastUsedCount) {
              leastUsedCount = count;
              leastUsedCommand = cmd;
            }
          }
          
          if (leastUsedCommand) {
            this.commandUsage.delete(leastUsedCommand);
            logger.debug(`Removed least used command: ${leastUsedCommand} (${leastUsedCount} uses)`);
          }
        }
      }
      
      const currentCount = this.commandUsage.get(command) || 0;
      this.commandUsage.set(command, currentCount + 1);
      
      this.emit('commandUsed', command);
    } catch (error) {
      logger.error('Error recording command:', error);
    }
  }

  getBasicStats() {
    try {
      return {
        activeUsers: this.activeUsers.size,
        messagesToday: this.messageCount,
        commandsUsed: this.commandCount
      };
    } catch (error) {
      logger.error('Error getting basic stats:', error);
      return { activeUsers: 0, messagesToday: 0, commandsUsed: 0 };
    }
  }

  getDetailedStats() {
    try {
      return {
        timeline: this.getTimeline(),
        topCommands: this.getTopCommands(),
        userActivity: this.getHourlyActivity()
      };
    } catch (error) {
      logger.error('Error getting detailed stats:', error);
      return { timeline: [], topCommands: [], userActivity: [] };
    }
  }

  getRecentMessages() {
    return this.recentMessages;
  }

  private getTimeline() {
    try {
      const now = new Date();
      const timePoints = Array.from({length: 24}, (_, i) => {
        const date = new Date(now);
        date.setHours(now.getHours() - i);
        const hour = date.getHours();
        return {
          timestamp: date.toISOString(),
          messageCount: hour >= 0 && hour < 24 ? this.hourlyActivity[hour] : 0,
          activeUsers: this.activeUsers.size,
          commandUsage: this.commandCount
        };
      });
      return timePoints.reverse();
    } catch (error) {
      logger.error('Error generating timeline:', error);
      return [];
    }
  }

  private getTopCommands() {
    try {
      return Array.from(this.commandUsage.entries())
        .map(([command, count]) => ({ command, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (error) {
      logger.error('Error getting top commands:', error);
      return [];
    }
  }

  private getHourlyActivity() {
    try {
      return this.hourlyActivity.map((count, hour) => ({ hour, count }));
    } catch (error) {
      logger.error('Error getting hourly activity:', error);
      return [];
    }
  }
  
  // Phương thức cho phép dọn dẹp tài nguyên khi cần
  cleanup() {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = null;
    }
    this.removeAllListeners();
    logger.info('StatsManager resources cleaned up');
  }
}

export const statsManager = new StatsManager();
