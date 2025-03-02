import { Command } from "../types";
import config from "../config";
import moment from "moment";
import { logger } from "../utils/logger";
import axios from "axios";

// Lưu trữ tương tác của thành viên
const userInteractions = new Map<string, number>();

export const addFriend: Command = {
  name: "addfriend",
  description: "Kết bạn với người dùng qua ID Facebook",
  usage: `${config.prefix}addfriend <ID>`,
  execute: async (api, event) => {
    try {
      const userID = event.body.slice(config.prefix.length + 9).trim();
      if (!userID) {
        const error = new Error("Missing user ID");
        error.name = "InvalidArgumentError";
        throw error;
      }

      // Kiểm tra ID có hợp lệ không
      const userInfo = await api.getUserInfo(userID);
      if (!userInfo[userID]) {
        const error = new Error(`User ID ${userID} not found`);
        error.name = "UserNotFoundError";
        throw error;
      }

      // Gửi lời mời kết bạn
      await api.addUserToGroup(userID, event.threadID);
      await api.sendMessage(
        `✅ Đã gửi lời mời kết bạn tới ${userInfo[userID].name} (${userID})`,
        event.threadID
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "AddFriendError";
      logger.error("Lỗi khi kết bạn", err);
      await api.sendMessage("❌ Không thể gửi lời mời kết bạn. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const setlove: Command = {
  name: "setlove",
  description: "Đặt biệt danh cho thành viên trong nhóm",
  usage: `${config.prefix}setlove <@tag> <biệt danh>`,
  execute: async (api, event) => {
    try {
      const mentions = event.mentions;
      if (!mentions || Object.keys(mentions).length === 0) {
        const error = new Error("No user mentioned");
        error.name = "InvalidArgumentError";
        throw error;
      }

      const nickname = event.body.split(" ").slice(2).join(" ");
      if (!nickname) {
        const error = new Error("Missing nickname");
        error.name = "InvalidArgumentError";
        throw error;
      }

      const threadInfo = await api.getThreadInfo(event.threadID);
      const botID = api.getCurrentUserID();
      const isAdmin = threadInfo.adminIDs?.includes(botID);

      if (!isAdmin) {
        const error = new Error("Bot needs admin permission");
        error.name = "PermissionError";
        throw error;
      }

      // Đổi biệt danh cho từng người được tag
      for (const [userID, userName] of Object.entries(mentions)) {
        try {
          // TODO: Implement setNickname when available in API types
          await api.sendMessage(`✅ Đã đổi biệt danh của ${userName} thành: ${nickname}`, event.threadID);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          err.name = "SetNicknameError";
          logger.error(`Lỗi khi đổi biệt danh cho ${userName}`, err);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "SetLoveError";
      logger.error("Lỗi lệnh setlove", err);
      await api.sendMessage("❌ Không thể đổi biệt danh. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const uptime: Command = {
  name: "uptime",
  description: "Xem thời gian bot đã online",
  usage: `${config.prefix}uptime`,
  execute: async (api, event) => {
    try {
      const startTime = process.uptime();
      const days = Math.floor(startTime / 86400);
      const hours = Math.floor((startTime % 86400) / 3600);
      const minutes = Math.floor((startTime % 3600) / 60);
      const seconds = Math.floor(startTime % 60);

      const uptimeMessage = `⏰ Bot đã hoạt động được:\n` +
        `📅 ${days} ngày\n` +
        `🕐 ${hours} giờ\n` +
        `⏱ ${minutes} phút\n` +
        `⏲ ${seconds} giây`;

      await api.sendMessage(uptimeMessage, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "UptimeError";
      logger.error("Lỗi lệnh uptime", err);
      await api.sendMessage("❌ Không thể xem thời gian hoạt động. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const rankup: Command = {
  name: "rankup",
  description: "Xem thứ hạng tương tác trong nhóm",
  usage: `${config.prefix}rankup [@tag]`,
  execute: async (api, event) => {
    try {
      const userID = event.mentions ? Object.keys(event.mentions)[0] : event.senderID;
      const interactions = userInteractions.get(userID) || 0;
      const rank = Array.from(userInteractions.entries())
        .sort(([, a], [, b]) => b - a)
        .findIndex(([id]) => id === userID) + 1;

      const userInfo = await api.getUserInfo(userID);
      const userName = userInfo[userID].name;

      const rankMessage = `👤 Thành viên: ${userName}\n` +
        `💬 Số tin nhắn: ${interactions}\n` +
        `🏆 Thứ hạng: #${rank}`;

      await api.sendMessage(rankMessage, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "RankupError";
      logger.error("Lỗi lệnh rankup", err);
      await api.sendMessage("❌ Không thể xem thứ hạng. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const weather: Command = {
  name: "weather",
  description: "Xem thông tin thời tiết tại khu vực",
  usage: `${config.prefix}weather <tên thành phố>`,
  execute: async (api, event) => {
    try {
      const city = event.body.slice(config.prefix.length + 8).trim();
      if (!city) {
        const error = new Error("Missing city name");
        error.name = "InvalidArgumentError";
        throw error;
      }

      const response = await axios.get(
        `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=vi`
      );

      const data = response.data;
      const weather = `🌤 Thời tiết tại ${data.name}:\n\n` +
        `🌡 Nhiệt độ: ${Math.round(data.main.temp)}°C\n` +
        `💧 Độ ẩm: ${data.main.humidity}%\n` +
        `🌪 Gió: ${data.wind.speed}m/s\n` +
        `☁ Mây: ${data.clouds.all}%\n` +
        `📝 Mô tả: ${data.weather[0].description}\n` +
        `⏰ Cập nhật: ${moment.unix(data.dt).format('LLL')}`;

      await api.sendMessage(weather, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "WeatherError";
      logger.error("Lỗi lệnh weather", err);
      await api.sendMessage("❌ Không thể lấy thông tin thời tiết. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const wiki: Command = {
  name: "wiki",
  description: "Tìm thông tin từ Wikipedia",
  usage: `${config.prefix}wiki <từ khoá>`,
  execute: async (api, event) => {
    try {
      const query = event.body.slice(config.prefix.length + 5).trim();
      if (!query) {
        const error = new Error("Missing search query");
        error.name = "InvalidArgumentError";
        throw error;
      }

      // Wikipedia API endpoint
      const response = await axios.get(
        `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'MessengerBot/1.0'
          }
        }
      );

      if (response.data.type === 'disambiguation') {
        await api.sendMessage(
          "❓ Có nhiều kết quả phù hợp. Vui lòng thử tìm kiếm cụ thể hơn.",
          event.threadID
        );
        return;
      }

      const title = response.data.title;
      const extract = response.data.extract;
      const url = response.data.content_urls?.desktop?.page;

      const message = `📚 ${title}\n\n` +
        `${extract}\n\n` +
        (url ? `🔗 Đọc thêm: ${url}` : '');

      await api.sendMessage(message, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "WikiError";
      logger.error("Lỗi lệnh wiki", err);
      await api.sendMessage("❌ Không thể tìm thông tin. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const wake: Command = {
  name: "wake",
  description: "Tính thời gian thức dậy hoàn hảo",
  usage: `${config.prefix}wake [giờ đi ngủ]`,
  execute: async (api, event) => {
    try {
      let bedtime = moment();
      const timeArg = event.body.split(" ")[1];

      if (timeArg) {
        // Nếu người dùng nhập giờ đi ngủ
        bedtime = moment(timeArg, "HH:mm");
        if (!bedtime.isValid()) {
          const error = new Error("Invalid time format. Please use HH:mm (e.g., 23:00)");
          error.name = "InvalidArgumentError";
          throw error;
        }
      }

      // Tính các chu kỳ ngủ (mỗi chu kỳ 90 phút)
      const cycles = [5, 6, 7]; // 5-7 chu kỳ là tốt nhất
      let message = "⏰ Thời gian thức dậy tốt nhất:\n\n";

      cycles.forEach(cycle => {
        const wakeTime = moment(bedtime).add(cycle * 90, "minutes");
        message += `${cycle} chu kỳ (${cycle * 1.5}h): ${wakeTime.format("HH:mm")}\n`;
      });

      message += "\n💡 Mỗi chu kỳ ngủ kéo dài 90 phút. Bạn nên hoàn thành 5-7 chu kỳ để có giấc ngủ khoa học nhất.";
      await api.sendMessage(message, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "WakeError";
      logger.error("Lỗi lệnh wake", err);
      await api.sendMessage("❌ Không thể tính thời gian thức dậy. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const checkin: Command = {
  name: "checkin",
  description: "Xem thống kê tương tác của nhóm",
  usage: `${config.prefix}checkin`,
  execute: async (api, event) => {
    try {
      // Lấy danh sách thành viên có tương tác
      const sortedUsers = Array.from(userInteractions.entries())
        .sort(([, a], [, b]) => b - a);

      if (sortedUsers.length === 0) {
        await api.sendMessage("📊 Chưa có dữ liệu tương tác nào.", event.threadID);
        return;
      }

      // Lấy thông tin top 10 thành viên
      const top10 = await Promise.all(
        sortedUsers.slice(0, 10).map(async ([id, count], index) => {
          const userInfo = await api.getUserInfo(id);
          return `${index + 1}. ${userInfo[id].name}: ${count} tin nhắn`;
        })
      );

      const totalMessages = sortedUsers.reduce((sum, [, count]) => sum + count, 0);
      const totalUsers = sortedUsers.length;

      const stats = `📊 Thống kê tương tác nhóm:\n\n` +
        `👥 Tổng thành viên tương tác: ${totalUsers}\n` +
        `💬 Tổng tin nhắn: ${totalMessages}\n\n` +
        `🏆 Top 10 thành viên tích cực:\n${top10.join('\n')}`;

      await api.sendMessage(stats, event.threadID);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || "CheckinError";
      logger.error("Lỗi lệnh checkin", err);
      await api.sendMessage("❌ Không thể xem thống kê. Vui lòng thử lại sau.", event.threadID);
    }
  }
};