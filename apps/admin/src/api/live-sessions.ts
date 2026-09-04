import type { ChatItem } from "@/types/chat-item";
import type {
  LiveSessionDetail,
  LiveSessionFormPayload,
  LiveSessionSummary,
} from "@/types/live-session";
import { request, type RequestResult } from "@/lib/request";

/**
 * 获取全部直播会话摘要列表。
 *
 * @returns 直播会话摘要数组
 */
export function fetchLiveSessions(): Promise<RequestResult<LiveSessionSummary[]>> {
  return request<LiveSessionSummary[]>({ url: "/api/admin/live-sessions", method: "GET" });
}

/**
 * 获取指定直播会话详情。
 *
 * @param liveSessionId - 直播会话 ID
 * @returns 直播会话详情
 */
export function fetchLiveSession(liveSessionId: number): Promise<RequestResult<LiveSessionDetail>> {
  return request<LiveSessionDetail>({
    url: `/api/admin/live-sessions/${liveSessionId}`,
    method: "GET",
  });
}

/**
 * 创建新直播会话。
 *
 * @param payload - 直播会话表单数据
 * @returns 新建直播会话详情
 */
export function createLiveSession(
  payload: LiveSessionFormPayload,
): Promise<RequestResult<LiveSessionDetail>> {
  return request<LiveSessionDetail>({
    url: "/api/admin/live-sessions",
    method: "POST",
    data: payload,
  });
}

/**
 * 更新指定直播会话。
 *
 * @param liveSessionId - 直播会话 ID
 * @param payload - 直播会话表单数据
 * @returns 更新后直播会话详情
 */
export function updateLiveSession(
  liveSessionId: number,
  payload: LiveSessionFormPayload,
): Promise<RequestResult<LiveSessionDetail>> {
  return request<LiveSessionDetail>({
    url: `/api/admin/live-sessions/${liveSessionId}`,
    method: "PUT",
    data: payload,
  });
}

/**
 * 删除指定直播会话。
 *
 * @param liveSessionId - 直播会话 ID
 * @returns 空数据成功响应
 */
export function deleteLiveSession(liveSessionId: number): Promise<RequestResult<null>> {
  return request<null>({
    url: `/api/admin/live-sessions/${liveSessionId}`,
    method: "DELETE",
  });
}

/**
 * 更新直播会话展示开关。
 *
 * @param liveSessionId - 直播会话 ID
 * @param enabled - 是否开启直播展示
 * @returns 更新后的直播会话摘要
 */
export function updateLiveSessionEnabled(
  liveSessionId: number,
  enabled: boolean,
): Promise<RequestResult<LiveSessionSummary>> {
  return request<LiveSessionSummary>({
    url: `/api/admin/live-sessions/${liveSessionId}/enabled`,
    method: "PATCH",
    data: { enabled },
  });
}

/**
 * 更新直播会话移动端展示开关。
 *
 * @param liveSessionId - 直播会话 ID
 * @param mobileEnabled - 是否开启移动端展示
 * @returns 更新后的直播会话摘要
 */
export function updateLiveSessionMobileEnabled(
  liveSessionId: number,
  mobileEnabled: boolean,
): Promise<RequestResult<LiveSessionSummary>> {
  return request<LiveSessionSummary>({
    url: `/api/admin/live-sessions/${liveSessionId}/mobile-enabled`,
    method: "PATCH",
    data: { mobile_enabled: mobileEnabled },
  });
}

/**
 * 更新直播会话运行状态（开始/停止实时续写）。
 *
 * @param liveSessionId - 直播会话 ID
 * @param running - 是否开始运行
 * @returns 更新后的直播会话摘要
 */
export function updateLiveSessionRunning(
  liveSessionId: number,
  running: boolean,
): Promise<RequestResult<LiveSessionSummary>> {
  return request<LiveSessionSummary>({
    url: `/api/admin/live-sessions/${liveSessionId}/running`,
    method: "PATCH",
    data: { running },
  });
}

/**
 * 根据可选描述自动生成直播会话标题；未提供描述时随机生成。
 *
 * @param payload - 可选描述
 * @returns 生成的直播会话标题
 */
export function generateLiveSessionTitle(payload: {
  description?: string | null;
}): Promise<RequestResult<{ title: string }>> {
  return request<{ title: string }>({
    url: "/api/admin/live-sessions/generate-title",
    method: "POST",
    data: payload,
  });
}

/**
 * 根据标题与 NPC 人设自动生成直播聊天记录 JSON。
 *
 * @param payload - 标题、描述与关联 NPC ID
 * @returns 生成的聊天记录数组
 */
export function generateLiveChatItems(payload: {
  title: string;
  description?: string | null;
  peer_npc_ids: number[];
  self_npc_id: number | null;
}): Promise<RequestResult<{ chat_items: ChatItem[] }>> {
  return request<{ chat_items: ChatItem[] }>({
    url: "/api/admin/live-sessions/generate-chat-items",
    method: "POST",
    data: payload,
  });
}
