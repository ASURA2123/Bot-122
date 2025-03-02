import type { Command } from '../types';
import config from '../config';

export const echo: Command = {
  name: 'echo',
  description: 'Lặp lại tin nhắn của bạn',
  usage: `${config.prefix}echo <tin nhắn>`,
  execute: async (api, event) => {
    const message = event.body.slice(config.prefix.length + 5).trim();
    if (!message) {
      await api.sendMessage('Vui lòng nhập tin nhắn cần lặp lại', event.threadID);
      return;
    }
    await api.sendMessage(message, event.threadID);
  }
};

export const ping: Command = {
  name: 'ping',
  description: 'Kiểm tra bot còn hoạt động không',
  usage: `${config.prefix}ping`,
  execute: async (api, event) => {
    const start = Date.now();
    await api.sendMessage('Pong! 🏓', event.threadID);
    const latency = Date.now() - start;
    await api.sendMessage(`Độ trễ: ${latency}ms`, event.threadID);
  }
};

// Biến lưu thời điểm khởi động bot
const startTime = Date.now();

export const uptime: Command = {
  name: 'uptime', 
  description: 'Xem thời gian bot đã hoạt động',
  usage: `${config.prefix}uptime`,
  execute: async (api, event) => {
    const uptime = Date.now() - startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const uptimeStr = `Bot đã hoạt động được:\n${days} ngày\n${hours % 24} giờ\n${minutes % 60} phút\n${seconds % 60} giây`;
    await api.sendMessage(uptimeStr, event.threadID);
  }
};
