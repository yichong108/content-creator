import { stringifyChatItems } from "@/lib/chat-items";
import type { LiveSessionFormPayload } from "@/types/live-session";
import type { ChatSessionFormValues } from "@/components/chat-session-form-types";

/**
 * 将直播会话详情转换为表单初始值。
 *
 * @param liveSession - 直播会话详情
 * @returns 表单初始值
 */
export function liveSessionToFormValues(liveSession: {
  title: string;
  description: string | null;
  chat_items: NonNullable<LiveSessionFormPayload["chat_items"]>;
  peer_npc_ids: number[];
  self_npc_id: number | null;
}): ChatSessionFormValues {
  return {
    title: liveSession.title,
    description: liveSession.description ?? "",
    chatItemsJson: stringifyChatItems(liveSession.chat_items),
    peerNpcIds: liveSession.peer_npc_ids,
    selfNpcId: liveSession.self_npc_id,
  };
}
