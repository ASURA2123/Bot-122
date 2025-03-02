import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";

// Lưu trữ FAQ
interface FAQItem {
  question: string;
  answer: string;
  category?: string;
  createdBy: string;
  threadID: string;
}

const faqDatabase = new Map<string, FAQItem>();

export async function handleFAQBot(api: Api, event: MessageEvent) {
  try {
    if (!event.body) return;

    if (event.body.startsWith('!faq add')) {
      // Thêm câu hỏi mới
      const args = event.body.slice(8).trim().split('|').map(arg => arg.trim());
      if (args.length < 2) {
        await api.sendMessage(
          "❌ Vui lòng nhập theo định dạng:\n!faq add <câu hỏi> | <câu trả lời> | [danh mục]",
          event.threadID
        );
        return;
      }

      const [question, answer, category = "Chung"] = args;
      const id = `${event.threadID}_${Date.now()}`;

      faqDatabase.set(id, {
        question,
        answer,
        category,
        createdBy: event.senderID,
        threadID: event.threadID
      });

      await api.sendMessage(
        `✅ Đã thêm câu hỏi mới:\n` +
        `❓ ${question}\n` +
        `📑 Danh mục: ${category}`,
        event.threadID
      );
    }
    else if (event.body === '!faq list') {
      // Liệt kê tất cả câu hỏi
      const questions = Array.from(faqDatabase.values())
        .filter(faq => faq.threadID === event.threadID);

      if (questions.length === 0) {
        await api.sendMessage("📝 Chưa có câu hỏi nào được thêm vào.", event.threadID);
        return;
      }

      // Nhóm câu hỏi theo danh mục
      const categorized = questions.reduce((acc, faq) => {
        const category = faq.category || "Chung";
        if (!acc[category]) acc[category] = [];
        acc[category].push(faq.question);
        return acc;
      }, {} as Record<string, string[]>);

      let message = "📚 Danh sách câu hỏi:\n\n";
      for (const [category, questions] of Object.entries(categorized)) {
        message += `📑 ${category}:\n`;
        questions.forEach((q, i) => {
          message += `${i+1}. ${q}\n`;
        });
        message += "\n";
      }

      message += "\n💡 Dùng !faq <câu hỏi> để xem câu trả lời";
      await api.sendMessage(message, event.threadID);
    }
    else if (event.body.startsWith('!faq')) {
      // Tìm kiếm câu trả lời
      const query = event.body.slice(4).trim().toLowerCase();
      if (!query) return;

      const matchedFAQ = Array.from(faqDatabase.values())
        .filter(faq => faq.threadID === event.threadID)
        .find(faq => faq.question.toLowerCase().includes(query));

      if (!matchedFAQ) {
        await api.sendMessage(
          "❌ Không tìm thấy câu trả lời phù hợp.\n" +
          "💡 Bạn có thể:\n" +
          "1. Thử tìm với từ khóa khác\n" +
          "2. Xem danh sách câu hỏi với !faq list\n" +
          "3. Thêm câu hỏi mới với !faq add",
          event.threadID
        );
        return;
      }

      await api.sendMessage(
        `📝 Câu hỏi: ${matchedFAQ.question}\n\n` +
        `💬 Trả lời: ${matchedFAQ.answer}\n\n` +
        `📑 Danh mục: ${matchedFAQ.category || "Chung"}`,
        event.threadID
      );
    }

  } catch (error) {
    logger.error("Lỗi xử lý bot FAQ", error as Error);
    await api.sendMessage("❌ Đã xảy ra lỗi khi xử lý lệnh.", event.threadID);
  }
}
