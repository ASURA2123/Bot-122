import { Api, MessageEvent } from "../types";
import { commands } from "../commands";
import config from "../config";
import { logger } from "./logger";
import { ErrorHandler } from "./error-handler";

export async function handleCommand(api: Api, event: MessageEvent) {
  const isAdminCommand = event.body.startsWith(config.adminPrefix);
  const isNormalCommand = event.body.startsWith(config.prefix);

  if (!isAdminCommand && !isNormalCommand) return;

  const prefix = isAdminCommand ? config.adminPrefix : config.prefix;
  const args = event.body.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = commands.get(commandName);

  if (!command) {
    await api.sendMessage(
      `❌ Không tìm thấy lệnh. Dùng ${config.prefix}help để xem danh sách lệnh.`,
      event.threadID
    );
    return;
  }

  // Kiểm tra quyền hạn
  if (command.permission === 'owner' && event.senderID !== config.owner) {
    await api.sendMessage("❌ Chỉ chủ bot mới có thể sử dụng lệnh này!", event.threadID);
    return;
  }

  if (command.permission === 'admin' && 
      !config.admins.includes(event.senderID) && 
      event.senderID !== config.owner) {
    await api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", event.threadID);
    return;
  }

  try {
    // Ensure api has all required methods before executing command
    const extendedApi: Api = {
      ...api,
      unsendMessage: api.unsendMessage.bind(api),
      removeUserFromGroup: api.removeUserFromGroup.bind(api),
      addUserToGroup: api.addUserToGroup.bind(api),
      getCurrentUserID: api.getCurrentUserID.bind(api),
      getAppState: api.getAppState.bind(api),
      getUserInfo: api.getUserInfo.bind(api),
      getThreadInfo: api.getThreadInfo.bind(api)
    };

    await command.execute(extendedApi, event);
  } catch (error) {
    const handledError = ErrorHandler.getErrorDetails(error instanceof Error ? error : new Error(String(error)));
    const commandError = new Error(`Lỗi thực thi lệnh ${commandName}: ${handledError.message}`);
    commandError.name = 'CommandExecutionError';
    logger.error('Error executing command', commandError);

    await api.sendMessage(
      "❌ Đã xảy ra lỗi khi thực hiện lệnh. Vui lòng thử lại sau.",
      event.threadID
    );
  }
}