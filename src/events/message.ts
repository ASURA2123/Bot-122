import type { Api, MessageEvent } from "../types";
import { handleCommand } from "../utils/command-handler";
import { logger } from "../utils/logger";
import { botConfig, antiOutConfig } from "../config/index";
import moment from "moment";
import { handleModuleCommand, handleModuleEvents } from "../utils/module-integration";

// Import bot handlers
import { BotHandlerManager } from "../bots/handler-manager";

// Initialize bot handler manager
const botManager = new BotHandlerManager();

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 30
};

// Rate limit tracking
const userRateLimits = new Map<string, {
  count: number;
  resetTime: number;
}>();

// Thread type filtering
const IGNORED_THREAD_TYPES = ['marketplace', 'page'];
const IGNORED_MESSAGE_TYPES = ['read_receipt', 'typ', 'read'];

// Auto reply configuration
const autoReplyConfig = {
  patterns: [
    {
      regex: /^ping$/i,
      response: "pong!"
    },
    {
      regex: /^hi|hello|hey$/i,
      response: () => `Xin chào! Prefix của bot là ${botConfig.prefix}`
    }
  ]
};

export async function handleMessage(api: Api, event: MessageEvent) {
  try {
    // Skip messages from the bot itself
    if (event.senderID === api.getCurrentUserID()) return;

    // Check rate limiting
    if (await isRateLimited(event.senderID)) {
      logger.warn(`Rate limit exceeded for user ${event.senderID}`);
      return;
    }

    // Process with module system first
    const handledByModule = await handleModuleCommand(api, event);
    if (handledByModule) return;

    // If not handled by module, try the command handler
    await handleCommand(api, event);
    
    // Process module events (for non-command functionality)
    await handleModuleEvents(api, event);
    
    // Skip unwanted thread types
    const threadInfo = await api.getThreadInfo(event.threadID);
    if (IGNORED_THREAD_TYPES.includes(threadInfo.threadType)) return;

    // Skip unwanted message types
    if (IGNORED_MESSAGE_TYPES.includes(event.type)) return;

    // Process message
    if (event.body) {
      // Handle bot commands
      const botHandler = botManager.getHandler(event.body);
      if (botHandler) {
        await botHandler.handle(api, event);
        return;
      }

      // Handle regular commands
      if (event.body.startsWith(botConfig.prefix) || event.body.startsWith(botConfig.adminPrefix)) {
        await handleCommand(api, event);
        return;
      }

      // Handle auto-replies
      await handleAutoReply(api, event);
    }

  } catch (error) {
    logger.error("Message handling error", error as Error);
  }
}

async function isRateLimited(userID: string): Promise<boolean> {
  const now = Date.now();
  const userLimit = userRateLimits.get(userID);

  if (!userLimit || now > userLimit.resetTime) {
    userRateLimits.set(userID, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    });
    return false;
  }

  userLimit.count++;
  if (userLimit.count > RATE_LIMIT.maxRequests) {
    return true;
  }

  return false;
}

async function handleAutoReply(api: Api, event: MessageEvent) {
  for (const { regex, response } of autoReplyConfig.patterns) {
    if (regex.test(event.body)) {
      try {
        const reply = typeof response === 'function' ? response() : response;
        await api.sendMessage(reply, event.threadID);
        return;
      } catch (error) {
        logger.error("Auto-reply error", error as Error);
      }
    }
  }
}

export async function handleGroupEvent(api: Api, event: MessageEvent) {
  try {
    const threadInfo = await api.getThreadInfo(event.threadID);
    let message = "";

    switch (event.eventType) {
      case 'participant-leave':
        message = await handleParticipantLeave(api, event);
        break;

      case 'participant-join':
        message = await handleParticipantJoin(api, event);
        break;

      case 'thread-image':
        message = "🖼️ Ảnh đại diện nhóm đã được thay đổi";
        break;

      case 'thread-name':
        message = `📝 Tên nhóm đã được đổi thành: ${threadInfo.threadName}`;
        break;

      default:
        logger.debug(`Unhandled group event type: ${event.eventType}`);
        return;
    }

    if (message) {
      await api.sendMessage(message, event.threadID);
    }

    logger.info(`Group event handled`, {
      threadID: event.threadID,
      eventType: event.eventType 
    });
  } catch (error) {
    logger.error("Group event handling error", error as Error);
  }
}

async function handleParticipantLeave(api: Api, event: MessageEvent): Promise<string> {
  const leftMember = event.participantIDs?.[0];
  if (!leftMember) return "";

  const leftMemberInfo = await api.getUserInfo(leftMember);
  const memberName = leftMemberInfo[leftMember]?.name || "Thành viên";

  if (antiOutConfig.enabled && !antiOutConfig.whitelist.includes(leftMember)) {
    try {
      await api.addUserToGroup(leftMember, event.threadID);
      return `🚫 ${memberName} đã cố gắng rời nhóm\n` +
        `✅ Bot đã thêm lại thành công!\n\n` +
        antiOutConfig.message;
    } catch (error) {
      logger.error("Anti-out error", error as Error);
      return `⚠️ Không thể thêm lại ${memberName} vào nhóm\n` +
        `❌ Lỗi: ${(error as Error).message}`;
    }
  }

  return `👋 Tạm biệt ${memberName}! Hẹn gặp lại.`;
}

async function handleParticipantJoin(api: Api, event: MessageEvent): Promise<string> {
  const newMembers = event.participantIDs || [];
  const welcomeTemplate = `👋 Chào mừng {name} đã tham gia nhóm!\n` +
    `📝 Prefix: ${botConfig.prefix}\n` +
    `💭 Gõ ${botConfig.prefix}help để xem danh sách lệnh`;

  let messages: string[] = [];

  for (const memberID of newMembers) {
    const memberInfo = await api.getUserInfo(memberID);
    messages.push(welcomeTemplate.replace('{name}', memberInfo[memberID].name));

    if (botConfig.admins.includes(memberID)) {
      messages.push("👑 Phát hiện admin mới tham gia nhóm!");
    }
  }

  return messages.join("\n\n");
}