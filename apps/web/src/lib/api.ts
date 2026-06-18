import type { ChatItem } from "@/data/chat-items";
import { request, type RequestResult } from "@/lib/request";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** 增量拉取直播聊天记录的响应 */
export interface LiveChatItemsResponse {
  items: ChatItem[];
  total: number;
}

/** SSE message 事件载荷 */
export interface LiveSseMessagePayload {
  live_session_id: number;
  item: ChatItem;
  total: number;
  index: number;
}

/** SSE typing 事件载荷 */
export interface LiveSseTypingPayload {
  live_session_id: number;
  typing: boolean;
  /** incoming = 对方，outgoing = 自己 */
  speaker: "incoming" | "outgoing";
}

/**
 * 获取直播 SSE 流地址。
 *
 * @returns ``/api/live/events`` 完整 URL
 */
export function getLiveEventsUrl(): string {
  return `${API_URL}/api/live/events`;
}

/**
 * 从后端 API 获取聊天列表数据（默认返回移动端已开启的会话）。
 *
 * @returns 业务 data 为 ChatItem 数组
 */
export function fetchChatItems(): Promise<RequestResult<ChatItem[]>> {
  return request<ChatItem[]>({ url: "/api/chat-items" });
}

/**
 * 从后端 API 获取直播页聊天列表数据（默认返回直播端已开启的会话）。
 *
 * @param since - 已有消息条数，传入时仅返回增量消息
 * @returns 业务 data 为聊天记录与总数
 */
export function fetchLiveChatItems(since?: number): Promise<RequestResult<LiveChatItemsResponse>> {
  const params = since != null ? { since } : undefined;
  return request<LiveChatItemsResponse>({ url: "/api/live/chat-items", params });
}
