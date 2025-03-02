
import type { Command } from '../types';
import config from '../config';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_LEVELS = ['info', 'warn', 'error', 'critical', 'debug'];
const MAX_ENTRIES = 15;

export const logs: Command = {
  name: 'logs',
  description: 'Hiển thị logs hệ thống',
  usage: `${config.prefix}logs [level] [số lượng]`,
  execute: async (api, event) => {
    const args = event.body.slice(config.prefix.length + 5).trim().split(/\s+/);
    const level = LOG_LEVELS.includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : null;
    const limit = parseInt(args[level ? 1 : 0]) || MAX_ENTRIES;
    
    try {
      // Kiểm tra thư mục logs tồn tại
      if (!await fs.pathExists(LOG_DIR)) {
        await api.sendMessage('❌ Không tìm thấy thư mục logs!', event.threadID);
        return;
      }
      
      // Đọc logs theo level hoặc tất cả
      const logs = await getLogEntries(level, limit);
      
      if (logs.length === 0) {
        await api.sendMessage(
          level 
            ? `📝 Không có log nào ở mức ${formatLevel(level)} để hiển thị.`
            : '📝 Không có log nào để hiển thị.',
          event.threadID
        );
        return;
      }
      
      // Format logs để hiển thị
      const formattedLogs = formatLogs(logs);
      await api.sendMessage(formattedLogs, event.threadID);
    } catch (error) {
      console.error('Lỗi khi đọc logs:', error);
      await api.sendMessage('❌ Đã xảy ra lỗi khi đọc log!', event.threadID);
    }
  }
};

// Đọc log từ file
async function getLogEntries(level: string | null, limit: number) {
  const allLogs: any[] = [];
  
  try {
    const files = level 
      ? [`${level}.log`] 
      : LOG_LEVELS.map(l => `${l}.log`);
    
    for (const file of files) {
      const filePath = path.join(LOG_DIR, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf8');
      const entries = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            const entry = JSON.parse(line);
            entry._level = file.replace('.log', ''); // Thêm level từ tên file
            return entry;
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);
      
      allLogs.push(...entries);
    }
    
    // Sắp xếp theo thời gian giảm dần và giới hạn số lượng
    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Lỗi khi đọc file log:', error);
    return [];
  }
}

// Format từng log entry để hiển thị
function formatLogs(logs: any[]) {
  if (logs.length === 0) return 'Không có log nào.';
  
  const header = '📋 SYSTEM LOGS\n' + '━'.repeat(20) + '\n';
  
  const formattedEntries = logs.map((log, index) => {
    const timestamp = new Date(log.timestamp).toLocaleString('vi-VN');
    const level = formatLevel(log._level);
    const message = log.message || 'Không có thông điệp';
    
    return `${index + 1}. [${timestamp}] ${level}\n   ${message}`;
  }).join('\n\n');
  
  const footer = '\n' + '━'.repeat(20) + 
                 `\n📊 Hiển thị ${logs.length} log${logs.length > 1 ? 's' : ''}`;
  
  return header + formattedEntries + footer;
}

// Format level với emoji và định dạng
function formatLevel(level: string) {
  switch (level) {
    case 'info':
      return '📘 INFO';
    case 'warn':
      return '⚠️ WARNING';
    case 'error':
      return '❌ ERROR';
    case 'critical':
      return '🚨 CRITICAL';
    case 'debug':
      return '🔍 DEBUG';
    default:
      return level.toUpperCase();
  }
}
