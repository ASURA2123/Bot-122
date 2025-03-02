export interface BotConfig {
  email: string;
  password: string;
  prefix: string; 
  adminPrefix: string;
  owner: string;
  admins: string[];
}

export interface LoggingConfig {
  level: string;
  enableConsole: boolean;
  enableFile: boolean;
  directory: string;
  maxSize: number;
  maxFiles: number;
}

export interface AntiOutConfig {
  enabled: boolean;
  whitelist: string[];
  message: string;
}

export interface AutoReplyConfig {
  patterns: Array<{
    regex: RegExp;
    response: string | (() => string);
  }>;
}
