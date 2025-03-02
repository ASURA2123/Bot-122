
import path from 'path';
import fs from 'fs-extra';
import { logger } from './logger';
import type { Api } from '../types';
import { pathToFileURL } from 'url';

class PluginLoader {
  private plugins: Map<string, any> = new Map();
  private pluginPath: string = path.join(process.cwd(), 'plugins');
  private api: Api | null = null;
  private moduleCache: Map<string, any> = new Map();

  constructor() {
    // Đảm bảo thư mục plugins tồn tại
    if (!fs.existsSync(this.pluginPath)) {
      fs.mkdirSync(this.pluginPath, { recursive: true });
    }
  }

  public setApi(api: Api) {
    this.api = api;
  }

  public async loadPlugins() {
    try {
      const files = fs.readdirSync(this.pluginPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
      
      for (const file of files) {
        await this.loadPlugin(file);
      }
      
      logger.info(`Đã tải ${this.plugins.size} plugins`);
      return true;
    } catch (error) {
      logger.error('Lỗi khi tải plugins:', error);
      return false;
    }
  }

  private async loadPlugin(filename: string) {
    try {
      const pluginPath = path.join(this.pluginPath, filename);
      const fileUrl = pathToFileURL(pluginPath).href;
      
      // Force reload by appending timestamp to URL
      const moduleUrl = `${fileUrl}?update=${Date.now()}`;
      const plugin = await import(moduleUrl);
      
      if (!plugin.config || !plugin.onCall) {
        logger.warn(`Plugin ${filename} không đúng định dạng, bỏ qua`);
        return false;
      }
      
      const pluginName = plugin.config.name || path.basename(filename, path.extname(filename));
      
      this.plugins.set(pluginName, plugin);
      this.moduleCache.set(pluginName, moduleUrl);
      logger.info(`Đã tải plugin: ${pluginName}`);
      return true;
    } catch (error) {
      logger.error(`Lỗi khi tải plugin ${filename}:`, error);
      return false;
    }
  }

  public async reloadPlugin(name: string) {
    if (!this.plugins.has(name)) {
      logger.error(`Plugin ${name} không tồn tại`);
      return false;
    }

    try {
      const pluginFiles = fs.readdirSync(this.pluginPath);
      const pluginFile = pluginFiles.find(file => {
        const baseName = path.basename(file, path.extname(file));
        return baseName === name || baseName === name.toLowerCase();
      });

      if (!pluginFile) {
        logger.error(`Không tìm thấy file cho plugin ${name}`);
        return false;
      }
      
      // Xóa plugin hiện tại
      this.plugins.delete(name);
      this.moduleCache.delete(name);
      
      // Tải lại plugin
      await this.loadPlugin(pluginFile);
      
      logger.info(`Đã tải lại plugin: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Lỗi khi tải lại plugin ${name}:`, error);
      return false;
    }
  }

  public handleCommand(event: any) {
    if (!this.api) return false;
    
    const pluginNames = Array.from(this.plugins.keys());
    
    for (const name of pluginNames) {
      const plugin = this.plugins.get(name);
      
      try {
        // Kiểm tra xem plugin có xử lý sự kiện này không
        if (typeof plugin.onCall === 'function') {
          plugin.onCall({
            api: this.api,
            event: event,
            args: event.body?.split(' ').slice(1) || []
          });
        }
      } catch (error) {
        logger.error(`Lỗi khi chạy plugin ${name}:`, error);
      }
    }
  }
}

export default new PluginLoader();
