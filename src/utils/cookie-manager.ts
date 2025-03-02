import fs from 'fs-extra';
import { logger } from './logger';

interface FacebookCookie {
  key: string;
  value: string;
  domain: string;
  path: string;
}

export class CookieManager {
  private static readonly COOKIES_FILE = 'fbcookies.json';
  private static readonly REQUIRED_COOKIES = ['c_user', 'xs', 'fr'];
  private static readonly COOKIE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly COOKIE_FILE_PATH = 'fbcookies.json';

  static async loadCookies(): Promise<FacebookCookie[]> {
    try {
      if (!await fs.pathExists(this.COOKIES_FILE)) {
        throw new Error('Cookie file not found');
      }

      const cookies = await fs.readJSON(this.COOKIES_FILE);
      return this.validateCookies(cookies);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load cookies', err);
      throw err;
    }
  }

  static async validateCookies(cookies: FacebookCookie[]): Promise<FacebookCookie[]> {
    if (!Array.isArray(cookies)) {
      throw new Error('Invalid cookie format - must be an array');
    }

    // Check required cookies
    const missingCookies = this.REQUIRED_COOKIES.filter(name =>
      !cookies.some(cookie => cookie.key === name && cookie.value)
    );

    if (missingCookies.length > 0) {
      throw new Error(`Missing required cookies: ${missingCookies.join(', ')}`);
    }

    // Validate cookie structure
    const invalidCookies = cookies.filter(cookie =>
      !cookie.key || !cookie.value || !cookie.domain || !cookie.path
    );

    if (invalidCookies.length > 0) {
      throw new Error(`Found ${invalidCookies.length} invalid cookies`);
    }

    return cookies;
  }

  static async saveCookies(cookies: FacebookCookie[]): Promise<void> {
    try {
      await this.validateCookies(cookies);
      await fs.writeJSON(this.COOKIES_FILE, cookies, { spaces: 2 });
      logger.info('Cookies saved successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save cookies', err);
      throw err;
    }
  }

  static formatCookiesForState(cookies: FacebookCookie[]): any[] {
    return cookies.map(cookie => ({
      key: cookie.key,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      hostOnly: false,
      creation: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    }));
  }

  static async updateCookieValue(key: string, value: string): Promise<void> {
    try {
      const cookies = await this.loadCookies();
      const cookie = cookies.find(c => c.key === key);

      if (!cookie) {
        throw new Error(`Cookie ${key} not found`);
      }

      cookie.value = value;
      await this.saveCookies(cookies);
      logger.info(`Updated cookie: ${key}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to update cookie ${key}`, err);
      throw err;
    }
  }

  static async areCookiesValid(): Promise<boolean> {
    try {
      await this.loadCookies();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Cookie validation failed: ${err.message}`);
      return false;
    }
  }

  static async checkCookieExpiration(): Promise<boolean> {
    try {
      const cookies = await this.loadCookies();
      
      // Check if cookies might be expired (simple check based on c_user and xs)
      const c_user = cookies.find(c => c.key === 'c_user');
      const xs = cookies.find(c => c.key === 'xs');
      
      if (!c_user || !xs || !c_user.value || !xs.value) {
        logger.warn('Critical cookies missing or empty values');
        return false;
      }
      
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to check cookie expiration', err);
      return false;
    }
  }
}