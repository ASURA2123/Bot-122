import { logger } from "./logger";
import { CookieManager } from "./cookie-manager";

// Use the same cookie file path as defined in CookieManager

/**
 * Kiểm tra tính hợp lệ của cookies Facebook
 * Sử dụng CookieManager để tránh trùng lặp code
 * @returns Promise<boolean> - true nếu cookies hợp lệ, false nếu không
 */
export async function checkCookies(): Promise<boolean> {
  try {
    // Sử dụng CookieManager để kiểm tra cookies
    const isValid = await CookieManager.areCookiesValid();
    
    if (!isValid) {
      logger.error("Không tìm thấy file cookies hoặc cookies không hợp lệ!", 
                  new Error("Cookie validation failed"));
      logger.info("Vui lòng tạo file fbcookies.json với các cookies cần thiết");
      return false;
    }
    
    // Kiểm tra thêm về thời hạn cookies
    const notExpired = await CookieManager.checkCookieExpiration();
    
    if (!notExpired) {
      logger.warn("Cookies có thể đã hết hạn!", 
                 new Error("Cookies may be expired"));
      logger.info("Vui lòng cập nhật cookies mới từ trình duyệt");
      return false;
    }
    
    // Tải cookies để hiển thị thông tin
    const cookies = await CookieManager.loadCookies();
    logger.info(`Đã tìm thấy ${cookies.length} cookies hợp lệ!`);
    return true;

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Lỗi kiểm tra cookies", err);
    return false;
  }
}