const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 将 NPC 头像 URL 解析为浏览器可加载的完整地址。
 *
 * @param avatarUrl - 后端返回的头像 URL（绝对或相对路径）
 * @returns 完整 URL；未设置时返回 null
 */
export function resolveNpcAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) {
    return null;
  }

  if (/^(https?:|blob:|data:)/i.test(avatarUrl)) {
    return avatarUrl;
  }

  const normalizedPath = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
  return `${API_URL}${normalizedPath}`;
}

/**
 * 解析写入聊天记录的 NPC 头像 URL。
 *
 * 未设置自定义头像时，使用与后端一致的 DiceBear 默认头像。
 *
 * @param avatarUrl - NPC 头像 URL
 * @param name - NPC 名称
 * @returns 可用于 chat_item.npc_avatar_url 的 URL
 */
export function resolveNpcAvatarUrlForChatItem(
  avatarUrl: string | null | undefined,
  name: string,
): string {
  if (avatarUrl && avatarUrl.trim().length > 0) {
    return avatarUrl.trim();
  }

  const seed = encodeURIComponent(name.trim() || "NPC");
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
}

/**
 * 获取 NPC 名称的首字，用于无头像时的占位展示。
 *
 * @param name - NPC 名称
 * @returns 单个展示字符
 */
export function getNpcAvatarFallbackText(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  return trimmed.slice(0, 1);
}
