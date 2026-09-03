/**
 * NPC 列表项。
 */
export interface NpcSummary {
  id: number;
  /** NPC 名称 */
  name: string;
  /** 人设描述 */
  persona_description: string;
  /** 标签列表 */
  tags: string[];
  /** 头像 URL */
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * NPC 创建或更新时的表单载荷。
 */
export interface NpcFormPayload {
  name: string;
  persona_description: string;
  tags: string[];
  avatar_url?: string | null;
}

/** NPC 表单提交时的附加选项。 */
export interface NpcFormOptions {
  /** 待上传的头像文件 */
  avatarFile?: File | null;
}

/** NPC 列表默认每页记录数。 */
export const NPC_PAGE_SIZE = 10;

/** 后端分页返回的 NPC 列表。 */
export interface NpcPageResult {
  items: NpcSummary[];
  total: number;
  page: number;
  page_size: number;
}
