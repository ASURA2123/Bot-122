import fetch from 'node-fetch';
import fs from 'fs-extra';
import { logger } from './utils/logger';
import config from './config';

(async () => {
  try {
    logger.info("Bắt đầu lấy cookies từ Facebook...");

    // First request to get initial cookies
    const response = await fetch('https://m.facebook.com/login.php', {
      method: 'POST',
      headers: {
        // Giả lập User-Agent của điện thoại Android
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.87 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://m.facebook.com',
        'Referer': 'https://m.facebook.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        // Thêm các header bảo mật
        'sec-ch-ua': '"Not A(Brand";v="99", "Android Chrome";v="97"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"'
      },
      body: new URLSearchParams({
        'email': config.email,
        'pass': config.password,
        'login': 'Log In'
      }),
      redirect: 'manual',
      timeout: 30000 // 30 second timeout
    }).catch(error => {
      logger.error("Lỗi kết nối:", {
        message: error.message,
        code: error.code,
        type: error.type,
        stack: error.stack
      });
      throw error;
    });

    // Get cookies from response
    const cookies = response.headers.raw()['set-cookie'] || [];
    logger.info(`Nhận được ${cookies.length} cookies từ response`);

    // Log cookies (ẩn giá trị nhạy cảm)
    cookies.forEach((cookie, index) => {
      const [name] = cookie.split('=');
      logger.debug(`Cookie ${index + 1}: ${name}=***`);
    });

    // Format cookies for facebook-chat-api
    const formattedState = cookies.map(cookie => {
      const [keyValue, ...parts] = cookie.split(';');
      const [key, value] = keyValue.split('=');
      const domain = parts.find(p => p.trim().startsWith('Domain='))?.split('=')[1] || '.facebook.com';
      const path = parts.find(p => p.trim().startsWith('Path='))?.split('=')[1] || '/';

      return {
        key: key.trim(),
        value: value,
        domain: domain,
        path: path,
        creation: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
    });

    // Save state
    await fs.writeJSON('fbstate.json', formattedState, { spaces: 2 });
    logger.info(`Đã lưu ${formattedState.length} cookies vào state file`);

    // Test the saved state
    const fbChat = await import('facebook-chat-api');
    await new Promise((resolve, reject) => {
      fbChat.default({ 
        appState: formattedState,
        // Thêm tùy chọn để giả lập điện thoại
        userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.87 Mobile Safari/537.36',
        logLevel: 'verbose'
      }, (err, api) => {
        if (err) {
          // Log chi tiết lỗi
          logger.error("Lỗi kiểm tra state:", JSON.stringify(err, null, 2));
          reject(err);
        } else {
          logger.info("✓ Kiểm tra state thành công!");
          resolve(api);
        }
      });
    });

    process.exit(0);
  } catch (error) {
    logger.error("Lỗi khi lấy cookies:", error);
    process.exit(1);
  }
})();