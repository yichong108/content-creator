import { getNpcAvatarFallbackText, resolveNpcAvatarUrl } from "@/lib/npc-avatar";

interface NpcAvatarProps {
  /** NPC 名称，用于 alt 与占位文字 */
  name: string;
  /** 头像 URL */
  avatarUrl?: string | null;
  /** 尺寸（像素） */
  size?: number;
}

/**
 * NPC 头像组件，支持图片与首字占位。
 */
export function NpcAvatar({ name, avatarUrl, size = 40 }: NpcAvatarProps) {
  const src = resolveNpcAvatarUrl(avatarUrl);
  const style = { width: size, height: size };

  if (!src) {
    return (
      <span className="npc-avatar npc-avatar--fallback" style={style} aria-hidden="true">
        {getNpcAvatarFallbackText(name)}
      </span>
    );
  }

  return <img className="npc-avatar" style={style} src={src} alt={`${name} 头像`} loading="lazy" />;
}
