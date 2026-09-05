import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { WechatChatMessageList } from "@/components/WechatChatMessageList";
import type { ChatItem } from "@/data/chat-items";
import {
  fetchCustomerChatHistory,
  sendCustomerChatMessage,
  type CustomerChatMessage,
} from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

/** localStorage 中存储客户会话 ID 的 key */
const SESSION_ID_STORAGE_KEY = "customer-chat-session-id";

/**
 * 预设快捷测试场景标签。
 *
 * 覆盖四类典型测试场景：
 * - RAG 命中：问题应该能在知识库里找到答案
 * - RAG 未命中：知识库没有相关资料，应诚实告知用户
 * - 多轮追问：依赖上下文的追问，验证 agent 能否记住之前的对话
 * - 边界场景：超出服务范围或敏感问题
 *
 * 注意：以下问题为通用占位示例，实际使用前应替换为你 RAG 知识库中
 * 真实文档覆盖的业务问题，才能有效验证命中效果。
 */
const QUICK_QUESTIONS: { label: string; text: string }[] = [
  { label: "👋 你好", text: "你好，请问你能帮我做什么？" },
  { label: "📦 如何退款", text: "如果我不满意，怎么申请退款？" },
  { label: "🚚 发货多久到", text: "一般下单后多久能收到货？" },
  { label: "💰 价格多少", text: "你们的产品价格是怎么定的？" },
  { label: "🔧 使用教程", text: "能给我一个使用教程吗？" },
  { label: "⚠️ 超范围问题", text: "帮我订一张明天去北京的机票" },
  { label: "🤔 多轮追问", text: "你刚才说的那个能再详细解释一下吗？" },
];

/** AI 客服侧的 NPC 固定信息（incoming 消息） */
const ASSISTANT_INFO = {
  npc_id: 1,
  npc_name: "客服小助手",
  npc_avatar_url: "/avatar-other.png",
} as const;

/** 用户自身侧的 NPC 固定信息（outgoing 消息） */
const SELF_INFO = {
  npc_id: 0,
  npc_name: "我",
  npc_avatar_url: "/avatar-self.png",
} as const;

/** 将后端 CustomerChatMessage 转为前端 ChatItem */
function toChatItem(msg: CustomerChatMessage): ChatItem {
  if (msg.role === "assistant") {
    return { kind: "incoming", text: msg.content, ...ASSISTANT_INFO };
  }
  return { kind: "outgoing", text: msg.content, ...SELF_INFO };
}

/** 生成/恢复客户会话 ID */
function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_ID_STORAGE_KEY, id);
  return id;
}

