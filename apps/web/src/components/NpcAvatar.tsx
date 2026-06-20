import { getNpcAvatarFallbackText, resolveNpcAvatarUrl } from "@/lib/npc-avatar";

export type NpcAvatarProps = {
  /** NPC 名称，用于 alt 与占位文字 */
  name: string;
  /** 头像 URL */
  avatarUrl?: string | null;
  /** 尺寸（像素） */
  size?: number;
};

/**
 * NPC 头像组件，支持图片与首字占位。
 */
export function NpcAvatar({ name, avatarUrl, size = 40 }: NpcAvatarProps) {
  const src = resolveNpcAvatarUrl(avatarUrl);

  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-[4px] bg-[#d8d8d8] text-[15px] text-[var(--wechat-text-secondary)]"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {getNpcAvatarFallbackText(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} 头像`}
      width={size}
      height={size}
      className="shrink-0 rounded-[4px] object-cover"
      style={{ width: size, height: size }}
    />
  );
}
