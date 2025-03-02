import { logger } from './logger';

export interface BannedUser {
  reason: string;
  bannedBy: string;
  bannedAt: Date;
}

export class BanManager {
  private bannedUsers: Map<string, BannedUser>;

  constructor() {
    this.bannedUsers = new Map();
  }

  async banUser(userID: string, banInfo: BannedUser): Promise<void> {
    try {
      this.bannedUsers.set(userID, banInfo);
      logger.info(`User ${userID} banned`, {
        ...banInfo,
        bannedAt: banInfo.bannedAt.toISOString()
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to ban user ${userID}`, err);
      throw err;
    }
  }

  async unbanUser(userID: string): Promise<boolean> {
    try {
      const wasRemoved = this.bannedUsers.delete(userID);
      if (wasRemoved) {
        logger.info(`User ${userID} unbanned`);
      }
      return wasRemoved;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to unban user ${userID}`, err);
      throw err;
    }
  }

  isBanned(userID: string): boolean {
    return this.bannedUsers.has(userID);
  }

  getBanInfo(userID: string): BannedUser | null {
    return this.bannedUsers.get(userID) || null;
  }

  getAllBannedUsers(): Map<string, BannedUser> {
    return new Map(this.bannedUsers);
  }
}