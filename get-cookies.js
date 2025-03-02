import { writeFileSync, readFileSync } from 'fs';
import readline from 'readline';
import { existsSync } from 'fs';
import path from 'path';

// Template for fbcookies.json
const cookieTemplate = {
  c_user: {
    key: "c_user",
    domain: "facebook.com",
    path: "/"
  },
  xs: {
    key: "xs",
    domain: "facebook.com",
    path: "/"
  },
  fr: {
    key: "fr",
    domain: "facebook.com",
    path: "/"
  },
  datr: {
    key: "datr",
    domain: "facebook.com",
    path: "/"
  }
};

// Hiển thị hướng dẫn với màu sắc
console.log('\x1b[36m%s\x1b[0m', '🔍 Trợ lý tạo file cookies cho Facebook Bot');
console.log('\x1b[33m%s\x1b[0m', '👉 Hãy dán giá trị cookies từ trình duyệt vào đây theo định dạng:');
console.log('\x1b[32m%s\x1b[0m', 'c_user=123456789;xs=abcdef;fr=abc123def456;datr=xyz123');
console.log('\x1b[33m%s\x1b[0m', '📝 Bạn có thể lấy cookies bằng cách:');
console.log('   1. Đăng nhập vào Facebook trên trình duyệt');
console.log('   2. Mở DevTools (F12) > Application > Cookies > facebook.com');
console.log('   3. Sao chép giá trị của các cookies: c_user, xs, fr, datr');
console.log('\n\x1b[36m%s\x1b[0m', '⌨️ Nhập cookies của bạn:');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  try {
    // Parse raw cookies string
    const cookiesStr = line.trim();
    if (!cookiesStr) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Vui lòng nhập cookies!');
      return; // Không đóng rl để người dùng có thể thử lại
    }
    
    const cookies = {};

    cookiesStr.split(';').forEach(pair => {
      const parts = pair.trim().split('=');
      if (parts.length < 2) return;
      
      const key = parts[0].trim();
      // Nối lại các phần còn lại trong trường hợp giá trị cookie có dấu =
      const value = parts.slice(1).join('=').trim();
      
      if (cookieTemplate[key]) {
        cookies[key] = value;
      }
    });

    // Validate required cookies
    const required = ['c_user', 'xs', 'fr'];
    const missing = required.filter(key => !cookies[key]);
    if (missing.length > 0) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Thiếu các cookies quan trọng: ${missing.join(', ')}`);
      console.log('\x1b[33m%s\x1b[0m', '👉 Vui lòng kiểm tra lại và nhập đầy đủ cookies!');
      return; // Không đóng rl để người dùng có thể thử lại
    }

    // Validate c_user format (should be numeric)
    if (!/^\d+$/.test(cookies['c_user'])) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Cookie c_user không hợp lệ! Phải là số.');
      return;
    }

    // Create cookies array in correct format
    const cookiesArray = Object.keys(cookieTemplate)
      .filter(key => cookies[key]) // Only include cookies that have values
      .map(key => ({
        ...cookieTemplate[key],
        value: cookies[key]
      }));

    // Check if file exists and backup if it does
    const filePath = 'fbcookies.json';
    if (existsSync(filePath)) {
      const backupPath = `fbcookies.backup.${Date.now()}.json`;
      writeFileSync(backupPath, readFileSync(filePath));
      console.log(`\x1b[36m%s\x1b[0m`, `📑 Đã sao lưu file cookies cũ vào ${backupPath}`);
    }

    // Save to file
    writeFileSync(filePath, JSON.stringify(cookiesArray, null, 2));
    console.log('\x1b[32m%s\x1b[0m', '✅ Đã tạo file fbcookies.json thành công!');
    console.log('\x1b[36m%s\x1b[0m', `📊 Đã lưu ${cookiesArray.length} cookies`);
    console.log('\x1b[32m%s\x1b[0m', '🚀 Bạn có thể khởi động bot bằng lệnh: npm run dev');
    rl.close();

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Lỗi xử lý cookies: ${error.message}`);
    console.log('\x1b[33m%s\x1b[0m', '👉 Vui lòng thử lại với định dạng đúng!');
  }
});

// Thêm hướng dẫn khi người dùng nhấn Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '👋 Đã hủy quá trình nhập cookies!');
  process.exit(0);
});