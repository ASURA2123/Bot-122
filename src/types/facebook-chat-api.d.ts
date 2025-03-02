// Type definitions for facebook-chat-api
declare module 'facebook-chat-api' {
  export interface Api {
    getCurrentUserID(): string;
    sendMessage(message: string | object, threadID: string, callback?: Function): Promise<any>;
    listenMqtt(callback: (err: any, event: any) => void): void;
    getThreadInfo(threadID: string): Promise<ThreadInfo>;
    getAppState(): any;
    setMessageReaction(reaction: string, messageID: string): Promise<void>;
    getUserInfo(userID: string | string[]): Promise<{ [key: string]: UserInfo }>;
    changeThreadImage(image: string, threadID: string): Promise<void>;
    changeThreadName(newName: string, threadID: string): Promise<void>;
    removeUserFromGroup(userID: string, threadID: string): Promise<void>;
    addUserToGroup(userID: string, threadID: string): Promise<void>;
    sendTypingIndicator(threadID: string, callback?: (err: any) => void): void;
  }

  export interface ThreadInfo {
    threadID: string;
    participantIDs: string[];
    threadName?: string;
    userInfo?: UserInfo[];
    unreadCount?: number;
    messageCount?: number;
    imageSrc?: string;
    emoji?: string;
    color?: string;
    nicknames?: { [key: string]: string };
    adminIDs?: string[];
    threadType: 'group' | 'user' | 'page' | 'marketplace' | string;
    isGroup: boolean;
  }

  export interface UserInfo {
    name: string;
    firstName: string;
    vanity?: string;
    thumbSrc?: string;
    profileUrl?: string;
    gender?: string;
    type?: string;
    isFriend?: boolean;
    isBirthday?: boolean;
  }

  export interface MessageEvent {
    type: 'message' | 'event';
    threadID: string;
    messageID?: string;
    senderID: string;
    body?: string;
    attachments?: any[];
    mentions?: { [key: string]: string };
    timestamp: number;
    isGroup: boolean;
    participantIDs?: string[];
    eventType?: 'group-name-change' | 'participant-join' | 'participant-leave' | 'thread-image' | 'thread-name';
    snippet?: string;
    messageReactions?: { [key: string]: string[] };
    successful_results?: any; // Add this property that appears in MQTT responses
  }

  export interface LoginOptions {
    email?: string;
    password?: string;
    appState?: any;
  }

  export interface LoginCallback {
    (err: Error | null, api: Api): void;
  }

  export default function login(credentials: LoginOptions, callback: LoginCallback): void;
}