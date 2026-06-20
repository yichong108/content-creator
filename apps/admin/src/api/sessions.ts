import type { ChatItem } from "@/types/chat-item";
import type { SessionDetail, SessionFormPayload, SessionSummary } from "@/types/session";
import { request, type RequestResult } from "@/lib/request";

/**
 * 获取全部会话摘要列表。
 *
 * @returns 会话摘要数组
 */
export function fetchSessions(): Promise<RequestResult<SessionSummary[]>> {
  return request<SessionSummary[]>({ url: "/api/admin/sessions", method: "GET" });
}

/**
 * 获取指定会话详情。
 *
 * @param sessionId - 会话 ID
 * @returns 会话详情
 */
export function fetchSession(sessionId: number): Promise<RequestResult<SessionDetail>> {
  return request<SessionDetail>({ url: `/api/admin/sessions/${sessionId}`, method: "GET" });
}

/**
 * 创建新会话。
 *
 * @param payload - 会话表单数据
 * @returns 新建会话详情
 */
export function createSession(payload: SessionFormPayload): Promise<RequestResult<SessionDetail>> {
  return request<SessionDetail>({
    url: "/api/admin/sessions",
    method: "POST",
    data: payload,
  });
}

/**
 * 更新指定会话。
 *
 * @param sessionId - 会话 ID
 * @param payload - 会话表单数据
 * @returns 更新后会话详情
 */
export function updateSession(
  sessionId: number,
  payload: SessionFormPayload,
): Promise<RequestResult<SessionDetail>> {
  return request<SessionDetail>({
    url: `/api/admin/sessions/${sessionId}`,
    method: "PUT",
    data: payload,
  });
}

/**
 * 删除指定会话。
 *
 * @param sessionId - 会话 ID
 * @returns 空数据成功响应
 */
export function deleteSession(sessionId: number): Promise<RequestResult<null>> {
  return request<null>({
    url: `/api/admin/sessions/${sessionId}`,
    method: "DELETE",
  });
}

/**
 * 更新会话移动端展示开关。
 *
 * @param sessionId - 会话 ID
 * @param mobileEnabled - 是否开启移动端展示
 * @returns 更新后的会话摘要
 */
export function updateSessionMobileEnabled(
  sessionId: number,
  mobileEnabled: boolean,
): Promise<RequestResult<SessionSummary>> {
  return request<SessionSummary>({
    url: `/api/admin/sessions/${sessionId}/mobile-enabled`,
    method: "PATCH",
    data: { mobile_enabled: mobileEnabled },
  });
}

/**
 * 根据描述或聊天记录自动生成会话标题。
 *
 * @param payload - 可选描述与聊天记录，用于提炼标题
 * @returns 生成的会话标题
 */
export function generateSessionTitle(payload: {
  description?: string | null;
  chat_items?: ChatItem[];
}): Promise<RequestResult<{ title: string }>> {
  return request<{ title: string }>({
    url: "/api/admin/sessions/generate-title",
    method: "POST",
    data: payload,
  });
}

/**
 * 根据标题与 NPC 人设自动生成聊天记录 JSON。
 *
 * @param payload - 标题、描述与关联 NPC ID
 * @returns 生成的聊天记录数组
 */
export function generateChatItems(payload: {
  title: string;
  description?: string | null;
  peer_npc_ids: number[];
  self_npc_id: number | null;
}): Promise<RequestResult<{ chat_items: ChatItem[] }>> {
  return request<{ chat_items: ChatItem[] }>({
    url: "/api/admin/sessions/generate-chat-items",
    method: "POST",
    data: payload,
  });
}
