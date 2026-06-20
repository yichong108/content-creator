const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 将 chat_item 中的 NPC 头像 URL 解析为浏览器可加载的完整地址。
 *
 * @param avatarUrl - chat_item.npc_avatar_url
 * @returns 完整 URL
 */
export function resolveChatItemAvatarUrl(avatarUrl: string): string {
  if (/^(https?:|blob:|data:)/i.test(avatarUrl)) {
    return avatarUrl;
  }

  const normalizedPath = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
  return `${API_URL}${normalizedPath}`;
}
