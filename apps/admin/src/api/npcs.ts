import { request, type RequestResult } from "@/lib/request";
import { NPC_PAGE_SIZE } from "@/types/npc";
import type { NpcFormPayload, NpcPageResult, NpcSummary } from "@/types/npc";

/**
 * 分页获取 NPC 列表。
 *
 * @param page - 页码，从 1 开始
 * @param pageSize - 每页记录数，默认 10
 * @returns 分页 NPC 列表
 */
export function fetchNpcs(
  page: number,
  pageSize: number = NPC_PAGE_SIZE,
): Promise<RequestResult<NpcPageResult>> {
  return request<NpcPageResult>({
    url: "/api/admin/npcs",
    method: "GET",
    params: { page, page_size: pageSize },
  });
}

/**
 * 获取全部 NPC 列表。
 *
 * 分页后列表接口只返回单页数据；此函数逐页拉取并拼装全部记录，
 * 供表单类下拉选择等需要完整 NPC 集合的场景使用。
 *
 * @returns 全部 NPC 摘要数组
 */
export async function fetchAllNpcs(): Promise<RequestResult<NpcSummary[]>> {
  const all: NpcSummary[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const result = await fetchNpcs(page, pageSize);
    if (!result.ok) {
      return result;
    }
    all.push(...result.data.items);
    if (all.length >= result.data.total) {
      break;
    }
    page += 1;
  }

  return { ok: true, data: all };
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
