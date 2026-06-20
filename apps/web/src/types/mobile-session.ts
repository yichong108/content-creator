/** 移动端会话列表项 */
export interface MobileSessionSummary {
  /** 直播会话 ID */
  id: number;
  /** 会话标题，通常为对方昵称 */
  title: string;
  /** 最近一条消息预览 */
  last_message: string | null;
  /** 对方头像 URL */
  peer_avatar_url: string | null;
  /** 最近更新时间（ISO 8601） */
  updated_at: string;
  /** 是否正在实时续写聊天记录 */
  running: boolean;
}
