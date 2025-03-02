import { Command } from "../types";
import { commands, isOwner, isAdmin } from "./index";
import config from "../config";

export const help: Command = {
  name: "help",
  description: "Shows list of available commands",
  usage: `${config.prefix}help [command]`,
  execute: async (api, event) => {
    try {
      const args = event.body.split(/\s+/).slice(1);
      const isUserOwner = isOwner(event.senderID);
      const isUserAdmin = isAdmin(event.senderID);

      if (args.length === 0) {
        // Phân loại lệnh theo quyền hạn
        const normalCommands: Command[] = [];
        const adminCommands: Command[] = [];
        const ownerCommands: Command[] = [];

        for (const command of commands.values()) {
          if (command.permission === 'owner' && isUserOwner) {
            ownerCommands.push(command);
          } else if (command.permission === 'admin' && isUserAdmin) {
            adminCommands.push(command);
          } else if (!command.permission) {
            normalCommands.push(command);
          }
        }

        let helpMessage = `📚 Danh sách lệnh có sẵn:\n\n`;

        // Hiển thị lệnh thường
        helpMessage += `🔹 Lệnh thường (${config.prefix}):\n`;
        helpMessage += normalCommands
          .map(cmd => `${config.prefix}${cmd.name}: ${cmd.description}`)
          .join('\n');

        // Hiển thị lệnh admin nếu có quyền
        if (adminCommands.length > 0) {
          helpMessage += `\n\n👑 Lệnh admin (${config.adminPrefix}):\n`;
          helpMessage += adminCommands
            .map(cmd => `${config.adminPrefix}${cmd.name}: ${cmd.description}`)
            .join('\n');
        }

        // Hiển thị lệnh owner nếu là chủ bot
        if (ownerCommands.length > 0) {
          helpMessage += `\n\n⭐ Lệnh chủ bot (${config.adminPrefix}):\n`;
          helpMessage += ownerCommands
            .map(cmd => `${config.adminPrefix}${cmd.name}: ${cmd.description}`)
            .join('\n');
        }

        helpMessage += `\n\nDùng ${config.prefix}help <lệnh> để xem chi tiết cách sử dụng.`;

        await api.sendMessage(helpMessage, event.threadID);
        return;
      }

      // Hiển thị help cho lệnh cụ thể
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (!command) {
        const error = new Error(`Command "${commandName}" not found`);
        error.name = 'CommandNotFoundError';
        throw error;
      }

      // Kiểm tra quyền xem help của lệnh
      if (command.permission === 'owner' && !isUserOwner) {
        const error = new Error('Permission denied - owner only command');
        error.name = 'PermissionError';
        throw error;
      }

      if (command.permission === 'admin' && !isUserAdmin) {
        const error = new Error('Permission denied - admin only command');
        error.name = 'PermissionError';
        throw error;
      }

      await api.sendMessage(
        `📝 Chi tiết lệnh: ${command.name}\n` +
        `🔍 Mô tả: ${command.description}\n` +
        `💡 Cách dùng: ${command.usage}\n` +
        (command.permission ? `👑 Yêu cầu quyền: ${command.permission}` : ''),
        event.threadID
      );

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Return appropriate message based on error type
      if (err.name === 'CommandNotFoundError') {
        await api.sendMessage(
          `❌ Không tìm thấy lệnh "${args[0]}".`,
          event.threadID
        );
      } else if (err.name === 'PermissionError') {
        await api.sendMessage(
          "❌ Bạn không có quyền xem thông tin lệnh này!",
          event.threadID
        );
      } else {
        await api.sendMessage(
          "❌ Đã xảy ra lỗi khi xử lý lệnh help.",
          event.threadID
        );
      }
    }
  }
};