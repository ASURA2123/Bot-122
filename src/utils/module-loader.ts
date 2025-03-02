import path from 'path';
import fs from 'fs-extra';
import { logger } from './logger';
import type { Api } from '../types';

interface ModuleConfig {
  name: string;
  version: string;
  hasPermssion: number;
  credits: string;
  description: string;
  commandCategory: string;
  usages: string;
  cooldowns: number;
  envConfig?: Record<string, any>;
}

interface Module {
  config: ModuleConfig;
  languages?: Record<string, Record<string, string>>;
  run: (params: any) => Promise<any>;
  handleEvent?: (params: any) => Promise<any>;
  handleReaction?: (params: any) => Promise<any>;
  handleReply?: (params: any) => Promise<any>;
}

class ModuleLoader {
  private modules: Map<string, Module> = new Map();
  private modulePath: string = path.join(process.cwd(), 'modules');
  private api: Api | null = null;
  private currentLanguage: string = 'vi';

  constructor() {
    // Ensure modules directory exists
    if (!fs.existsSync(this.modulePath)) {
      fs.mkdirSync(this.modulePath, { recursive: true });
    }
  }

  public setApi(api: Api) {
    this.api = api;
  }

  public setLanguage(language: string) {
    this.currentLanguage = language;
  }

  public async loadModules() {
    try {
      const files = fs.readdirSync(this.modulePath).filter(file => file.endsWith('.js'));
      
      let loadedCount = 0;
      for (const file of files) {
        if (await this.loadModule(file)) {
          loadedCount++;
        }
      }
      
      logger.info(`Loaded ${loadedCount} modules from ${files.length} files`);
      return true;
    } catch (error) {
      logger.error('Error loading modules:', error);
      return false;
    }
  }

  private async loadModule(filename: string) {
    try {
      const modulePath = path.join(this.modulePath, filename);
      
      // Clear cache to ensure fresh module load
      delete require.cache[require.resolve(modulePath)];
      
      // Load the module
      const moduleData = require(modulePath);
      
      if (!moduleData.config || !moduleData.run) {
        logger.warn(`Module ${filename} has invalid format, skipping`);
        return false;
      }
      
      const moduleName = moduleData.config.name || path.basename(filename, '.js');
      
      this.modules.set(moduleName, moduleData);
      logger.info(`Loaded module: ${moduleName} (${moduleData.config.version})`);
      return true;
    } catch (error) {
      logger.error(`Error loading module ${filename}:`, error);
      return false;
    }
  }

  public async reloadModule(name: string) {
    if (!this.modules.has(name)) {
      logger.error(`Module ${name} does not exist`);
      return false;
    }

    try {
      const moduleFiles = fs.readdirSync(this.modulePath);
      const moduleFile = moduleFiles.find(file => {
        const baseName = path.basename(file, '.js');
        return baseName === name || baseName === name.toLowerCase();
      });

      if (!moduleFile) {
        logger.error(`Could not find file for module ${name}`);
        return false;
      }
      
      // Remove current module
      this.modules.delete(name);
      
      // Reload module
      await this.loadModule(moduleFile);
      
      logger.info(`Reloaded module: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error reloading module ${name}:`, error);
      return false;
    }
  }

  public getModule(name: string): Module | undefined {
    return this.modules.get(name);
  }

  public getAllModules(): Map<string, Module> {
    return this.modules;
  }

  public getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  public getText(moduleName: string, key: string, ...args: any[]): string {
    const module = this.modules.get(moduleName);
    if (!module || !module.languages) {
      return key;
    }

    // Get text from module's language data
    const language = module.languages[this.currentLanguage] || module.languages.vi || module.languages.en;
    if (!language || !language[key]) {
      return key;
    }

    let text = language[key];
    for (let i = args.length - 1; i >= 0; i--) {
      text = text.replace(new RegExp(`%${i + 1}`, 'g'), args[i]);
    }

    return text;
  }

  public async executeCommand(event: any, moduleName: string, args: string[]) {
    if (!this.api) {
      logger.error('API not set for module loader');
      return false;
    }

    const module = this.modules.get(moduleName);
    if (!module) {
      logger.warn(`Module ${moduleName} not found`);
      return false;
    }

    try {
      // Create context for module execution
      const context = {
        api: this.api,
        event,
        args,
        getText: (key: string, ...args: any[]) => this.getText(moduleName, key, ...args),
        Currencies: global.Currencies // Assuming Currencies is available globally
      };

      // Execute module's run function
      await module.run(context);
      return true;
    } catch (error) {
      logger.error(`Error executing module ${moduleName}:`, error);
      return false;
    }
  }

  public async handleEvent(event: any) {
    if (!this.api) return false;
    
    for (const [name, module] of this.modules.entries()) {
      if (typeof module.handleEvent === 'function') {
        try {
          const context = {
            api: this.api,
            event,
            getText: (key: string, ...args: any[]) => this.getText(name, key, ...args),
            Currencies: global.Currencies
          };

          await module.handleEvent(context);
        } catch (error) {
          logger.error(`Error in event handler of module ${name}:`, error);
        }
      }
    }
  }

  public async handleReaction(event: any) {
    if (!this.api) return false;
    
    for (const [name, module] of this.modules.entries()) {
      if (typeof module.handleReaction === 'function') {
        try {
          const context = {
            api: this.api,
            event,
            getText: (key: string, ...args: any[]) => this.getText(name, key, ...args),
            Currencies: global.Currencies
          };

          await module.handleReaction(context);
        } catch (error) {
          logger.error(`Error in reaction handler of module ${name}:`, error);
        }
      }
    }
  }

  public async handleReply(event: any) {
    if (!this.api) return false;
    
    for (const [name, module] of this.modules.entries()) {
      if (typeof module.handleReply === 'function') {
        try {
          const context = {
            api: this.api,
            event,
            getText: (key: string, ...args: any[]) => this.getText(name, key, ...args),
            Currencies: global.Currencies
          };

          await module.handleReply(context);
        } catch (error) {
          logger.error(`Error in reply handler of module ${name}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const moduleLoader = new ModuleLoader();
export default moduleLoader;