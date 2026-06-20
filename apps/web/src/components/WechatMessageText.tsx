import {
  getWechatEmojiImageUrl,
  parseWechatMessageText,
  WECHAT_EMOJI_ASSET_SIZE,
} from "@/lib/wechat-emoji";

type WechatMessageTextProps = {
  /** 含 `[微笑]` 等微信表情别名的聊天正文 */
  text: string;
};

/**
 * 渲染微信聊天正文，将 `[表情名]` 转为独立 PNG 行内图标。
 *
 * 垂直对齐由 CSS `.wechat-emoji` 占位容器控制；图片绝对定位溢出绘制，不撑高气泡行高。
 */
export function WechatMessageText({ text }: WechatMessageTextProps) {
  const segments = parseWechatMessageText(text);

  if (segments.length === 0) {
    return null;
  }

  if (segments.length === 1 && segments[0]?.type === "text") {
    return <span className="wechat-message-text">{segments[0].value}</span>;
  }

  return (
    <span className="wechat-message-text">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }

        return (
          <span
            key={`emoji-${index}-${segment.value}`}
            className="wechat-emoji"
            role="img"
            aria-label={segment.emoji.name}
            title={segment.emoji.name}
          >
            <img
              className="wechat-emoji__img"
              src={getWechatEmojiImageUrl(segment.emoji.name)}
              alt=""
              width={WECHAT_EMOJI_ASSET_SIZE}
              height={WECHAT_EMOJI_ASSET_SIZE}
              loading="lazy"
              decoding="async"
              aria-hidden
            />
          </span>
        );
      })}
    </span>
  );
}
