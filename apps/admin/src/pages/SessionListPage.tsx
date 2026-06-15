import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SessionChatPreviewModal } from "@/components/SessionChatPreviewModal";
import { formatDateTime } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";

/**
 * 会话列表页，以表格展示全部会话。
 */
export function SessionListPage() {
  const sessions = useSessionStore((state) => state.sessions);
  const listLoading = useSessionStore((state) => state.listLoading);
  const submitting = useSessionStore((state) => state.submitting);
  const error = useSessionStore((state) => state.error);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const setMobileEnabled = useSessionStore((state) => state.setMobileEnabled);
  const [previewSessionId, setPreviewSessionId] = useState<number | null>(null);
  const [togglingSessionId, setTogglingSessionId] = useState<number | null>(null);
  const [previewSessionTitle, setPreviewSessionTitle] = useState("");

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleDelete = async (sessionId: number, title: string) => {
    const confirmed = window.confirm(`确定删除会话「${title}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    const deleted = await deleteSession(sessionId);
    if (deleted) {
      void loadSessions();
    }
  };

  const handleOpenPreview = (sessionId: number, title: string) => {
    setPreviewSessionId(sessionId);
    setPreviewSessionTitle(title);
  };

  const handleClosePreview = () => {
    setPreviewSessionId(null);
    setPreviewSessionTitle("");
  };

  const handleMobileToggle = async (sessionId: number, nextEnabled: boolean) => {
    setTogglingSessionId(sessionId);
    await setMobileEnabled(sessionId, nextEnabled);
    setTogglingSessionId(null);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>会话列表</h1>
          <p className="page-desc">每个会话对应一份 JSON 格式的聊天记录</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void loadSessions()}>
            刷新
          </button>
          <Link className="btn btn-primary" to="/sessions/new">
            新建会话
          </Link>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {listLoading ? (
          <p className="muted">加载中…</p>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <p className="muted">暂无会话</p>
            <Link className="btn btn-primary" to="/sessions/new">
              创建第一个会话
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>描述</th>
                  <th>消息数</th>
                  <th>移动端</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.id}</td>
                    <td className="cell-title">{session.title}</td>
                    <td className="cell-desc">{session.description ?? "—"}</td>
                    <td>{session.chat_item_count}</td>
                    <td>
                      <label className="switch" title="开启后 Web 端将展示此会话">
                        <input
                          type="checkbox"
                          checked={session.mobile_enabled}
                          disabled={submitting && togglingSessionId === session.id}
                          onChange={(event) =>
                            void handleMobileToggle(session.id, event.target.checked)
                          }
                        />
                        <span className="switch-slider" aria-hidden="true" />
                        <span className="sr-only">
                          {session.mobile_enabled ? "关闭移动端展示" : "开启移动端展示"}
                        </span>
                      </label>
                    </td>
                    <td>{formatDateTime(session.created_at)}</td>
                    <td>{formatDateTime(session.updated_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="link"
                          onClick={() => handleOpenPreview(session.id, session.title)}
                        >
                          预览
                        </button>
                        <Link className="link" to={`/sessions/${session.id}`}>
                          查看
                        </Link>
                        <Link className="link" to={`/sessions/${session.id}/edit`}>
                          编辑
                        </Link>
                        <button
                          type="button"
                          className="link link-danger"
                          disabled={submitting}
                          onClick={() => void handleDelete(session.id, session.title)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SessionChatPreviewModal
        open={previewSessionId != null}
        sessionId={previewSessionId}
        sessionTitle={previewSessionTitle}
        onClose={handleClosePreview}
      />
    </section>
  );
}
