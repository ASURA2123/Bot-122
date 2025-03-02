/**
 * Ví dụ sử dụng Enhanced Logger
 * 
 * File này chứa các ví dụ về cách sử dụng hệ thống log nâng cao
 * với các tính năng như màu sắc, biểu tượng, và thông báo qua email/Slack
 */

import { enhancedLogger } from './enhanced-logger';

// Ví dụ 1: Log thông tin cơ bản
function logBasicExamples() {
  // Log thông tin thông thường
  enhancedLogger.info('Bot đã khởi động thành công!');
  
  // Log debug (chỉ hiển thị khi LOG_LEVEL=debug)
  enhancedLogger.debug('Đang kết nối đến Facebook API...');
  
  // Log cảnh báo
  enhancedLogger.warn('Cảnh báo: Số lượng yêu cầu đang tăng nhanh');
  
  // Log lỗi thông thường
  enhancedLogger.error('Không thể kết nối đến Facebook API', new Error('Connection timeout'));
  
  // Log thông tin hệ thống
  enhancedLogger.system('Hệ thống đang khởi động lại...');
  
  // Log thông tin dành cho admin
  enhancedLogger.admin('Admin đã thay đổi cấu hình bot');
}

// Ví dụ 2: Log lỗi nghiêm trọng (sẽ gửi email và thông báo Slack nếu được cấu hình)
function logCriticalError() {
  try {
    // Giả lập một lỗi nghiêm trọng
    throw new Error('Không thể đăng nhập vào Facebook');
  } catch (error) {
    // Log lỗi nghiêm trọng - sẽ tự động gửi thông báo qua email và Slack
    enhancedLogger.critical(
      'Bot không thể đăng nhập vào Facebook, cần kiểm tra lại thông tin đăng nhập!', 
      error as Error,
      { lastAttempt: new Date().toISOString() }
    );
  }
}

// Ví dụ 3: Sử dụng các hàm định dạng
function useFormattingFunctions() {
  // Highlight text quan trọng
  console.log(enhancedLogger.highlight('Thông tin quan trọng'));
  
  // Tạo warning box
  console.log(enhancedLogger.warningBox('Cảnh báo!\nBot sẽ khởi động lại sau 5 phút.'));
  
  // Tạo error box
  console.log(enhancedLogger.errorBox('Lỗi nghiêm trọng!\nKhông thể kết nối đến server.'));
}

// Ví dụ 4: Gửi thông báo thủ công
function sendManualNotifications() {
  // Gửi email thủ công
  enhancedLogger.sendEmailToAdmin(
    'Thông báo bảo trì', 
    'Bot sẽ tạm ngừng hoạt động để bảo trì vào lúc 22:00 hôm nay.'
  );
  
  // Gửi thông báo Slack thủ công
  enhancedLogger.sendSlackMessageToAdmin(
    'Bot sẽ tạm ngừng hoạt động để bảo trì vào lúc 22:00 hôm nay.'
  );
}

// Hướng dẫn cấu hình
function configurationGuide() {
  console.log(enhancedLogger.highlight('Hướng dẫn cấu hình:'));
  console.log('1. Cấu hình email trong file .env:');
  console.log('   EMAIL_ENABLED=true');
  console.log('   EMAIL_SERVICE=gmail');
  console.log('   EMAIL_USER=your-email@gmail.com');
  console.log('   EMAIL_PASS=your-app-password');
  console.log('   EMAIL_TO=admin-email@example.com');
  
  console.log('\n2. Cấu hình Slack trong file .env:');
  console.log('   SLACK_ENABLED=true');
  console.log('   SLACK_TOKEN=xoxb-your-slack-bot-token');
  console.log('   SLACK_CHANNEL=#bot-alerts');
}

// Export các hàm ví dụ
export {
  logBasicExamples,
  logCriticalError,
  useFormattingFunctions,
  sendManualNotifications,
  configurationGuide
};