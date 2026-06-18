import { CHAT_ITEM_KINDS, type ChatItem, type ChatItemKind } from "@wechat-bot/chat-item";

export type ParseChatItemsResult = { ok: true; data: ChatItem[] } | { ok: false; message: string };

/**
 * 解析并校验聊天记录 JSON 文本。
 *
 * @param raw - 用户输入的 JSON 字符串
 * @returns 校验通过时返回 ChatItem 数组，否则返回错误信息
 */
export function parseChatItemsJson(raw: string): ParseChatItemsResult {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return { ok: false, message: "聊天记录必须是 JSON 数组" };
    }

    const items: ChatItem[] = [];

    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];

      if (!item || typeof item !== "object") {
        return { ok: false, message: `第 ${index + 1} 条记录格式无效` };
      }

      const kind = (item as { kind?: unknown }).kind;
      const text = (item as { text?: unknown }).text;

      if (typeof kind !== "string" || !CHAT_ITEM_KINDS.includes(kind as ChatItemKind)) {
        return {
          ok: false,
          message: `第 ${index + 1} 条 kind 无效，应为 timestamp/system/incoming/outgoing`,
        };
      }

      if (typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, message: `第 ${index + 1} 条 text 不能为空` };
      }

      items.push({ kind: kind as ChatItemKind, text });
    }

    return { ok: true, data: items };
  } catch {
    return { ok: false, message: "JSON 格式无效，请检查语法" };
  }
}

/**
 * 将聊天记录格式化为可编辑的 JSON 文本。
 *
 * @param items - 聊天记录数组
 * @returns 缩进后的 JSON 字符串
 */
export function stringifyChatItems(items: ChatItem[]): string {
  return JSON.stringify(items, null, 2);
}
