import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatDateTime } from "@/lib/format";
import { useLiveSessionStore } from "@/stores/live-session-store";

const kindLabel: Record<string, string> = {
  timestamp: "时间",
  system: "系统",
  incoming: "对方",
  outgoing: "本人",
};

/**
 * 直播会话详情页，展示元信息与聊天记录 JSON 预览。
 */
export function LiveSessionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const liveSessionId = Number(id);
  const currentLiveSession = useLiveSessionStore((state) => state.currentLiveSession);
  const detailLoading = useLiveSessionStore((state) => state.detailLoading);
  const submitting = useLiveSessionStore((state) => state.submitting);
  const error = useLiveSessionStore((state) => state.error);
  const loadLiveSession = useLiveSessionStore((state) => state.loadLiveSession);
  const deleteLiveSession = useLiveSessionStore((state) => state.deleteLiveSession);
  const clearCurrentLiveSession = useLiveSessionStore((state) => state.clearCurrentLiveSession);
  const [jsonCopied, setJsonCopied] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(liveSessionId) || liveSessionId <= 0) {
      return;
    }

    void loadLiveSession(liveSessionId);

    return () => {
      clearCurrentLiveSession();
    };
  }, [liveSessionId, loadLiveSession, clearCurrentLiveSession]);

  const handleDelete = async () => {
    if (!currentLiveSession) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除直播会话「${currentLiveSession.title}」吗？此操作不可恢复。`,
    );
    if (!confirmed) {
      return;
    }

    const deleted = await deleteLiveSession(liveSessionId);
    if (deleted) {
      navigate("/live-sessions");
    }
  };

  const handleCopyJson = async (jsonText: string) => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      window.alert("复制失败，请手动选择 JSON 内容后复制");
    }
  };

  if (!Number.isFinite(liveSessionId) || liveSessionId <= 0) {
    return (
      <section className="page">
        <div className="alert alert-error">无效的直播会话 ID</div>
        <Link className="link" to="/live-sessions">
          返回列表
        </Link>
      </section>
    );
  }

  const chatItemsJson =
    currentLiveSession != null ? JSON.stringify(currentLiveSession.chat_items, null, 2) : "";

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <Link className="breadcrumb" to="/live-sessions">
            ← 返回列表
          </Link>
          <h1>{currentLiveSession?.title ?? "直播会话详情"}</h1>
          {currentLiveSession?.description ? (
            <p className="page-desc">{currentLiveSession.description}</p>
          ) : null}
        </div>
        {currentLiveSession ? (
          <div className="page-actions">
            <Link className="btn btn-secondary" to={`/live-sessions/${liveSessionId}/edit`}>
              编辑
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              disabled={submitting}
              onClick={() => void handleDelete()}
            >
              删除
            </button>
          </div>
        ) : null}
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {detailLoading ? (
        <p className="muted">加载中…</p>
      ) : currentLiveSession ? (
        <>
          <div className="meta-grid card">
            <div>
              <span className="meta-label">ID</span>
              <span>{currentLiveSession.id}</span>
            </div>
            <div>
              <span className="meta-label">消息数</span>
              <span>{currentLiveSession.chat_item_count}</span>
            </div>
            <div>
              <span className="meta-label">直播展示</span>
              <span>{currentLiveSession.enabled ? "已开启" : "未开启"}</span>
            </div>
            <div>
              <span className="meta-label">创建时间</span>
              <span>{formatDateTime(currentLiveSession.created_at)}</span>
            </div>
            <div>
              <span className="meta-label">更新时间</span>
              <span>{formatDateTime(currentLiveSession.updated_at)}</span>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">聊天记录预览</h2>
            <div className="chat-preview">
              {currentLiveSession.chat_items.length === 0 ? (
                <p className="muted">暂无聊天记录</p>
              ) : (
                currentLiveSession.chat_items.map((item, index) => (
                  <div key={`${item.kind}-${index}`} className={`chat-row chat-row--${item.kind}`}>
                    <span className="chat-kind">{kindLabel[item.kind] ?? item.kind}</span>
                    <span className="chat-text">{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <h2 className="section-title">JSON 数据</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleCopyJson(chatItemsJson)}
              >
                {jsonCopied ? "已复制" : "复制 JSON"}
              </button>
            </div>
            <pre className="json-block">{chatItemsJson}</pre>
          </div>
        </>
      ) : null}
    </section>
  );
}
