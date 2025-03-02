
import { Api, ThreadConfig } from "../types";
import { proxyRotator } from "../utils/proxy-rotator";
import { logger } from "../utils/logger";

export async function handleProxyCommand(api: Api, event: any, args: string[]): Promise<void> {
  const senderId = event.senderID;
  const threadID = event.threadID;
  const isAdmin = ThreadConfig.isAdmin(senderId);

  if (!isAdmin) {
    api.sendMessage("⛔ Bạn không có quyền sử dụng lệnh này.", threadID);
    return;
  }

  const subCommand = args[0]?.toLowerCase();

  switch (subCommand) {
    case "list":
      await listProxies(api, threadID);
      break;
    case "add":
      await addProxy(api, threadID, args.slice(1));
      break;
    case "remove":
      await removeProxy(api, threadID, args.slice(1));
      break;
    case "check":
      await checkProxy(api, threadID, args.slice(1));
      break;
    case "status":
      await getProxyStatus(api, threadID);
      break;
    default:
      api.sendMessage(
        "❓ Sử dụng lệnh proxy:\n" +
        "- proxy list: Xem danh sách proxy\n" +
        "- proxy add [host] [port] [protocol] [username] [password]: Thêm proxy mới\n" +
        "- proxy remove [index]: Xóa proxy theo vị trí\n" +
        "- proxy check [index]: Kiểm tra proxy theo vị trí\n" +
        "- proxy status: Xem trạng thái hệ thống proxy",
        threadID
      );
      break;
  }
}

async function listProxies(api: Api, threadID: string): Promise<void> {
  const proxies = proxyRotator.getProxyList();
  
  if (proxies.length === 0) {
    api.sendMessage("📋 Danh sách proxy trống. Thêm proxy bằng lệnh 'proxy add'.", threadID);
    return;
  }

  let message = "📋 Danh sách proxy:\n\n";
  proxies.forEach((proxy, index) => {
    message += `${index + 1}. ${proxy.protocol}://${proxy.host}:${proxy.port}\n`;
    message += `   - Auth: ${proxy.auth ? `${proxy.auth.username}:***` : 'Không'}\n`;
    message += `   - Lỗi: ${proxy.failures || 0}\n`;
    message += `   - Sử dụng lần cuối: ${proxy.lastUsed ? new Date(proxy.lastUsed).toLocaleString() : 'Chưa sử dụng'}\n\n`;
  });

  api.sendMessage(message, threadID);
}

async function addProxy(api: Api, threadID: string, args: string[]): Promise<void> {
  if (args.length < 3) {
    api.sendMessage(
      "⚠️ Thiếu thông tin. Cú pháp: proxy add [host] [port] [protocol] [username] [password]",
      threadID
    );
    return;
  }

  const [host, portStr, protocol, username, password] = args;
  const port = parseInt(portStr, 10);

  if (isNaN(port) || port <= 0 || port > 65535) {
    api.sendMessage("⚠️ Port không hợp lệ. Port phải là số từ 1-65535.", threadID);
    return;
  }

  if (!["http", "https", "socks4", "socks5"].includes(protocol)) {
    api.sendMessage(
      "⚠️ Protocol không hợp lệ. Các protocol hỗ trợ: http, https, socks4, socks5.",
      threadID
    );
    return;
  }

  const proxy: any = {
    host,
    port,
    protocol: protocol as any
  };

  if (username && password) {
    proxy.auth = { username, password };
  }

  await proxyRotator.addProxy(proxy);
  api.sendMessage(`✅ Đã thêm proxy ${host}:${port} thành công.`, threadID);
}

async function removeProxy(api: Api, threadID: string, args: string[]): Promise<void> {
  if (args.length < 1) {
    api.sendMessage("⚠️ Thiếu vị trí proxy cần xóa. Cú pháp: proxy remove [index]", threadID);
    return;
  }

  const index = parseInt(args[0], 10) - 1;
  const proxies = proxyRotator.getProxyList();

  if (isNaN(index) || index < 0 || index >= proxies.length) {
    api.sendMessage(`⚠️ Vị trí không hợp lệ. Vui lòng chọn từ 1-${proxies.length}.`, threadID);
    return;
  }

  await proxyRotator.removeProxy(index);
  api.sendMessage(`✅ Đã xóa proxy vị trí ${index + 1} thành công.`, threadID);
}

async function checkProxy(api: Api, threadID: string, args: string[]): Promise<void> {
  if (args.length < 1) {
    api.sendMessage("⚠️ Thiếu vị trí proxy cần kiểm tra. Cú pháp: proxy check [index]", threadID);
    return;
  }

  const index = parseInt(args[0], 10) - 1;
  const proxies = proxyRotator.getProxyList();

  if (isNaN(index) || index < 0 || index >= proxies.length) {
    api.sendMessage(`⚠️ Vị trí không hợp lệ. Vui lòng chọn từ 1-${proxies.length}.`, threadID);
    return;
  }

  api.sendMessage(`🔄 Đang kiểm tra proxy ${proxies[index].host}:${proxies[index].port}...`, threadID);
  
  const working = await proxyRotator.checkProxy(proxies[index]);
  
  if (working) {
    api.sendMessage(`✅ Proxy ${proxies[index].host}:${proxies[index].port} đang hoạt động tốt.`, threadID);
  } else {
    api.sendMessage(`❌ Proxy ${proxies[index].host}:${proxies[index].port} không hoạt động.`, threadID);
  }
}

async function getProxyStatus(api: Api, threadID: string): Promise<void> {
  const proxies = proxyRotator.getProxyList();
  const workingProxies = proxies.filter(p => !(p.failures && p.failures > 3));
  
  let message = "📊 Trạng thái hệ thống proxy:\n\n";
  message += `- Tổng số proxy: ${proxies.length}\n`;
  message += `- Proxy hoạt động tốt: ${workingProxies.length}\n`;
  message += `- Proxy có vấn đề: ${proxies.length - workingProxies.length}\n`;
  
  if (proxies.length > 0) {
    const lastUsed = proxies.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
    message += `- Proxy sử dụng gần nhất: ${lastUsed.host}:${lastUsed.port}\n`;
    message += `  Thời gian: ${lastUsed.lastUsed ? new Date(lastUsed.lastUsed).toLocaleString() : 'Chưa sử dụng'}\n`;
  }
  
  api.sendMessage(message, threadID);
}
