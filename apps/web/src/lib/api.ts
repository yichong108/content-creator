import type { ChatItem } from "@/data/chat-items";
import { request, type RequestResult } from "@/lib/request";
import type { MobileSessionSummary } from "@/types/mobile-session";
import type { NpcSummary } from "@/types/npc";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** 增量拉取直播聊天记录的响应 */
export interface LiveChatItemsResponse {
  items: ChatItem[];
  total: number;
  /** 会话标题 */
  title: string;
  /** 参与会话的 NPC 数量（对方 + 己方） */
  npc_count: number;
  /** 是否正在实时续写 */
  running: boolean;
}

/** 更新直播会话运行状态后的摘要 */
export interface LiveSessionRunningSummary {
  id: number;
  running: boolean;
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
 * @param sessionId - 可选会话 ID
 * @returns 业务 data 为 ChatItem 数组
 */
export function fetchChatItems(sessionId?: number): Promise<RequestResult<ChatItem[]>> {
  const params = sessionId != null ? { live_session_id: sessionId } : undefined;
  return request<ChatItem[]>({ url: "/api/chat-items", params });
}

/**
 * 从后端 API 获取直播页聊天列表数据（默认返回直播端已开启的会话）。
 *
 * @param sessionId - 可选会话 ID
 * @param since - 已有消息条数，传入时仅返回增量消息
 * @returns 业务 data 为聊天记录与总数
 */
export function fetchLiveChatItems(
  sessionId?: number,
  since?: number,
): Promise<RequestResult<LiveChatItemsResponse>> {
  const params: Record<string, number> = {};
  if (sessionId != null) {
    params.live_session_id = sessionId;
  }
  if (since != null) {
    params.since = since;
  }
  return request<LiveChatItemsResponse>({
    url: "/api/live/chat-items",
    params: Object.keys(params).length > 0 ? params : undefined,
  });
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
  return request<NpcSummary[]>({ url: "/api/mobile/npcs", method: "GET" });
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
    url: "/api/mobile/live-sessions",
    method: "POST",
    data: payload,
  });
}

/**
 * 更新直播会话运行状态（开始/停止实时续写）。
 *
 * @param liveSessionId - 直播会话 ID
 * @param running - 是否开始运行
 * @returns 业务 data 为更新后的会话摘要（含 running）
 */
export function updateLiveSessionRunning(
  liveSessionId: number,
  running: boolean,
): Promise<RequestResult<LiveSessionRunningSummary>> {
  return request<LiveSessionRunningSummary>({
    url: `/api/admin/live-sessions/${liveSessionId}/running`,
    method: "PATCH",
    data: { running },
  });
}

// ---------------------------------------------------------------------------
// 客户聊天（AI 客服）
// ---------------------------------------------------------------------------

/** 单条客户聊天消息（后端 CustomerChatMessage 的前端投影） */
export interface CustomerChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** 客户聊天历史加载响应 */
export interface CustomerChatHistoryResponse {
  messages: CustomerChatMessage[];
  has_more: boolean;
  /** 下一页游标（最早一条的 id），has_more=true 时返回 */
  next_cursor: number | null;
}

/** RAG 参考来源片段 */
export interface RagSource {
  document_id: number;
  filename: string;
  score: number | null;
  snippet: string;
}

/** 客户发送消息响应 */
export interface CustomerChatSendResponse {
  message: CustomerChatMessage;
  sources: RagSource[];
}

/**
 * 加载客户聊天历史（游标式向上翻页）。
 *
 * 首次加载不传 beforeId，返回最新 N 条；
 * 向上滚动到顶部时传入 beforeId（= 当前最早消息的 id），继续加载更早的记录。
 *
 * @param sessionId - 客户会话标识（前端生成的 UUID）
 * @param beforeId - 翻页游标，首次加载不传
 * @param limit - 单次加载条数，默认 20
 */
export function fetchCustomerChatHistory(
  sessionId: string,
  beforeId?: number,
  limit = 20,
): Promise<RequestResult<CustomerChatHistoryResponse>> {
  const params: Record<string, string | number> = { session_id: sessionId, limit };
  if (beforeId != null) {
    params.before_id = beforeId;
  }
  return request<CustomerChatHistoryResponse>({
    url: "/api/mobile/customer-chat/history",
    method: "GET",
    params,
  });
}

/**
 * 发送客户消息，经 RAG + Agent 后返回 AI 客服回复。
 *
 * @param sessionId - 客户会话标识
 * @param message - 客户输入的消息正文
 */
export function sendCustomerChatMessage(
  sessionId: string,
  message: string,
): Promise<RequestResult<CustomerChatSendResponse>> {
  return request<CustomerChatSendResponse>({
    url: "/api/mobile/customer-chat/send",
    method: "POST",
    data: { session_id: sessionId, message },
  });
}
