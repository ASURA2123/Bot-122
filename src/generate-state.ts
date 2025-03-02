import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs-extra';
import { logger } from "./utils/logger";
import config from "./config";

puppeteer.use(StealthPlugin());

logger.info("Bắt đầu tạo state file...");

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();

    // Set modern user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Navigate to Facebook's mobile site which is lighter
    logger.info("Đang truy cập Facebook...");
    await page.goto('https://m.facebook.com/');

    // Enable request interception for better logging
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('login')) {
        logger.debug('Sending login request...');
      }
      request.continue();
    });

    // Wait for and fill in the login form
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.type('#email', config.email);
    await page.type('#pass', config.password);

    // Click login button
    logger.info("Đang đăng nhập...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[name="login"]')
    ]);

    // Wait for successful login and check for errors
    try {
      await page.waitForSelector('[aria-label="Facebook"]', { timeout: 10000 });
    } catch (error) {
      // Check for common error messages
      const errorText = await page.evaluate(() => {
        const errorElement = document.querySelector('#error_box');
        return errorElement ? errorElement.innerText : null;
      });

      if (errorText) {
        throw new Error(`Facebook đăng nhập thất bại: ${errorText}`);
      }
    }

    // Get cookies
    const cookies = await page.cookies();
    logger.info(`Đã lấy được ${cookies.length} cookies`);

    // Format cookies for facebook-chat-api
    const formattedState = cookies.map(cookie => ({
      key: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      creation: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    }));

    // Save state
    await fs.writeJSON('fbstate.json', formattedState, { spaces: 2 });
    logger.info("✓ Đã lưu state file thành công!");

    await browser.close();
    process.exit(0);

  } catch (error) {
    logger.error("Lỗi khi tạo state:", error);
    process.exit(1);
  }
})();