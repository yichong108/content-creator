import type { NpcFormPayload, NpcSummary } from "@/types/npc";
import { request, type RequestResult } from "@/lib/request";

/**
 * 获取全部 NPC 列表。
 *
 * @returns NPC 摘要数组
 */
export function fetchNpcs(): Promise<RequestResult<NpcSummary[]>> {
  return request<NpcSummary[]>({ url: "/api/admin/npcs", method: "GET" });
}

/**
 * 获取指定 NPC 详情。
 *
 * @param npcId - NPC ID
 * @returns NPC 详情
 */
export function fetchNpc(npcId: number): Promise<RequestResult<NpcSummary>> {
  return request<NpcSummary>({ url: `/api/admin/npcs/${npcId}`, method: "GET" });
}

/**
 * 创建新 NPC。
 *
 * @param payload - NPC 表单数据
 * @returns 新建 NPC
 */
export function createNpc(payload: NpcFormPayload): Promise<RequestResult<NpcSummary>> {
  return request<NpcSummary>({
    url: "/api/admin/npcs",
    method: "POST",
    data: payload,
  });
}

/**
 * 更新指定 NPC。
 *
 * @param npcId - NPC ID
 * @param payload - NPC 表单数据
 * @returns 更新后 NPC
 */
export function updateNpc(
  npcId: number,
  payload: NpcFormPayload,
): Promise<RequestResult<NpcSummary>> {
  return request<NpcSummary>({
    url: `/api/admin/npcs/${npcId}`,
    method: "PUT",
    data: payload,
  });
}

/**
 * 删除指定 NPC。
 *
 * @param npcId - NPC ID
 * @returns 空数据成功响应
 */
export function deleteNpc(npcId: number): Promise<RequestResult<null>> {
  return request<null>({
    url: `/api/admin/npcs/${npcId}`,
    method: "DELETE",
  });
}

/**
 * 上传 NPC 头像文件。
 *
 * @param npcId - NPC ID
 * @param file - 头像图片文件
 * @returns 更新后的 NPC
 */
export function uploadNpcAvatar(npcId: number, file: File): Promise<RequestResult<NpcSummary>> {
  const formData = new FormData();
  formData.append("file", file);

  return request<NpcSummary>({
    url: `/api/admin/npcs/${npcId}/avatar`,
    method: "POST",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}
