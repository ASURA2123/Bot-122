import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";

// Lưu trữ nội dung kiến thức
interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string; 
  createdBy: string;
  threadID: string;
}

const knowledgeBase = new Map<string, KnowledgeItem>();

export async function handleKnowledgeBot(api: Api, event: MessageEvent) {
  try {
    if (!event.body) return;

    if (event.body.startsWith('!learn add')) {
      // Thêm kiến thức mới
      const args = event.body.slice(10).trim().split('|').map(arg => arg.trim());
      if (args.length < 3) {
        await api.sendMessage(
          "❌ Vui lòng nhập theo định dạng:\n!learn add <tiêu đề> | <danh mục> | <nội dung>",
          event.threadID
        );
        return;
      }

      const [title, category, content] = args;
      const id = Date.now().toString();

      knowledgeBase.set(id, {
        id,
        title,
        category,
        content,
        createdBy: event.senderID,
        threadID: event.threadID
      });

      await api.sendMessage(
        `✅ Đã thêm kiến thức mới:\n` +
        `📝 Tiêu đề: ${title}\n` +
        `📑 Danh mục: ${category}\n` +
        `🆔 ID: ${id}`,
        event.threadID
      );
    }
    else if (event.body.startsWith('!learn list')) {
      // Liệt kê kiến thức theo danh mục
      const category = event.body.slice(11).trim();
      const items = Array.from(knowledgeBase.values())
        .filter(item => item.threadID === event.threadID)
        .filter(item => !category || item.category === category);

      if (items.length === 0) {
        await api.sendMessage(
          category ? 
            `📚 Chưa có kiến thức nào trong danh mục "${category}".` :
            "📚 Chưa có kiến thức nào được lưu.",
          event.threadID
        );
        return;
      }

      const itemList = items
        .map(item => 
          `📝 ${item.title}\n` +
          `📑 ${item.category}\n` +
          `🆔 ${item.id}\n`
        )
        .join("\n");

      await api.sendMessage(
        `📚 Danh sách kiến thức:\n\n${itemList}`,
        event.threadID
      );
    }
    else if (event.body.startsWith('!learn view')) {
      // Xem chi tiết kiến thức
      const id = event.body.slice(11).trim();
      const item = knowledgeBase.get(id);

      if (!item) {
        await api.sendMessage("❌ Không tìm thấy nội dung này.", event.threadID);
        return;
      }

      await api.sendMessage(
        `📚 Chi tiết kiến thức:\n\n` +
        `📝 Tiêu đề: ${item.title}\n` +
        `📑 Danh mục: ${item.category}\n\n` +
        `${item.content}`,
        event.threadID
      );
    }

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Lỗi xử lý bot chia sẻ kiến thức", err);
    await api.sendMessage("❌ Đã xảy ra lỗi khi xử lý lệnh.", event.threadID);
  }
}