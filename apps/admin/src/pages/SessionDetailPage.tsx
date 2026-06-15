import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatDateTime } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";

const kindLabel: Record<string, string> = {
  timestamp: "时间",
  system: "系统",
  incoming: "对方",
  outgoing: "本人",
};

/**
 * 会话详情页，展示会话元信息与聊天记录 JSON 预览。
 */
export function SessionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = Number(id);
  const currentSession = useSessionStore((state) => state.currentSession);
  const detailLoading = useSessionStore((state) => state.detailLoading);
  const submitting = useSessionStore((state) => state.submitting);
  const error = useSessionStore((state) => state.error);
  const loadSession = useSessionStore((state) => state.loadSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const clearCurrentSession = useSessionStore((state) => state.clearCurrentSession);

  useEffect(() => {
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return;
    }

    void loadSession(sessionId);

    return () => {
      clearCurrentSession();
    };
  }, [sessionId, loadSession, clearCurrentSession]);

  const handleDelete = async () => {
    if (!currentSession) {
      return;
    }

    const confirmed = window.confirm(`确定删除会话「${currentSession.title}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    const deleted = await deleteSession(sessionId);
    if (deleted) {
      navigate("/");
    }
  };

  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    return (
      <section className="page">
        <div className="alert alert-error">无效的会话 ID</div>
        <Link className="link" to="/">
          返回列表
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <Link className="breadcrumb" to="/">
            ← 返回列表
          </Link>
          <h1>{currentSession?.title ?? "会话详情"}</h1>
          {currentSession?.description ? (
            <p className="page-desc">{currentSession.description}</p>
          ) : null}
        </div>
        {currentSession ? (
          <div className="page-actions">
            <Link className="btn btn-secondary" to={`/sessions/${sessionId}/edit`}>
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
      ) : currentSession ? (
        <>
          <div className="meta-grid card">
            <div>
              <span className="meta-label">ID</span>
              <span>{currentSession.id}</span>
            </div>
            <div>
              <span className="meta-label">消息数</span>
              <span>{currentSession.chat_item_count}</span>
            </div>
            <div>
              <span className="meta-label">创建时间</span>
              <span>{formatDateTime(currentSession.created_at)}</span>
            </div>
            <div>
              <span className="meta-label">更新时间</span>
              <span>{formatDateTime(currentSession.updated_at)}</span>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">聊天记录预览</h2>
            <div className="chat-preview">
              {currentSession.chat_items.length === 0 ? (
                <p className="muted">暂无聊天记录</p>
              ) : (
                currentSession.chat_items.map((item, index) => (
                  <div key={`${item.kind}-${index}`} className={`chat-row chat-row--${item.kind}`}>
                    <span className="chat-kind">{kindLabel[item.kind] ?? item.kind}</span>
                    <span className="chat-text">{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">JSON 数据</h2>
            <pre className="json-block">{JSON.stringify(currentSession.chat_items, null, 2)}</pre>
          </div>
        </>
      ) : null}
    </section>
  );
}
