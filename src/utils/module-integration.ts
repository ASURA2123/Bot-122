import { Api, MessageEvent } from '../types';
import { logger } from './enhanced-logger';
import moduleLoader from './module-loader';
import config from '../config';
import { errorHandler, catchError } from './error-handler';

/**
 * Module Integration
 * 
 * This file provides integration between the bot's event system and the legacy JavaScript modules.
 * It handles command parsing, permission checking, and module execution.
 */

// Define permission levels
const PERMISSION_LEVELS = {
  NORMAL: 0,  // Regular users
  ADMIN: 1,   // Group admins
  OWNER: 2    // Bot owner
};

// Initialize global Currencies object if it doesn't exist
if (!global.Currencies) {
  global.Currencies = {
    getData: async (userID: string) => {
      // Placeholder implementation - should be replaced with actual database access
      return { exp: 0, money: 0 };
    },
    setData: async (userID: string, data: any) => {
      // Placeholder implementation
      return true;
    },
    increaseMoney: async (userID: string, amount: number) => {
      // Placeholder implementation
      return true;
    },
    decreaseMoney: async (userID: string, amount: number) => {
      // Placeholder implementation
      return true;
    },
    increaseExp: async (userID: string, amount: number) => {
      // Placeholder implementation
      return true;
    }
  };
}

/**
 * Initialize the module system
 * @param api Facebook API instance
 */
export async function initializeModules(api: Api): Promise<boolean> {
  try {
    // Set the API for the module loader
    moduleLoader.setApi(api);
    
    // Load all modules from the modules directory
    const success = await moduleLoader.loadModules();
    
    if (success) {
      const moduleCount = moduleLoader.getModuleNames().length;
      logger.info(`Successfully initialized ${moduleCount} modules`, { moduleNames: moduleLoader.getModuleNames() });
      return true;
    } else {
      logger.error('Failed to initialize modules');
      return false;
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    err.name = 'ModuleInitializationError';
    errorHandler.handleError(err, { component: 'module-integration' });
    return false;
  }
}

/**
 * Check if a message is a command and handle it
 * @param api Facebook API instance
 * @param event Message event
 */
export const handleModuleCommand = catchError(async function(api: Api, event: MessageEvent): Promise<boolean> {
  // Check if message starts with prefix
  if (!event.body?.startsWith(config.prefix)) return false;
  
  // Parse command and arguments
  const args = event.body.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  
  if (!commandName) return false;
  
  // Find module with matching command name
  const module = moduleLoader.getModule(commandName);
  
  if (!module) return false;
  
  // Log command usage for analytics
  logger.debug(`Command executed: ${commandName}`, {
    userId: event.senderID,
    threadId: event.threadID,
    args: args.join(' ')
  });
  
  // Check permissions
  const userPermission = event.senderID === config.owner ? PERMISSION_LEVELS.OWNER : PERMISSION_LEVELS.NORMAL;
  
  if (module.config.hasPermssion > userPermission) {
    await api.sendMessage('⚠️ You do not have permission to use this command.', event.threadID, event.messageID);
    return true;
  }
    
  // Execute the command
  await moduleLoader.executeCommand(event, commandName, args);
  return true;
});

/**
 * Handle events for all modules
 * @param api Facebook API instance
 * @param event Message event
 */
export const handleModuleEvents = catchError(async function(api: Api, event: MessageEvent): Promise<void> {
  await moduleLoader.handleEvent(event);
});

/**
 * Handle reactions for all modules
 * @param api Facebook API instance
 * @param event Reaction event
 */
export const handleModuleReactions = catchError(async function(api: Api, event: any): Promise<void> {
  await moduleLoader.handleReaction(event);
});

/**
 * Handle replies for all modules
 * @param api Facebook API instance
 * @param event Reply event
 */
export const handleModuleReplies = catchError(async function(api: Api, event: any): Promise<void> {
  await moduleLoader.handleReply(event);
});

/**
 * Reload a specific module
 * @param moduleName Name of the module to reload
 */
export const reloadModule = catchError(async function(moduleName: string): Promise<boolean> {
  const result = await moduleLoader.reloadModule(moduleName);
  if (result) {
    logger.info(`Module reloaded successfully: ${moduleName}`);
  } else {
    logger.warn(`Failed to reload module: ${moduleName}`);
  }
  return result;
});

/**
 * Get a list of all loaded modules
 */
export function getLoadedModules(): string[] {
  return moduleLoader.getModuleNames();
}