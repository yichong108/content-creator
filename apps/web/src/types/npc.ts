/** NPC 列表项（与后端 NpcSummary 对齐） */
export interface NpcSummary {
  /** NPC ID */
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
