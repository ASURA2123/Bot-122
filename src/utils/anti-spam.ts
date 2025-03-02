
import { logger } from './logger';

interface UserSpamData {
  count: number;
  lastMessageTime: number;
  blocked: boolean;
  blockTime: number;
  warningCount: number;
  contentHashes?: string[];  // Dùng để phát hiện tin nhắn lặp lại
}

interface AntiSpamOptions {
  enabled?: boolean;
  threshold?: number;
  timeWindow?: number;
  blockDuration?: number;
  warningsBeforeBlock?: number;
  detectDuplicates?: boolean;
  duplicateThreshold?: number;
  blockMessage?: string;
  whitelistUsers?: string[];
  whitelistThreads?: string[];
}

class AntiSpamService {
  private userMessages: Map<string, UserSpamData> = new Map();
  private enabled: boolean = true;
  private threshold: number = 5; // Số tin nhắn tối đa trong khoảng thời gian
  private timeWindow: number = 5000; // Khoảng thời gian (ms)
  private blockDuration: number = 60000; // Thời gian chặn (ms)
  private warningsBeforeBlock: number = 2; // Số cảnh báo trước khi chặn
  private detectDuplicates: boolean = true; // Phát hiện tin nhắn lặp lại
  private duplicateThreshold: number = 3; // Số lần lặp lại tối đa
  private blockMessage: string = "Bạn đã bị chặn tạm thời do gửi tin nhắn quá nhanh. Vui lòng thử lại sau.";
  private whitelistUsers: Set<string> = new Set();
  private whitelistThreads: Set<string> = new Set();

  constructor() {
    // Xóa dữ liệu cũ định kỳ
    setInterval(() => this.cleanOldData(), 5 * 60 * 1000); // 5 phút
  }

  public configure(options: AntiSpamOptions) {
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.threshold) this.threshold = options.threshold;
    if (options.timeWindow) this.timeWindow = options.timeWindow;
    if (options.blockDuration) this.blockDuration = options.blockDuration;
    if (options.warningsBeforeBlock) this.warningsBeforeBlock = options.warningsBeforeBlock;
    if (options.detectDuplicates !== undefined) this.detectDuplicates = options.detectDuplicates;
    if (options.duplicateThreshold) this.duplicateThreshold = options.duplicateThreshold;
    if (options.blockMessage) this.blockMessage = options.blockMessage;
    
    if (options.whitelistUsers) {
      this.whitelistUsers = new Set(options.whitelistUsers);
    }
    
    if (options.whitelistThreads) {
      this.whitelistThreads = new Set(options.whitelistThreads);
    }
    
    logger.info(`Anti-spam đã cấu hình: enabled=${this.enabled}, threshold=${this.threshold}, timeWindow=${this.timeWindow}ms, blockDuration=${this.blockDuration}ms`);
  }

  public addToWhitelist(userId: string, threadId?: string) {
    this.whitelistUsers.add(userId);
    if (threadId) {
      this.whitelistThreads.add(threadId);
    }
  }

  public removeFromWhitelist(userId: string, threadId?: string) {
    this.whitelistUsers.delete(userId);
    if (threadId) {
      this.whitelistThreads.delete(threadId);
    }
  }

  public isSpam(userId: string, threadId: string, content: string): boolean {
    if (!this.enabled) return false;
    
    // Kiểm tra whitelist
    if (this.whitelistUsers.has(userId) || this.whitelistThreads.has(threadId)) {
      return false;
    }
    
    const now = Date.now();
    const key = `${userId}_${threadId}`;
    
    // Kiểm tra xem người dùng có bị chặn không
    const userData = this.userMessages.get(key);
    if (userData && userData.blocked) {
      // Kiểm tra xem thời gian chặn đã hết chưa
      if (now - userData.blockTime < this.blockDuration) {
        return true;
      } else {
        // Hết thời gian chặn
        userData.blocked = false;
        userData.count = 1;
        userData.lastMessageTime = now;
        userData.warningCount = 0;
        this.userMessages.set(key, userData);
        return false;
      }
    }
    
    if (!userData) {
      // Người dùng gửi tin nhắn đầu tiên
      this.userMessages.set(key, {
        count: 1,
        lastMessageTime: now,
        blocked: false,
        blockTime: 0,
        warningCount: 0,
        contentHashes: this.detectDuplicates ? [this.hashContent(content)] : undefined
      });
      return false;
    }
    
    // Phát hiện tin nhắn lặp lại
    if (this.detectDuplicates && userData.contentHashes) {
      const contentHash = this.hashContent(content);
      if (userData.contentHashes.includes(contentHash)) {
        // Đếm số lần tin nhắn này đã được gửi
        const duplicateCount = userData.contentHashes.filter(hash => hash === contentHash).length;
        
        if (duplicateCount >= this.duplicateThreshold) {
          userData.blocked = true;
          userData.blockTime = now;
          this.userMessages.set(key, userData);
          
          logger.warn(`Phát hiện tin nhắn lặp lại từ người dùng ${userId} trong nhóm ${threadId}, chặn tạm thời ${this.blockDuration/1000}s`);
          return true;
        }
      }
      
      // Thêm hash nội dung vào danh sách
      userData.contentHashes.push(contentHash);
      if (userData.contentHashes.length > 10) {
        userData.contentHashes = userData.contentHashes.slice(-10); // Giữ 10 hash gần nhất
      }
    }
    
    // Nếu tin nhắn trong cửa sổ thời gian
    if (now - userData.lastMessageTime < this.timeWindow) {
      userData.count++;
      userData.lastMessageTime = now;
      
      // Nếu vượt quá ngưỡng, tăng cảnh báo hoặc chặn
      if (userData.count > this.threshold) {
        userData.warningCount++;
        
        if (userData.warningCount > this.warningsBeforeBlock) {
          userData.blocked = true;
          userData.blockTime = now;
          this.userMessages.set(key, userData);
          
          logger.warn(`Phát hiện spam từ người dùng ${userId} trong nhóm ${threadId}, chặn tạm thời ${this.blockDuration/1000}s`);
          return true;
        } else {
          // Reset đếm tin nhắn sau khi cảnh báo
          userData.count = 1;
          this.userMessages.set(key, userData);
          
          logger.warn(`Cảnh báo spam cho người dùng ${userId} trong nhóm ${threadId} (${userData.warningCount}/${this.warningsBeforeBlock})`);
          return false;
        }
      }
    } else {
      // Reset bộ đếm nếu ngoài cửa sổ thời gian
      userData.count = 1;
      userData.lastMessageTime = now;
    }
    
    this.userMessages.set(key, userData);
    return false;
  }

  public getBlockMessage(): string {
    return this.blockMessage;
  }

  private cleanOldData() {
    const now = Date.now();
    
    for (const [key, data] of this.userMessages.entries()) {
      // Xóa dữ liệu cũ hơn 30 phút và không bị chặn
      if (now - data.lastMessageTime > 30 * 60 * 1000 && !data.blocked) {
        this.userMessages.delete(key);
      }
      // Xóa người dùng bị chặn nếu đã hết thời gian chặn
      else if (data.blocked && now - data.blockTime > this.blockDuration) {
        this.userMessages.delete(key);
      }
    }
  }

  // Hàm hash đơn giản để so sánh nội dung tin nhắn
  private hashContent(content: string): string {
    // Chuẩn hóa nội dung trước khi hash
    const normalizedContent = content
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

    let hash = 0;
    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

export default new AntiSpamService();
