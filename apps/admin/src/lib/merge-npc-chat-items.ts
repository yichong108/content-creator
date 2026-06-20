import type { ChatItem } from "@/types/chat-item";
import type { NpcSummary } from "@/types/npc";

/**
 * 按 NPC ID 顺序合并多个 NPC 的聊天记录。
 *
 * @param npcs - 全部 NPC 列表
 * @param npcIds - 需要合并的 NPC ID，按选择顺序排列
 * @returns 合并后的聊天记录
 */
export function mergeNpcChatItems(npcs: NpcSummary[], npcIds: number[]): ChatItem[] {
  const merged: ChatItem[] = [];

  for (const npcId of npcIds) {
    const npc = npcs.find((item) => item.id === npcId);
    if (npc?.chat_items?.length) {
      merged.push(...npc.chat_items);
    }
  }

  return merged;
}
