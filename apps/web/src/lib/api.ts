import type { ChatItem } from "@/data/chat-items";
import { request, type RequestResult } from "@/lib/request";
import type { MobileSessionSummary } from "@/types/mobile-session";
import type { NpcSummary } from "@/types/npc";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** 增量拉取直播聊天记录的响应 */
export interface LiveChatItemsResponse {
  items: ChatItem[];
  total: number;
}

/** WebSocket message 事件载荷 */
export interface LiveWsMessagePayload {
  live_session_id: number;
  item: ChatItem;
  total: number;
  index: number;
}

/** WebSocket typing 事件载荷 */
export interface LiveWsTypingPayload {
  live_session_id: number;
  typing: boolean;
  /** incoming = 非己方（对方侧），outgoing = 己方 */
  speaker: "incoming" | "outgoing";
}

/** WebSocket 下行帧 */
export interface LiveWsFrame<T = unknown> {
  event: string;
  data: T;
}

/**
 * 获取直播 WebSocket 地址。
 *
 * @returns ``/api/live/ws`` 完整 ws/wss URL
 */
export function getLiveWebSocketUrl(): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/live/ws";
  return url.toString();
}

/**
 * 从后端 API 获取移动端会话列表。
 *
 * @returns 业务 data 为 MobileSessionSummary 数组
 */
export function fetchMobileSessions(): Promise<RequestResult<MobileSessionSummary[]>> {
  return request<MobileSessionSummary[]>({ url: "/api/mobile-sessions" });
}

/**
 * 从后端 API 获取聊天列表数据（默认返回移动端已开启的直播会话）。
 *
 * @param liveSessionId - 可选直播会话 ID
 * @returns 业务 data 为 ChatItem 数组
 */
export function fetchChatItems(liveSessionId?: number): Promise<RequestResult<ChatItem[]>> {
  const params = liveSessionId != null ? { live_session_id: liveSessionId } : undefined;
  return request<ChatItem[]>({ url: "/api/chat-items", params });
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

/** 创建直播会话的请求体 */
export interface CreateLiveSessionPayload {
  title: string;
  description?: string | null;
  peer_npc_ids: number[];
  self_npc_id: number | null;
  chat_items?: ChatItem[];
}

/** 创建直播会话的响应（详情） */
export interface LiveSessionDetail {
  id: number;
  title: string;
}

/**
 * 获取全部 NPC 列表，供发起会话页选择对方/己方。
 *
 * @returns 业务 data 为 NpcSummary 数组
 */
export function fetchNpcs(): Promise<RequestResult<NpcSummary[]>> {
  return request<NpcSummary[]>({ url: "/api/admin/npcs", method: "GET" });
}

/**
 * 创建新直播会话。
 *
 * @param payload - 会话标题、对方/己方 NPC 等
 * @returns 业务 data 为新建会话详情
 */
export function createLiveSession(
  payload: CreateLiveSessionPayload,
): Promise<RequestResult<LiveSessionDetail>> {
  return request<LiveSessionDetail>({
    url: "/api/admin/live-sessions",
    method: "POST",
    data: payload,
  });
}
