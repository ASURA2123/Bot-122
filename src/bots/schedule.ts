import { Api, MessageEvent } from "../types";
import { logger } from "../utils/logger";
import moment from "moment";
import { BotHandler } from "./handler-manager";

// Lưu trữ các sự kiện
interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  createdBy: string;
  threadID: string;
}

const events = new Map<string, Event>();

const scheduleHandler: BotHandler = {
  name: "Schedule Bot",
  prefix: "!event",
  handle: async (api: Api, event: MessageEvent) => {
    try {
      if (!event.body) return;

      const command = event.body.slice(6).trim().split(/\s+/)[0];

      switch (command) {
        case "add":
          await handleAddEvent(api, event);
          break;
        case "list":
          await handleListEvents(api, event);
          break;
        case "remove":
          await handleRemoveEvent(api, event);
          break;
        default:
          await api.sendMessage(
            "❌ Lệnh không hợp lệ. Sử dụng:\n" +
            "!event add <tiêu đề> | <thời gian> | [mô tả] - Thêm sự kiện\n" +
            "!event list - Xem danh sách sự kiện\n" +
            "!event remove <ID> - Xóa sự kiện",
            event.threadID
          );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Schedule bot error", err);
      await api.sendMessage("❌ Đã xảy ra lỗi khi xử lý lệnh.", event.threadID);
    }
  }
};

async function handleAddEvent(api: Api, event: MessageEvent) {
  const args = event.body.slice(10).trim().split('|').map(arg => arg.trim());
  if (args.length < 2) {
    await api.sendMessage(
      "❌ Vui lòng nhập theo định dạng:\n!event add <tiêu đề> | <thời gian> | [mô tả]",
      event.threadID
    );
    return;
  }

  const [title, dateStr, description = ""] = args;
  const date = moment(dateStr, "DD/MM/YYYY HH:mm").toDate();

  if (!date.getTime()) {
    await api.sendMessage(
      "❌ Định dạng thời gian không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY HH:mm",
      event.threadID
    );
    return;
  }

  const id = Date.now().toString();
  events.set(id, {
    id,
    title,
    description,
    date,
    createdBy: event.senderID,
    threadID: event.threadID
  });

  await api.sendMessage(
    `✅ Đã thêm sự kiện:\n` +
    `📝 Tiêu đề: ${title}\n` +
    `⏰ Thời gian: ${moment(date).format('LLL')}\n` +
    `📄 Mô tả: ${description}\n` +
    `🆔 ID: ${id}`,
    event.threadID
  );
}

async function handleListEvents(api: Api, event: MessageEvent) {
  const threadEvents = Array.from(events.values())
    .filter(e => e.threadID === event.threadID)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (threadEvents.length === 0) {
    await api.sendMessage("📅 Chưa có sự kiện nào được tạo.", event.threadID);
    return;
  }

  const eventList = threadEvents
    .map(e => 
      `🎯 ${e.title}\n` +
      `⏰ ${moment(e.date).format('LLL')}\n` +
      `📄 ${e.description}\n` +
      `🆔 ${e.id}\n`
    )
    .join("\n");

  await api.sendMessage(
    `📅 Danh sách sự kiện:\n\n${eventList}`,
    event.threadID
  );
}

async function handleRemoveEvent(api: Api, event: MessageEvent) {
  const id = event.body.slice(13).trim();
  const targetEvent = events.get(id);

  if (!targetEvent) {
    await api.sendMessage("❌ Không tìm thấy sự kiện.", event.threadID);
    return;
  }

  if (targetEvent.createdBy !== event.senderID) {
    await api.sendMessage("❌ Bạn không có quyền xóa sự kiện này!", event.threadID);
    return;
  }

  events.delete(id);
  await api.sendMessage(
    `✅ Đã xóa sự kiện:\n` +
    `📝 ${targetEvent.title}\n` +
    `⏰ ${moment(targetEvent.date).format('LLL')}`,
    event.threadID
  );
}

export default scheduleHandler;
