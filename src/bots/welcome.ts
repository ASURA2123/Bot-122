import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";
import botConfig from "../config";

// Lưu trữ cấu hình welcome của từng nhóm
interface WelcomeConfig {
  message: string;
  image?: string;
  rules?: string[];
}

const welcomeConfigs = new Map<string, WelcomeConfig>();

export async function handleWelcomeBot(api: Api, event: MessageEvent) {
  try {
    if (!event.body) return;

    if (event.body.startsWith('!welcome set')) {
      // Chỉ admin mới được set welcome message
      if (!botConfig.admins.includes(event.senderID)) {
        await api.sendMessage("❌ Chỉ admin mới có thể cài đặt lời chào!", event.threadID);
        return;
      }

      const message = event.body.slice(12).trim();
      if (!message) {
        await api.sendMessage(
          "❌ Vui lòng nhập nội dung lời chào.\n" +
          "💡 Bạn có thể sử dụng:\n" +
          "{name} - Tên thành viên\n" +
          "{thread} - Tên nhóm\n" +
          "{prefix} - Prefix của bot",
          event.threadID
        );
        return;
      }

      welcomeConfigs.set(event.threadID, {
        message,
        rules: []
      });

      await api.sendMessage("✅ Đã cập nhật lời chào mới!", event.threadID);
    }
    else if (event.body.startsWith('!welcome rule add')) {
      // Thêm nội quy nhóm
      if (!botConfig.admins.includes(event.senderID)) {
        await api.sendMessage("❌ Chỉ admin mới có thể thêm nội quy!", event.threadID);
        return;
      }

      const rule = event.body.slice(16).trim();
      if (!rule) {
        await api.sendMessage("❌ Vui lòng nhập nội quy cần thêm.", event.threadID);
        return;
      }

      const config = welcomeConfigs.get(event.threadID) || {
        message: "👋 Chào mừng {name} đến với {thread}!",
        rules: []
      };

      config.rules = config.rules || [];
      config.rules.push(rule);
      welcomeConfigs.set(event.threadID, config);

      await api.sendMessage("✅ Đã thêm nội quy mới!", event.threadID);
    }
    else if (event.body === '!welcome view') {
      // Xem cấu hình welcome hiện tại
      const config = welcomeConfigs.get(event.threadID);
      if (!config) {
        await api.sendMessage(
          "ℹ️ Chưa có cấu hình lời chào.\n" +
          "👉 Admin có thể cài đặt bằng lệnh: !welcome set <nội dung>",
          event.threadID
        );
        return;
      }

      let message = `📝 Lời chào hiện tại:\n${config.message}\n`;
      if (config.rules && config.rules.length > 0) {
        message += "\n📜 Nội quy nhóm:\n" + config.rules.map((rule, i) => `${i+1}. ${rule}`).join("\n");
      }

      await api.sendMessage(message, event.threadID);
    }

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Lỗi xử lý bot chào mừng", err);
    await api.sendMessage("❌ Đã xảy ra lỗi khi xử lý lệnh.", event.threadID);
  }
}

export async function sendWelcomeMessage(api: Api, threadID: string, userInfo: any) {
  try {
    const config = welcomeConfigs.get(threadID);
    if (!config) return;

    const threadInfo = await api.getThreadInfo(threadID);
    let message = config.message
      .replace("{name}", userInfo.name)
      .replace("{thread}", threadInfo.threadName || "nhóm")
      .replace("{prefix}", botConfig.prefix);

    if (config.rules && config.rules.length > 0) {
      message += "\n\n📜 Nội quy nhóm:\n" + config.rules.map((rule, i) => `${i+1}. ${rule}`).join("\n");
    }

    await api.sendMessage(message, threadID);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Lỗi gửi tin nhắn chào mừng", err);
  }
}