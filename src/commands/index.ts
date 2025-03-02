import { Command } from "../types";
import { help } from "./help";
import { echo, ping, uptime } from "./basic";
import admin from "./admin";
import { video, img, meme } from "./media";
import { setlove, rankup, weather, wiki, wake, checkin } from "./utils";
import { commands as systemCommands } from "./system";
import { listModules } from "./modules";
import config from "../config";

export const commands = new Map<string, Command>();

// Đăng ký các lệnh cơ bản
commands.set(help.name, help);
commands.set(echo.name, echo);
commands.set(ping.name, ping);
commands.set(uptime.name, uptime);

// Đăng ký các lệnh admin
commands.set(admin.setname.name, admin.setname);
commands.set(admin.kick.name, admin.kick);
commands.set(admin.antiout.name, admin.antiout);

// Đăng ký các lệnh media
commands.set(video.name, video);
commands.set(img.name, img);
commands.set(meme.name, meme);

// Đăng ký các lệnh tiện ích
commands.set(setlove.name, setlove);
commands.set(rankup.name, rankup);
commands.set(weather.name, weather);
commands.set(wiki.name, wiki);
commands.set(wake.name, wake);
commands.set(checkin.name, checkin);

// Đăng ký lệnh quản lý modules
commands.set(listModules.name, listModules);

// Đăng ký các lệnh quản lý hệ thống
systemCommands.forEach(cmd => commands.set(cmd.name, cmd));

// Placeholder for the logs command -  Requires a proper implementation
const logsCommand: Command = {
  name: "logs",
  description: "Displays system logs",
  execute: async (message, args) => {
    // Implement actual log display logic here.  This is a placeholder.
    message.reply("Log display functionality not yet implemented.");
  },
  permission: "admin" // or adjust permission as needed
};
commands.set(logsCommand.name, logsCommand);


// Hàm kiểm tra quyền owner
export function isOwner(senderId: string): boolean {
  return senderId === config.owner;
}

// Hàm kiểm tra quyền admin
export function isAdmin(senderId: string): boolean {
  return isOwner(senderId) || config.admins.includes(senderId);
}

// Hàm lấy danh sách lệnh có sẵn dựa trên quyền hạn
export function getAvailableCommands(senderId: string): Command[] {
  const availableCommands: Command[] = [];
  const isUserOwner = isOwner(senderId);
  const isUserAdmin = isAdmin(senderId);

  for (const command of commands.values()) {
    // Kiểm tra quyền hạn của lệnh
    if (command.permission === 'owner' && !isUserOwner) continue;
    if (command.permission === 'admin' && !isUserAdmin) continue;
    availableCommands.push(command);
  }

  return availableCommands;
}