import HttpsProxyAgent from 'https-proxy-agent';
import { proxyRotator } from './proxy-rotator';
import { logger } from './logger';

/**
 * Lấy agent proxy cho các kết nối HTTPS
 * @returns HTTPS Proxy Agent hoặc undefined nếu không có proxy
 */
export async function getHttpsProxyAgent(): Promise<HttpsProxyAgent.HttpsProxyAgent | undefined> {
  try {
    const proxy = await proxyRotator.getNextProxy();
    if (!proxy) {
      return undefined;
    }

    return proxyRotator.getProxyAgent(proxy);
  } catch (error) {
    logger.error(`Lỗi khi lấy proxy agent: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Báo cáo rằng proxy hiện tại đã thất bại
 * @param error Lỗi xảy ra
 */
export async function reportProxyFailure(error: Error): Promise<void> {
  const proxy = await proxyRotator.getNextProxy();
  if (proxy) {
    await proxyRotator.reportProxyFailure(proxy);
    logger.warn(`Đã báo cáo lỗi proxy: ${error.message}`);
  }
}