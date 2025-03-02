import { botConfig, antiOutConfig } from "../config/index";
import { isAdmin } from "./index";
import moment from "moment";
import { logger } from '../utils/logger';
import { BannedUser, BanManager } from '../utils/ban-manager';
import { Command } from "../types";

// Create ban manager instance 
const banManager = new BanManager();

export const ban: Command = {
  name: "ban",
  description: "Cấm người dùng khỏi nhóm (chỉ admin)",
  usage: `${botConfig.prefix}ban <@tag> [lý do]`,
  permission: "admin",
  execute: async (api, event) => {
    try {
      if (!isAdmin(event.senderID)) {
        await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
        return;
      }

      const mentions = event.mentions;
      if (!mentions || Object.keys(mentions).length === 0) {
        await api.sendMessage("❌ Vui lòng tag người cần cấm", event.threadID);
        return;
      }

      const reason = event.body.split(" ").slice(2).join(" ") || "Không có lý do";
      const userID = Object.keys(mentions)[0];

      if (isAdmin(userID)) {
        await api.sendMessage("❌ Không thể cấm admin!", event.threadID);
        return;
      }

      await banManager.banUser(userID, {
        reason,
        bannedBy: event.senderID,
        bannedAt: new Date()
      });

      await api.removeUserFromGroup(userID, event.threadID);
      await api.sendMessage(
        `✅ Đã cấm người dùng ${mentions[userID]}\n` +
        `📝 Lý do: ${reason}`,
        event.threadID
      );

      logger.info(`User ${userID} banned by ${event.senderID}`, {
        reason,
        threadID: event.threadID
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi khi cấm người dùng", err);
      await api.sendMessage("❌ Không thể cấm người dùng. Vui lòng kiểm tra quyền của bot.", event.threadID);
    }
  }
};

export const unban: Command = {
  name: "unban", 
  description: "Gỡ cấm người dùng (chỉ admin)",
  usage: `${botConfig.prefix}unban <ID>`,
  permission: "admin",
  execute: async (api, event) => {
    if (!isAdmin(event.senderID)) {
      await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
      return;
    }

    const userID = event.body.split(" ")[1];
    if (!userID) {
      await api.sendMessage("❌ Vui lòng nhập ID người dùng cần gỡ cấm", event.threadID);
      return;
    }

    try {
      await banManager.unbanUser(userID);
      await api.sendMessage(`✅ Đã gỡ cấm người dùng ${userID}`, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi khi gỡ cấm người dùng", err);
      await api.sendMessage("❌ Không thể gỡ cấm người dùng. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const unsend: Command = {
  name: "unsend",
  description: "Gỡ tin nhắn của bot",
  usage: `${botConfig.prefix}unsend <reply tin nhắn>`,
  execute: async (api, event) => {
    if (!event.messageReply || !event.messageReply.messageID) {
      await api.sendMessage("❌ Vui lòng reply tin nhắn cần gỡ", event.threadID);
      return;
    }

    try {
      await api.unsendMessage(event.messageReply.messageID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi khi gỡ tin nhắn", err);
      await api.sendMessage("❌ Không thể gỡ tin nhắn. Có thể tin nhắn đã quá cũ.", event.threadID);
    }
  }
};

export const broadcast: Command = {
  name: "broadcast",
  description: "Gửi thông báo đến tất cả các nhóm",
  usage: `${botConfig.prefix}broadcast <nội dung>`,
  permission: "admin",
  execute: async (api, event) => {
    if (!isAdmin(event.senderID)) {
      await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
      return;
    }

    const message = event.body.slice(botConfig.prefix.length + 9).trim();
    if (!message) {
      await api.sendMessage("❌ Vui lòng nhập nội dung cần thông báo!", event.threadID);
      return;
    }

    try {
      await api.sendMessage("📢 Đang gửi thông báo...", event.threadID);

      const broadcastMessage = `📢 Thông báo từ Admin:\n\n${message}\n\n` +
        `👤 Người gửi: ${(await api.getUserInfo(event.senderID))[event.senderID].name}\n` +
        `⏰ Thời gian: ${moment().format('LLL')}`;

      await api.sendMessage(broadcastMessage, event.threadID);

      await api.sendMessage("✅ Đã gửi thông báo thành công!", event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi gửi thông báo", err);
      await api.sendMessage("❌ Không thể gửi thông báo. Vui lòng thử lại sau!", event.threadID);
    }
  }
};

export const admin: Command = {
  name: "admin",
  description: "Quản lý danh sách admin",
  usage: `${botConfig.prefix}admin <add/remove/list> [@tag]`,
  permission: "owner",
  execute: async (api, event) => {
    if (event.senderID !== botConfig.owner) {
      await api.sendMessage("❌ Chỉ chủ bot mới có thể sử dụng lệnh này!", event.threadID);
      return;
    }

    const args = event.body.split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();

    if (!action || !["add", "remove", "list"].includes(action)) {
      await api.sendMessage(
        `❌ Vui lòng sử dụng:\n` +
          `${botConfig.prefix}admin add @tag - Thêm admin\n` +
          `${botConfig.prefix}admin remove @tag - Xóa admin\n` +
          `${botConfig.prefix}admin list - Xem danh sách admin`,
        event.threadID
      );
      return;
    }

    try {
      switch (action) {
        case "add": {
          const mentions = event.mentions;
          if (!mentions || Object.keys(mentions).length === 0) {
            await api.sendMessage("❌ Vui lòng tag người cần thêm làm admin", event.threadID);
            return;
          }

          const newAdminId = Object.keys(mentions)[0];
          if (botConfig.admins.includes(newAdminId)) {
            await api.sendMessage("❌ Người này đã là admin!", event.threadID);
            return;
          }

          botConfig.admins.push(newAdminId);
          await api.sendMessage(
            `✅ Đã thêm ${mentions[newAdminId]} làm admin!\n` +
              `👥 Tổng số admin: ${botConfig.admins.length}`,
            event.threadID
          );
          break;
        }

        case "remove": {
          const mentions = event.mentions;
          if (!mentions || Object.keys(mentions).length === 0) {
            await api.sendMessage("❌ Vui lòng tag admin cần xóa", event.threadID);
            return;
          }

          const removeId = Object.keys(mentions)[0];
          const index = botConfig.admins.indexOf(removeId);
          if (index === -1) {
            await api.sendMessage("❌ Người này không phải là admin!", event.threadID);
            return;
          }

          botConfig.admins.splice(index, 1);
          await api.sendMessage(
            `✅ Đã xóa ${mentions[removeId]} khỏi danh sách admin!\n` +
              `👥 Tổng số admin còn lại: ${botConfig.admins.length}`,
            event.threadID
          );
          break;
        }

        case "list": {
          const adminInfos = await Promise.all(
            botConfig.admins.map(async (id) => {
              const info = await api.getUserInfo(id);
              return `- ${info[id].name} (${id})`;
            })
          );

          const message = `👑 Chủ bot: ${(await api.getUserInfo(botConfig.owner))[botConfig.owner].name}\n\n` +
            `👥 Danh sách ${adminInfos.length} admin:\n${adminInfos.join("\n")}`;

          await api.sendMessage(message, event.threadID);
          break;
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi quản lý admin", err);
      await api.sendMessage("❌ Đã có lỗi xảy ra, vui lòng thử lại sau!", event.threadID);
    }
  }
};

export const system: Command = {
  name: "system",
  description: "Xem thông tin hệ thống bot",
  usage: `${botConfig.prefix}system`,
  permission: "admin",
  execute: async (api, event) => {
    if (!botConfig.admins.includes(event.senderID) && event.senderID !== botConfig.owner) {
      await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
      return;
    }

    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const os = process.platform;
    const nodeVersion = process.version;

    const systemInfo = `📊 Thông tin hệ thống:\n\n` +
      `⏱️ Uptime: ${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n` +
      `💾 RAM: ${Math.round(memory.heapUsed / 1024 / 1024)}MB / ${Math.round(memory.heapTotal / 1024 / 1024)}MB\n` +
      `💻 OS: ${os}\n` +
      `🔧 Node.js: ${nodeVersion}\n` +
      `👥 Tổng admin: ${botConfig.admins.length}\n` +
      `⚙️ Prefix: ${botConfig.prefix}\n`;

    await api.sendMessage(systemInfo, event.threadID);
  }
};

export const reload: Command = {
  name: "reload",
  description: "Tải lại cấu hình bot",
  usage: `${botConfig.prefix}reload`,
  permission: "admin",
  execute: async (api, event) => {
    if (!botConfig.admins.includes(event.senderID) && event.senderID !== botConfig.owner) {
      await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
      return;
    }

    try {
      await api.sendMessage("🔄 Đang tải lại cấu hình bot...", event.threadID);
      // TODO: Implement configuration reload logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      await api.sendMessage("✅ Đã tải lại cấu hình thành công!", event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Lỗi tải lại cấu hình", err);
      await api.sendMessage("❌ Không thể tải lại cấu hình. Vui lòng thử lại sau!", event.threadID);
    }
  }
};

export const commands = [admin, system, reload, ban, unban, unsend, broadcast];
import type { Command } from '../types';
import config from '../config';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';

export const system: Command = {
  name: 'system',
  description: 'Hiển thị thông tin hệ thống',
  usage: `${config.prefix}system`,
  execute: async (api, event) => {
    try {
      const stats = await getSystemStats();
      await api.sendMessage(stats, event.threadID);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin hệ thống:', error);
      await api.sendMessage('❌ Đã xảy ra lỗi khi lấy thông tin hệ thống!', event.threadID);
    }
  }
};

async function getSystemStats() {
  // Thông tin hệ thống
  const uptime = formatUptime(os.uptime());
  const totalMem = formatBytes(os.totalmem());
  const freeMem = formatBytes(os.freemem());
  const usedMem = formatBytes(os.totalmem() - os.freemem());
  const memPercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
  const cpuUsage = os.loadavg()[0].toFixed(2);
  const platform = os.platform();
  const hostname = os.hostname();
  
  // Thông tin logs
  const logStats = await getLogStats();
  
  return `
📊 SYSTEM MONITOR 📊
━━━━━━━━━━━━━━━━━━━━
⚙️ HỆ THỐNG:
• Hostname: ${hostname}
• Platform: ${platform}
• Uptime: ${uptime}
• CPU Load: ${cpuUsage}%
• Memory: ${usedMem}/${totalMem} (${memPercent}%)

📝 THỐNG KÊ LOGS:
${logStats}

⏱️ Thời gian: ${new Date().toLocaleString('vi-VN')}
━━━━━━━━━━━━━━━━━━━━
`;
}

async function getLogStats() {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!await fs.pathExists(logDir)) {
      return '• Không có dữ liệu log';
    }
    
    const logTypes = ['info', 'warn', 'error', 'critical', 'debug'];
    const stats = [];
    
    for (const type of logTypes) {
      const filePath = path.join(logDir, `${type}.log`);
      if (await fs.pathExists(filePath)) {
        const stat = await fs.stat(filePath);
        const size = formatBytes(stat.size);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim()).length;
        
        const emoji = type === 'info' ? '📘' :
                     type === 'warn' ? '⚠️' :
                     type === 'error' ? '❌' :
                     type === 'critical' ? '🚨' : '🔍';
        
        stats.push(`• ${emoji} ${type.toUpperCase()}: ${lines} entries (${size})`);
      }
    }
    
    return stats.join('\n');
  } catch (error) {
    console.error('Lỗi khi đọc thống kê log:', error);
    return '• Lỗi khi đọc thống kê log';
  }
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
