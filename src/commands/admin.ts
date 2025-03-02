import { Command } from "../types";
import config, { ANTI_OUT_CONFIG } from "../config";
import { isAdmin } from "./index";
import { logger } from "../utils/logger";

export const setname: Command = {
  name: "setname",
  description: "Đổi tên nhóm (chỉ admin)",
  usage: `${config.prefix}setname <tên mới>`,
  permission: "admin",
  execute: async (api, event) => {
    if (!isAdmin(event.senderID)) {
      await api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này!", event.threadID);
      return;
    }

    const newName = event.body.slice(config.prefix.length + 8).trim();
    if (!newName) {
      await api.sendMessage("❌ Vui lòng nhập tên mới cho nhóm", event.threadID);
      return;
    }

    try {
      const threadInfo = await api.getThreadInfo(event.threadID);
      const botID = api.getCurrentUserID();
      const isAdmin = threadInfo.adminIDs?.includes(botID);

      if (!isAdmin) {
        await api.sendMessage("❌ Bot cần quyền quản trị viên để đổi tên nhóm!", event.threadID);
        return;
      }

      await api.setTitle(newName, event.threadID);
      await api.sendMessage(`✅ Đã đổi tên nhóm thành: ${newName}`, event.threadID);
    } catch (error) {
      logger.error("Lỗi khi đổi tên nhóm", error as Error);
      await api.sendMessage("❌ Không thể đổi tên nhóm. Vui lòng kiểm tra quyền của bot.", event.threadID);
    }
  }
};

export const kick: Command = {
  name: "kick",
  description: "Kick thành viên khỏi nhóm (chỉ admin)",
  usage: `${config.prefix}kick <@tag>`,
  permission: "admin",
  execute: async (api, event) => {
    if (!isAdmin(event.senderID)) {
      await api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này!", event.threadID);
      return;
    }

    const mentions = event.mentions;
    if (!mentions || Object.keys(mentions).length === 0) {
      await api.sendMessage("❌ Vui lòng tag người cần kick", event.threadID);
      return;
    }

    try {
      // Kiểm tra quyền của bot trong nhóm
      const threadInfo = await api.getThreadInfo(event.threadID);
      const botID = api.getCurrentUserID();
      const isAdmin = threadInfo.adminIDs?.includes(botID);

      if (!isAdmin) {
        await api.sendMessage("❌ Bot cần quyền quản trị viên để kick thành viên!", event.threadID);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let message = "🚫 Kết quả kick:\n";

      for (const [userID, userName] of Object.entries(mentions)) {
        // Không cho phép kick admin
        if (isAdmin(userID)) {
          message += `❌ ${userName}: Không thể kick admin!\n`;
          failCount++;
          continue;
        }

        try {
          await api.removeUserFromGroup(userID, event.threadID);
          message += `✅ ${userName}: Đã kick thành công\n`;
          successCount++;
        } catch (error) {
          message += `❌ ${userName}: Không thể kick (${(error as Error).message})\n`;
          failCount++;
          logger.error(`Lỗi kick user ${userName}`, error as Error);
        }
      }

      message += `\n📊 Tổng kết: ${successCount} thành công, ${failCount} thất bại`;
      await api.sendMessage(message, event.threadID);
    } catch (error) {
      logger.error("Lỗi lệnh kick", error as Error);
      await api.sendMessage("❌ Không thể kick thành viên. Vui lòng kiểm tra quyền của bot.", event.threadID);
    }
  }
};

export const antiout: Command = {
  name: "antiout",
  description: "Bật/tắt chế độ chống rời nhóm (chỉ admin)",
  usage: `${config.prefix}antiout <on/off>`,
  permission: "admin",
  execute: async (api, event) => {
    if (!isAdmin(event.senderID)) {
      await api.sendMessage("❌ Bạn không có quyền sử dụng lệnh này!", event.threadID);
      return;
    }

    const args = event.body.split(/\s+/).slice(1);
    if (!args.length || !['on', 'off'].includes(args[0].toLowerCase())) {
      await api.sendMessage(
        `❌ Vui lòng sử dụng:\n${config.prefix}antiout on - để bật\n${config.prefix}antiout off - để tắt`,
        event.threadID
      );
      return;
    }

    const isEnable = args[0].toLowerCase() === 'on';
    ANTI_OUT_CONFIG.enabled = isEnable;

    await api.sendMessage(
      `✅ Đã ${isEnable ? 'bật' : 'tắt'} chế độ chống rời nhóm!\n` +
      `👥 Bot sẽ ${isEnable ? '' : 'không '}thêm lại thành viên khi họ rời nhóm.`,
      event.threadID
    );
  }
};

export default {
  setname,
  kick,
  antiout
};