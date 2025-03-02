import { loadEnvConfig } from "./env";
import { BotConfig, LoggingConfig, AntiOutConfig, AutoReplyConfig } from "./types";
import moment from "moment";

// Load and validate environment variables
const env = loadEnvConfig();

// Bot configuration
export const botConfig: BotConfig = {
  email: env.FB_EMAIL,
  password: env.FB_PASSWORD,
  prefix: env.PREFIX,
  adminPrefix: env.ADMIN_PREFIX,
  owner: env.OWNER_ID || '',
  admins: env.ADMIN_IDS
};

// Anti-out configuration
export const antiOutConfig: AntiOutConfig = {
  enabled: true,
  whitelist: [],
  message: "⚠️ Bot đã thêm bạn lại vào nhóm vì tính năng chống out đang bật!"
};

// Export default config
export default botConfig;