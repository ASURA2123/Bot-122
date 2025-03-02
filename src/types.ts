// Import as type để tránh lỗi runtime
import type { Api as FacebookApi, UserInfo } from 'facebook-chat-api';

// Extend the FacebookApi type with additional methods
export interface Api extends Omit<FacebookApi, 'getUserInfo'> {
  unsendMessage(messageID: string): Promise<void>;
  removeUserFromGroup(userID: string, threadID: string): Promise<void>;
  addUserToGroup(userID: string, threadID: string): Promise<void>;
  getCurrentUserID(): string;
  getAppState(): AppState[];
  getUserInfo(id: string): Promise<{ [key: string]: UserInfo }>;
  getThreadInfo(threadID: string): Promise<ThreadInfo>;
}

export interface ThreadInfo {
  threadID: string;
  threadName?: string;
  participantIDs: string[];
  threadType: string;
  isGroup: boolean;
}

export interface BotConfig {
  email: string;
  password: string;
  prefix: string;
  adminPrefix: string;
  owner: string;
  admins: string[];
}

// Define AppState interface for facebook-chat-api
export interface AppState {
  key: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  creation: string;
  lastAccessed: string;
}

// Add custom Facebook error type 
export interface FacebookApiError extends Error {
  error: number | 'Not logged in';
  errorDescription?: string;
  stack?: string;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  permission?: 'admin' | 'owner';
  execute: (api: Api, event: MessageEvent) => Promise<void>;
}

export interface MessageEvent {
  threadID: string;
  messageID: string;
  senderID: string;
  body: string;
  isGroup: boolean;
  type: 'message' | 'event';
  attachments: any[];
  mentions?: Record<string, string>;
  messageReply?: {
    messageID: string;
  };
  participantIDs?: string[];
  eventType?: 'participant-join' | 'participant-leave' | 'thread-image' | 'thread-name';
}

// Thêm các tiện ích type cho việc xử lý tin nhắn
export interface MessageOptions {
  threadID: string;
  body?: string;
  attachment?: any[];
  replyToMessage?: string;
  markAsRead?: boolean;
}

export type CommandHandler = (api: Api, event: MessageEvent, args: string[]) => Promise<void>;

// Thêm config type cho anti-out
export interface AntiOutConfig {
  enabled: boolean;
  whitelist: string[];
  message: string;
}

// Error types
export interface HandledError extends Error {
  name: string;
  message: string;
  code?: string;
  details?: any;
  stack?: string;
  category?: ErrorCategory;
  recoverable?: boolean;
}

// Error categories
export enum ErrorCategory {
  AUTH = 'auth',
  SESSION = 'session',
  CONNECTION = 'connection',
  API = 'api',
  UNKNOWN = 'unknown'
}

// Logger interface
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  critical(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  getLogs(level?: string, limit?: number, from?: Date, to?: Date): Promise<any[]>;
}