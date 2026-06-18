import { stringifyChatItems } from "@/lib/chat-items";
import type { SessionFormPayload } from "@/types/session";
import type { ChatSessionFormValues } from "@/components/chat-session-form-types";

/**
 * 将会话详情转换为表单初始值。
 *
 * @param session - 会话详情
 * @returns 表单初始值
 */
export function sessionToFormValues(session: {
  title: string;
  description: string | null;
  chat_items: SessionFormPayload["chat_items"];
}): ChatSessionFormValues {
  return {
    title: session.title,
    description: session.description ?? "",
    chatItemsJson: stringifyChatItems(session.chat_items),
  };
}
