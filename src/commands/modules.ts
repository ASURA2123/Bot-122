import { Command } from "../types";
import { getLoadedModules, reloadModule } from "../utils/module-integration";
import { logger } from "../utils/logger";

/**
 * Module management commands
 * 
 * These commands allow users to list, reload, and get information about modules
 */

// List all loaded modules
export const listModules: Command = {
  name: "modules",
  description: "List all loaded modules",
  usage: "modules [reload <name>]",
  execute: async ({ api, event, args }) => {
    try {
      // If no arguments, list all modules
      if (!args.length) {
        const moduleNames = getLoadedModules();
        if (!moduleNames.length) {
          return api.sendMessage("❌ No modules are currently loaded.", event.threadID, event.messageID);
        }

        const message = `📚 Loaded Modules (${moduleNames.length}):\n\n${moduleNames.sort().join("\n")}`;
        return api.sendMessage(message, event.threadID, event.messageID);
      }

      // Handle subcommands
      const subCommand = args[0].toLowerCase();

      // Reload a specific module
      if (subCommand === "reload" && args[1]) {
        const moduleName = args[1].toLowerCase();
        const success = await reloadModule(moduleName);

        if (success) {
          return api.sendMessage(`✅ Successfully reloaded module: ${moduleName}`, event.threadID, event.messageID);
        } else {
          return api.sendMessage(`❌ Failed to reload module: ${moduleName}`, event.threadID, event.messageID);
        }
      }

      // Invalid subcommand
      return api.sendMessage(
        `❓ Unknown subcommand. Usage: modules [reload <name>]`,
        event.threadID,
        event.messageID
      );
    } catch (error) {
      logger.error("Error in modules command:", error);
      return api.sendMessage("❌ An error occurred while processing your request.", event.threadID, event.messageID);
    }
  },
  permission: "admin"
};

// Export commands
export default {
  listModules
};