/** 清空当前会话（清除 localStorage，生成新 session_id，重置消息列表） */
function clearSessionId() {
  localStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

/**
 * 客服聊天页 —— 对接后端 AI 客服 API。
 *
 * 功能：
 * - 首次进入自动生成 session_id 并持久化到 localStorage
 * - 页面加载时拉取历史消息（最新 20 条）
 * - 向上滚动到顶部时触发加载更早历史（游标式分页）
 * - 发送消息 → RAG → Agent 回复 → 持久化 → 追加到列表
 */
export function CustomerServicePage() {
  const navigate = useNavigate();

  /** 客户会话标识（首次进入时生成，之后从 localStorage 读取） */
  const [sessionId, setSessionId] = useState<string>(() => getOrCreateSessionId());

  /** 已渲染的聊天消息列表 */
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);

  /** 是否仍有更早的历史消息可加载 */
  const [hasMore, setHasMore] = useState(false);
  /** 下次加载更早历史的游标（最早一条消息的 id） */
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  /** 历史加载中 / 发送消息中 / 错误 */
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 输入框草稿 */
  const [draft, setDraft] = useState("");

  /**
   * 加载历史消息。
   *
   * @param beforeId - 游标，null 表示首次加载最新页
   * @param prepend - 是否前置到现有列表（true=向上翻页，false=首次加载/刷新）
   */
  const loadHistory = useCallback(
    async (beforeId: number | null, prepend: boolean) => {
      setLoadingHistory(true);
      const result = await fetchCustomerChatHistory(sessionId, beforeId ?? undefined);
      setLoadingHistory(false);

      if (!result.ok) {
        setError(getRequestErrorMessage(result));
        return;
      }

      const items = result.data.messages.map(toChatItem);

      if (prepend) {
        setChatItems((prev) => [...items, ...prev]);
      } else {
        setChatItems(items);
      }

      setHasMore(result.data.has_more);
      setNextCursor(result.data.next_cursor);
      setError(null);
    },
    [sessionId],
  );

  /** 首次进入：拉取最新历史 */
  useEffect(() => {
    loadHistory(null, false);
  }, [loadHistory]);

  /**
   * 滚动到顶部回调：触发向上翻页加载更早历史。
   * 仅当 hasMore=true 且不在加载中时才发起请求。
   */
  const handleReachTop = useCallback(() => {
    if (loadingHistory || !hasMore || nextCursor == null) {
      return;
    }
    loadHistory(nextCursor, true);
  }, [loadingHistory, hasMore, nextCursor, loadHistory]);

  /**
   * 发送客户消息。
   *
   * 乐观更新：先把用户消息追加到列表，再请求后端。
   * 后端返回后，AI 回复追加到列表；失败时保留用户消息并显示错误提示。
   */
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || loadingHistory) {
      return;
    }

    setSending(true);
    setError(null);

    // 乐观追加用户消息
    const optimisticUserItem: ChatItem = {
      kind: "outgoing",
      text,
      ...SELF_INFO,
    };
    setChatItems((prev) => [...prev, optimisticUserItem]);

    const result = await sendCustomerChatMessage(sessionId, text);

    if (!result.ok) {
      setSending(false);
      setError(getRequestErrorMessage(result));
      return;
    }

    // 把 AI 回复追加到列表
    const assistantItem = toChatItem(result.data.message);
    setChatItems((prev) => {
      // 去掉我们乐观追加的那条，避免 AI 回复后看起来重复
      const filtered = prev.filter((item, idx) => {
        // 乐观消息没有 id 标识，用 kind+text+位置判断
        if (idx === prev.length - 1 && item.kind === "outgoing" && item.text === text) {
          return false;
        }
        return true;
      });
      return [...filtered, assistantItem];
    });

    setSending(false);
    setDraft("");
  }, [draft, sending, loadingHistory, sessionId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend();
  };

  /** 新建会话：清除 session_id 并重新加载 */
  const handleNewSession = () => {
    clearSessionId();
    const newId = getOrCreateSessionId();
    setSessionId(newId);
    setChatItems([]);
    setHasMore(false);
    setNextCursor(null);
    setError(null);
    loadHistory(null, false);
  };

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b-[0.5px] border-black/[0.05] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="-ml-1 flex h-8 w-8 items-center justify-center"
          aria-label="返回"
          onClick={() => navigate("/")}
        >
          <img
            src="/back-arrow.png"
            alt=""
            width={10}
            height={18}
            className="block h-[18px] w-auto"
            aria-hidden
          />
        </button>
        <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">客服</h1>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[12px] text-[#576b95] active:bg-black/5"
          onClick={handleNewSession}
          disabled={sending}
          title="新建会话"
        >
          新会话
        </button>
      </header>

      <WechatChatMessageList
        chatItems={chatItems}
        loading={loadingHistory}
        error={error}
        peerTyping={sending}
        avatarVariant="circle"
        onReachTop={handleReachTop}
      />

      <footer className="shrink-0 border-t-[0.5px] border-black/[0.05] bg-[var(--wechat-composer-bg)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* 快捷测试场景标签 —— 点击即把问题填入输入框，方便快速验证 RAG + Agent 回复效果 */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={sending}
              onClick={() => setDraft(q.text)}
              className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[12px] leading-[1.4] text-[var(--wechat-text-secondary)] active:bg-black/[0.04] disabled:opacity-40"
              title={q.text}
            >
              {q.label}
            </button>
          ))}
        </div>

        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={sending ? "客服正在回复…" : "输入消息"}
            className="min-h-[36px] flex-1 rounded-[4px] border border-[var(--wechat-input-border)] bg-[var(--wechat-surface)] px-3 py-2 text-[16px] leading-[1.4] text-[var(--wechat-text)] outline-none focus:border-[#07c160]"
            autoComplete="off"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending || loadingHistory}
            className="shrink-0 rounded-[4px] bg-[#07c160] px-4 py-2 text-[15px] font-medium text-white active:bg-[#06ad56] disabled:opacity-40"
          >
            发送
          </button>
        </form>
      </footer>
    </main>
  );
}
