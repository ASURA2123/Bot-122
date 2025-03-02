
import { Command } from '../types';
import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

const command: Command = {
  name: 'check-errors',
  description: 'Kiểm tra lỗi hệ thống gần đây và hiển thị trạng thái sức khỏe',
  
  execute: async (args: string[]) => {
    try {
      logger.info('Đang kiểm tra trạng thái lỗi hệ thống...');
      
      // Lấy các lỗi chưa được giải quyết
      const unresolvedErrors = errorHandler.getUnresolvedErrors();
      
      // Kiểm tra sức khỏe hệ thống
      const healthStatus = errorHandler.checkSystemHealth();
      
      // Hiển thị thông tin
      logger.info(`Trạng thái hệ thống: ${healthStatus.status.toUpperCase()}`);
      
      if (healthStatus.issues.length > 0) {
        logger.warn('Các vấn đề được phát hiện:');
        healthStatus.issues.forEach((issue, index) => {
          logger.warn(`${index + 1}. ${issue}`);
        });
      } else {
        logger.info('Không phát hiện vấn đề nghiêm trọng');
      }
      
      logger.info(`Số lỗi chưa được giải quyết: ${unresolvedErrors.length}`);
      
      if (unresolvedErrors.length > 0) {
        // Hiển thị 5 lỗi gần nhất
        const recentErrors = unresolvedErrors
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5);
        
        logger.info('5 lỗi gần đây nhất:');
        recentErrors.forEach((error, index) => {
          const date = new Date(error.timestamp).toLocaleString();
          const errorType = errorHandler.analyzeError(new Error(error.message));
          logger.info(`${index + 1}. [${date}] ${errorType}: ${error.message}`);
        });
      }
      
      return {
        status: 'success',
        message: 'Đã kiểm tra xong lỗi hệ thống',
        data: {
          status: healthStatus.status,
          unresolvedCount: unresolvedErrors.length,
          issues: healthStatus.issues
        }
      };
    } catch (error) {
      logger.error(`Lỗi khi kiểm tra lỗi hệ thống: ${(error as Error).message}`);
      return {
        status: 'error',
        message: `Lỗi: ${(error as Error).message}`
      };
    }
  }
};

export default command;
