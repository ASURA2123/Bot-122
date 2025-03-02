
import fs from 'fs-extra';
import path from 'path';
import HttpsProxyAgent from 'https-proxy-agent';
import { logger } from './logger';
import fetch from 'node-fetch';

interface Proxy {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  lastUsed?: number;
  failures?: number;
}

export class ProxyRotator {
  private static instance: ProxyRotator;
  private proxies: Proxy[] = [];
  private currentProxyIndex: number = -1;
  private proxyFile: string = path.join(process.cwd(), 'proxies.json');
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30 * 60 * 1000; // 30 phút

  private constructor() {
    this.loadProxies();
    this.startProxyCheck();
  }

  public static getInstance(): ProxyRotator {
    if (!ProxyRotator.instance) {
      ProxyRotator.instance = new ProxyRotator();
    }
    return ProxyRotator.instance;
  }

  private async loadProxies(): Promise<void> {
    try {
      if (await fs.pathExists(this.proxyFile)) {
        this.proxies = await fs.readJSON(this.proxyFile);
        logger.info(`Đã tải ${this.proxies.length} proxy từ file`);
      } else {
        logger.warn('Không tìm thấy file proxies.json');
        // Tạo file mẫu
        await fs.writeJSON(this.proxyFile, [], { spaces: 2 });
      }
    } catch (error) {
      logger.error(`Lỗi khi tải proxies: ${(error as Error).message}`);
    }
  }

  private async saveProxies(): Promise<void> {
    try {
      await fs.writeJSON(this.proxyFile, this.proxies, { spaces: 2 });
    } catch (error) {
      logger.error(`Lỗi khi lưu proxies: ${(error as Error).message}`);
    }
  }

  public async addProxy(proxy: Proxy): Promise<void> {
    this.proxies.push({
      ...proxy,
      failures: 0,
      lastUsed: 0
    });
    await this.saveProxies();
    logger.info(`Đã thêm proxy: ${proxy.host}:${proxy.port}`);
  }

  public async removeProxy(index: number): Promise<void> {
    if (index >= 0 && index < this.proxies.length) {
      const proxy = this.proxies[index];
      this.proxies.splice(index, 1);
      await this.saveProxies();
      logger.info(`Đã xóa proxy: ${proxy.host}:${proxy.port}`);
    }
  }

  public async getNextProxy(): Promise<Proxy | null> {
    if (this.proxies.length === 0) {
      return null;
    }

    // Sắp xếp proxy theo số lần failure và thời gian sử dụng cuối cùng
    this.proxies.sort((a, b) => {
      // Ưu tiên proxy ít lỗi nhất
      if ((a.failures || 0) !== (b.failures || 0)) {
        return (a.failures || 0) - (b.failures || 0);
      }
      // Nếu số lỗi bằng nhau, ưu tiên proxy lâu nhất chưa được sử dụng
      return (a.lastUsed || 0) - (b.lastUsed || 0);
    });

    // Lấy proxy đầu tiên sau khi sắp xếp
    const proxy = this.proxies[0];
    proxy.lastUsed = Date.now();
    await this.saveProxies();
    
    logger.debug(`Sử dụng proxy: ${proxy.host}:${proxy.port}`);
    return proxy;
  }

  public async reportProxyFailure(proxy: Proxy): Promise<void> {
    const index = this.proxies.findIndex(p => p.host === proxy.host && p.port === proxy.port);
    if (index !== -1) {
      this.proxies[index].failures = (this.proxies[index].failures || 0) + 1;
      await this.saveProxies();
      logger.warn(`Proxy ${proxy.host}:${proxy.port} đã fail ${this.proxies[index].failures} lần`);
    }
  }

  public getProxyAgent(proxy: Proxy): HttpsProxyAgent.HttpsProxyAgent {
    const proxyUrl = `${proxy.protocol}://${proxy.auth ? `${proxy.auth.username}:${proxy.auth.password}@` : ''}${proxy.host}:${proxy.port}`;
    return HttpsProxyAgent(proxyUrl) as HttpsProxyAgent.HttpsProxyAgent;
  }

  public async checkProxy(proxy: Proxy): Promise<boolean> {
    try {
      const agent = this.getProxyAgent(proxy);
      const response = await fetch('https://api.ipify.org?format=json', {
        agent,
        timeout: 10000
      });
      
      if (response.ok) {
        const data = await response.json();
        logger.debug(`Proxy ${proxy.host}:${proxy.port} đang hoạt động với IP: ${data.ip}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`Proxy ${proxy.host}:${proxy.port} không hoạt động: ${(error as Error).message}`);
      
      // Sử dụng error handler để ghi lại lỗi proxy
      import('./error-handler').then(({ errorHandler }) => {
        errorHandler.logError(error as Error, {
          proxyHost: proxy.host,
          proxyPort: proxy.port,
          proxyType: proxy.protocol,
          context: 'proxy-check'
        });
      });
      
      return false;
    }
  }

  private startProxyCheck(): void {
    this.checkInterval = setInterval(async () => {
      logger.debug('Bắt đầu kiểm tra tất cả proxy...');
      for (const proxy of this.proxies) {
        const working = await this.checkProxy(proxy);
        if (!working) {
          proxy.failures = (proxy.failures || 0) + 1;
        } else if (proxy.failures && proxy.failures > 0) {
          proxy.failures = Math.max(0, proxy.failures - 1); // Giảm số lỗi nếu proxy đang hoạt động tốt
        }
      }
      await this.saveProxies();
    }, this.CHECK_INTERVAL);
  }

  public stopProxyCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public getProxyList(): Proxy[] {
    return [...this.proxies];
  }
}

export const proxyRotator = ProxyRotator.getInstance();
