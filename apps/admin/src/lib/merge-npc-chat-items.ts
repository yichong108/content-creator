import type { ChatItem } from "@/types/chat-item";
import type { NpcSummary } from "@/types/npc";

type NpcSide = "peer" | "self";

/**
 * 从 NPC 聊天记录中提取指定侧别的消息。
 *
 * peer 侧保留 incoming；self 侧保留 outgoing。timestamp/system 两侧均保留。
 * 若 NPC 数据仍含对侧 kind，会转换为当前侧别以兼容旧数据。
 *
 * @param items - NPC 原始聊天记录
 * @param side - peer 表示对方侧，self 表示己方
 * @returns 过滤并规范化后的聊天记录
 */
function extractNpcChatItemsForSide(items: ChatItem[], side: NpcSide): ChatItem[] {
  const targetKind: ChatItem["kind"] = side === "peer" ? "incoming" : "outgoing";
  const alternateKind: ChatItem["kind"] = side === "peer" ? "outgoing" : "incoming";
  const extracted: ChatItem[] = [];

  for (const item of items) {
    if (item.kind === "timestamp" || item.kind === "system") {
      extracted.push(item);
      continue;
    }

    if (item.kind === targetKind) {
      extracted.push(item);
      continue;
    }

    if (item.kind === alternateKind) {
      extracted.push({ kind: targetKind, text: item.text });
    }
  }

  return extracted;
}

/**
 * 按对方/己方 NPC 合并聊天记录。
 *
 * @param npcs - 全部 NPC 列表
 * @param peerNpcIds - 对方 NPC ID 列表，按选择顺序排列
 * @param selfNpcId - 己方 NPC ID，可为空
 * @returns 合并后的聊天记录（先各对方 NPC，后己方 NPC）
 */
export function mergeNpcChatItems(
  npcs: NpcSummary[],
  peerNpcIds: number[],
  selfNpcId: number | null,
): ChatItem[] {
  const merged: ChatItem[] = [];

  for (const peerNpcId of peerNpcIds) {
    const peerNpc = npcs.find((item) => item.id === peerNpcId);
    if (peerNpc?.chat_items?.length) {
      merged.push(...extractNpcChatItemsForSide(peerNpc.chat_items, "peer"));
    }
  }

  if (selfNpcId != null) {
    const selfNpc = npcs.find((item) => item.id === selfNpcId);
    if (selfNpc?.chat_items?.length) {
      merged.push(...extractNpcChatItemsForSide(selfNpc.chat_items, "self"));
    }
  }

  return merged;
}
