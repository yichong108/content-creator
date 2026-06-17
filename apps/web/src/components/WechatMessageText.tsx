import {
  getWechatEmojiRenderStyles,
  parseWechatMessageText,
  WECHAT_EMOJI_DISPLAY_SIZE,
} from "@/lib/wechat-emoji";

type WechatMessageTextProps = {
  /** 含 `[微笑]` 等微信表情别名的聊天正文 */
  text: string;
};

/**
 * 渲染微信聊天正文，将 `[表情名]` 转为雪碧图行内图标。
 *
 * 垂直对齐由 CSS `.wechat-emoji` 控制，与汉字基线协调。
 */
export function WechatMessageText({ text }: WechatMessageTextProps) {
  const segments = parseWechatMessageText(text);
  const emojiSize = WECHAT_EMOJI_DISPLAY_SIZE;

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

        const { wrapper, inner } = getWechatEmojiRenderStyles(segment.emoji.position, emojiSize);

        return (
          <span
            key={`emoji-${index}-${segment.value}`}
            className="wechat-emoji"
            role="img"
            aria-label={segment.emoji.name}
            title={segment.emoji.name}
            style={wrapper}
          >
            <span className="wechat-emoji__inner" style={inner} aria-hidden />
          </span>
        );
      })}
    </span>
  );
}
