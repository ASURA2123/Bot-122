import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";

// Mini games
interface Game {
  name: string;
  description: string;
  players: Map<string, number>;
  isActive: boolean;
  threadID: string;
}

const activeGames = new Map<string, Game>();

export async function handleEntertainmentBot(api: Api, event: MessageEvent) {
  try {
    if (!event.body) return;

    if (event.body === '!game help') {
      await api.sendMessage(
        `🎮 Danh sách trò chơi:\n\n` +
        `1. Đoán số (!game number)\n` +
        `2. Câu đố (!game quiz)\n` +
        `3. Xúc xắc (!game dice)\n\n` +
        `Gõ lệnh tương ứng để bắt đầu chơi!`,
        event.threadID
      );
    }
    else if (event.body === '!game number') {
      // Trò chơi đoán số
      const targetNumber = Math.floor(Math.random() * 100) + 1;
      activeGames.set(event.threadID, {
        name: "number",
        description: "Đoán số từ 1-100",
        players: new Map([[event.senderID, 0]]),
        isActive: true,
        threadID: event.threadID
      });

      await api.sendMessage(
        `🎲 Trò chơi đoán số bắt đầu!\n` +
        `💭 Mình đang nghĩ một số từ 1-100\n` +
        `🎯 Hãy đoán số bằng cách nhập: !guess <số>`,
        event.threadID
      );
    }
    else if (event.body.startsWith('!guess')) {
      const game = activeGames.get(event.threadID);
      if (!game || !game.isActive || game.name !== "number") {
        await api.sendMessage("❌ Không có trò chơi đoán số nào đang diễn ra!", event.threadID);
        return;
      }

      const guess = parseInt(event.body.slice(7));
      if (isNaN(guess)) {
        await api.sendMessage("❌ Vui lòng nhập một số hợp lệ!", event.threadID);
        return;
      }

      // TODO: Implement number guessing logic
      await api.sendMessage("🎮 Tính năng đoán số đang được phát triển!", event.threadID);
    }
    else if (event.body === '!game dice') {
      // Trò chơi xúc xắc
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2;

      await api.sendMessage(
        `🎲 Kết quả xúc xắc:\n` +
        `⚀ Xúc xắc 1: ${dice1}\n` +
        `⚀ Xúc xắc 2: ${dice2}\n` +
        `📊 Tổng điểm: ${total}`,
        event.threadID
      );
    }

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Lỗi xử lý bot giải trí", err);
    await api.sendMessage("❌ Đã xảy ra lỗi khi xử lý lệnh.", event.threadID);
  }
}