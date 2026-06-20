import type { ChatItem, ChatItemNpcInfo } from "@/types/chat-item";
import type { NpcSummary } from "@/types/npc";
import { resolveNpcAvatarUrlForChatItem } from "@/lib/npc-avatar";

type NpcSide = "peer" | "self";

function npcMetadataFromSummary(npc: NpcSummary): ChatItemNpcInfo {
  return {
    npc_id: npc.id,
    npc_name: npc.name,
    npc_avatar_url: resolveNpcAvatarUrlForChatItem(npc.avatar_url, npc.name),
  };
}

function tagChatItemWithNpc(item: ChatItem, npc: NpcSummary): ChatItem {
  if (item.kind !== "incoming" && item.kind !== "outgoing") {
    return item;
  }

  return {
    ...item,
    ...npcMetadataFromSummary(npc),
  };
}

/**
 * 从 NPC 聊天记录中提取指定侧别的消息。
 *
 * peer 侧保留 incoming；self 侧保留 outgoing。timestamp/system 两侧均保留。
 * 若 NPC 数据仍含对侧 kind，会转换为当前侧别以兼容旧数据。
 *
 * @param items - NPC 原始聊天记录
 * @param side - peer 表示对方侧，self 表示己方
 * @param npc - 来源 NPC
 * @returns 过滤并规范化后的聊天记录
 */
function extractNpcChatItemsForSide(items: ChatItem[], side: NpcSide, npc: NpcSummary): ChatItem[] {
  const targetKind: ChatItem["kind"] = side === "peer" ? "incoming" : "outgoing";
  const alternateKind: ChatItem["kind"] = side === "peer" ? "outgoing" : "incoming";
  const extracted: ChatItem[] = [];
  const metadata = npcMetadataFromSummary(npc);

  for (const item of items) {
    if (item.kind === "timestamp" || item.kind === "system") {
      extracted.push(item);
      continue;
    }

    if (item.kind === targetKind) {
      extracted.push(tagChatItemWithNpc(item, npc));
      continue;
    }

    if (item.kind === alternateKind) {
      if (targetKind === "incoming") {
        extracted.push({ kind: "incoming", text: item.text, ...metadata });
      } else {
        extracted.push({ kind: "outgoing", text: item.text, ...metadata });
      }
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
      merged.push(...extractNpcChatItemsForSide(peerNpc.chat_items, "peer", peerNpc));
    }
  }

  if (selfNpcId != null) {
    const selfNpc = npcs.find((item) => item.id === selfNpcId);
    if (selfNpc?.chat_items?.length) {
      merged.push(...extractNpcChatItemsForSide(selfNpc.chat_items, "self", selfNpc));
    }
  }

  return merged;
}
