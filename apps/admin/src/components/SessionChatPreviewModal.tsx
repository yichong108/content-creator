import { useCallback, useEffect, useRef, useState } from "react";

import { fetchLiveSession } from "@/api/live-sessions";
import {
  ChatPreviewMessageType,
  createChatPreviewDataMessage,
  getWebPreviewOrigin,
  getWebPreviewUrl,
  parseChatPreviewMessage,
} from "@/lib/chat-preview-message";
import { getRequestErrorMessage, type RequestResult } from "@/lib/request";
import type { ChatItem } from "@/types/chat-item";

interface SessionPreviewDetail {
  chat_items: ChatItem[];
}

interface SessionChatPreviewModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 待预览的会话 ID */
  sessionId: number | null;
  /** 会话标题，用于 iframe 内聊天页顶部展示 */
  sessionTitle: string;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** iframe 嵌入的 web 页路径，默认移动端首页 */
  previewPath?: string;
  /** 自定义会话详情拉取函数，缺省时使用普通会话 API */
  fetchSessionDetail?: (sessionId: number) => Promise<RequestResult<SessionPreviewDetail>>;
}

/**
 * 会话聊天记录预览弹窗。
 *
 * 通过 iframe 嵌入 web 聊天页，并在 iframe ready 后使用 postMessage 推送 chat_items。
 */
export function SessionChatPreviewModal({
  open,
  sessionId,
  sessionTitle,
  onClose,
  previewPath = "/",
  fetchSessionDetail,
}: SessionChatPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatItems, setChatItems] = useState<ChatItem[] | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const webPreviewOrigin = getWebPreviewOrigin();
  const webPreviewUrl = getWebPreviewUrl(previewPath);

  const postChatItems = useCallback(
    (items: ChatItem[], title: string) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) {
        return;
      }

      iframeWindow.postMessage(
        createChatPreviewDataMessage({
          chatItems: items,
          title,
        }),
        webPreviewOrigin,
      );
    },
    [webPreviewOrigin],
  );

  useEffect(() => {
    if (!open || sessionId == null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setChatItems(null);

    const loadDetail =
      fetchSessionDetail ??
      (async (id: number) => {
        const result = await fetchLiveSession(id);
        if (!result.ok) {
          return result;
        }
        return { ok: true as const, data: { chat_items: result.data.chat_items } };
      });

    void loadDetail(sessionId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(getRequestErrorMessage(result));
        setLoading(false);
        return;
      }

      setChatItems(result.data.chat_items);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, sessionId, fetchSessionDetail]);

  useEffect(() => {
    if (open) {
      return;
    }

    setIframeReady(false);
    setChatItems(null);
    setError(null);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== webPreviewOrigin) {
        return;
      }

      const message = parseChatPreviewMessage(event.data);
      if (message?.type === ChatPreviewMessageType.READY) {
        setIframeReady(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [open, webPreviewOrigin]);

  useEffect(() => {
    if (!open || !iframeReady || chatItems == null) {
      return;
    }

    postChatItems(chatItems, sessionTitle);
  }, [open, sessionId, iframeReady, chatItems, sessionTitle, postChatItems]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || sessionId == null) {
    return null;
  }

  const showIframeOverlay = loading || Boolean(error) || (!iframeReady && chatItems == null);

  return (
    <div className="modal-overlay modal-overlay--no-mask" role="presentation">
      <div
        className="modal-panel modal-panel--preview"
        role="dialog"
        aria-modal="false"
        aria-labelledby="session-preview-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="session-preview-title" className="modal-title">
              {sessionTitle}
            </h2>
          </div>
          <button type="button" className="modal-close" aria-label="关闭预览" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-preview-body">
          {error ? <div className="alert alert-error modal-preview-status">{error}</div> : null}
          {showIframeOverlay && !error ? (
            <div className="modal-preview-status muted">加载预览中…</div>
          ) : null}
          <iframe
            ref={iframeRef}
            className="modal-preview-iframe"
            src={webPreviewUrl}
            title={`${sessionTitle} 聊天记录预览`}
          />
        </div>
      </div>
    </div>
  );
}
