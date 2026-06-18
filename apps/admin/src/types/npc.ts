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
  created_at: string;
  updated_at: string;
}

/**
 * 创建或更新 NPC 时的表单载荷。
 */
export interface NpcFormPayload {
  name: string;
  persona_description: string;
  tags: string[];
}
