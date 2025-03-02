import { readFileSync, existsSync } from 'fs';
import { logger } from './src/utils/logger.js';
import { CookieManager } from './src/utils/cookie-manager.js';

// Use the same cookie file path as defined in CookieManager
const COOKIES_FILE = 'fbcookies.json';

/**
 * Cookie validation script
 * This script validates Facebook cookies required for the bot to function
 * It checks for existence, format, and required values
 */

async function validateCookies() {
  try {
    // Check if file exists
    if (!existsSync(COOKIES_FILE)) {
      logger.error('Cookie file not found', new Error('fbcookies.json not found'));
      logger.info('Please create the file using get-cookies.js or following instructions in README.md');
      process.exit(1);
    }

    // Read and parse JSON
    const cookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));

    // Check format
    if (!Array.isArray(cookies)) {
      logger.error('Invalid cookie format', new Error('Cookies must be an array'));
      process.exit(1);
    }

    // Check required cookies
    const required = ['c_user', 'xs', 'fr'];
    const missing = required.filter(name => 
      !cookies.some(cookie => cookie.key === name && cookie.value)
    );

    if (missing.length > 0) {
      logger.error('Missing required cookies', new Error(`Missing: ${missing.join(', ')}`));
      process.exit(1);
    }

    // Validate each cookie
    const invalid = cookies.filter(cookie => 
      !cookie.key || !cookie.value || !cookie.domain || !cookie.path
    );

    if (invalid.length > 0) {
      logger.error('Invalid cookie format', new Error(`Found ${invalid.length} invalid cookies`));
      process.exit(1);
    }

    // Check c_user and xs values
    const c_user = cookies.find(c => c.key === 'c_user');
    const xs = cookies.find(c => c.key === 'xs');

    if (!c_user?.value || !xs?.value) {
      logger.error('Invalid authentication cookies', new Error('c_user or xs value is empty'));
      process.exit(1);
    }

    logger.info('Cookie validation successful');
    logger.info(`Total cookies: ${cookies.length}`);
    logger.info('You can start the bot using: npm run dev');

  } catch (error) {
    logger.error('Cookie validation failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Execute validation
validateCookies();