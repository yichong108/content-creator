import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchLiveSession } from "@/api/live-sessions";
import { SessionChatPreviewModal } from "@/components/SessionChatPreviewModal";
import { formatDateTime } from "@/lib/format";
import { useLiveSessionStore } from "@/stores/live-session-store";

/**
 * 直播会话列表页，以表格展示全部直播会话。
 */
export function LiveSessionListPage() {
  const liveSessions = useLiveSessionStore((state) => state.liveSessions);
  const listLoading = useLiveSessionStore((state) => state.listLoading);
  const submitting = useLiveSessionStore((state) => state.submitting);
  const error = useLiveSessionStore((state) => state.error);
  const loadLiveSessions = useLiveSessionStore((state) => state.loadLiveSessions);
  const deleteLiveSession = useLiveSessionStore((state) => state.deleteLiveSession);
  const setEnabled = useLiveSessionStore((state) => state.setEnabled);
  const setRunning = useLiveSessionStore((state) => state.setRunning);
  const [previewSessionId, setPreviewSessionId] = useState<number | null>(null);
  const [togglingSessionId, setTogglingSessionId] = useState<number | null>(null);
  const [runningSessionId, setRunningSessionId] = useState<number | null>(null);
  const [previewSessionTitle, setPreviewSessionTitle] = useState("");

  const hasRunningSession = liveSessions.some((session) => session.running);

  useEffect(() => {
    void loadLiveSessions();
  }, [loadLiveSessions]);

  useEffect(() => {
    if (!hasRunningSession) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadLiveSessions();
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasRunningSession, loadLiveSessions]);

  const handleDelete = async (liveSessionId: number, title: string) => {
    const confirmed = window.confirm(`确定删除直播会话「${title}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    const deleted = await deleteLiveSession(liveSessionId);
    if (deleted) {
      void loadLiveSessions();
    }
  };

  const handleOpenPreview = (liveSessionId: number, title: string) => {
    setPreviewSessionId(liveSessionId);
    setPreviewSessionTitle(title);
  };

  const handleClosePreview = () => {
    setPreviewSessionId(null);
    setPreviewSessionTitle("");
  };

  const handleEnabledToggle = async (liveSessionId: number, nextEnabled: boolean) => {
    setTogglingSessionId(liveSessionId);
    await setEnabled(liveSessionId, nextEnabled);
    setTogglingSessionId(null);
  };

  const handleRunningToggle = async (liveSessionId: number, nextRunning: boolean) => {
    if (nextRunning) {
      const confirmed = window.confirm(
        "开始运行后将自动开启直播展示，并实时续写聊天记录。确定开始吗？",
      );
      if (!confirmed) {
        return;
      }
    }

    setRunningSessionId(liveSessionId);
    await setRunning(liveSessionId, nextRunning);
    setRunningSessionId(null);
  };

  const fetchPreviewSession = async (liveSessionId: number) => {
    const result = await fetchLiveSession(liveSessionId);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true as const,
      data: {
        chat_items: result.data.chat_items,
      },
    };
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>直播会话</h1>
          <p className="page-desc">管理用于直播演示的会话，Web /live 页面展示已开启的会话</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadLiveSessions()}
          >
            刷新
          </button>
          <Link className="btn btn-primary" to="/live-sessions/new">
            新建直播会话
          </Link>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card--flush">
        <div className="table-toolbar">
          <span className="table-toolbar-meta">
            {listLoading ? "加载中…" : `共 ${liveSessions.length} 条直播会话`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <colgroup>
              <col className="col-id" />
              <col className="col-title" />
              <col className="col-desc" />
              <col className="col-num" />
              <col className="col-switch" />
              <col className="col-switch" />
              <col className="col-date" />
              <col className="col-date" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">标题</th>
                <th scope="col">描述</th>
                <th scope="col">消息数</th>
                <th scope="col">直播展示</th>
                <th scope="col">运行</th>
                <th scope="col">创建时间</th>
                <th scope="col">更新时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td className="table-state" colSpan={9}>
                    正在加载直播会话列表…
                  </td>
                </tr>
              ) : liveSessions.length === 0 ? (
                <tr>
                  <td className="table-state" colSpan={9}>
                    <div className="empty-state empty-state--table">
                      <p className="muted">暂无直播会话</p>
                      <Link className="btn btn-primary btn-sm" to="/live-sessions/new">
                        创建第一个直播会话
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                liveSessions.map((liveSession) => (
                  <tr key={liveSession.id}>
                    <td className="col-id">{liveSession.id}</td>
                    <td className="cell-title">
                      <Link className="link" to={`/live-sessions/${liveSession.id}`}>
                        {liveSession.title}
                      </Link>
                    </td>
                    <td className="cell-desc">{liveSession.description ?? "—"}</td>
                    <td className="col-num">{liveSession.chat_item_count}</td>
                    <td className="col-switch">
                      <label className="switch" title="开启后 Web 直播页 /live 将展示此会话">
                        <input
                          type="checkbox"
                          checked={liveSession.enabled}
                          disabled={submitting && togglingSessionId === liveSession.id}
                          onChange={(event) =>
                            void handleEnabledToggle(liveSession.id, event.target.checked)
                          }
                        />
                        <span className="switch-slider" aria-hidden="true" />
                        <span className="sr-only">
                          {liveSession.enabled ? "关闭直播展示" : "开启直播展示"}
                        </span>
                      </label>
                    </td>
                    <td className="col-switch">
                      {liveSession.running ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={submitting && runningSessionId === liveSession.id}
                          onClick={() => void handleRunningToggle(liveSession.id, false)}
                        >
                          停止运行
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={submitting && runningSessionId === liveSession.id}
                          onClick={() => void handleRunningToggle(liveSession.id, true)}
                        >
                          开始运行
                        </button>
                      )}
                    </td>
                    <td className="col-date">{formatDateTime(liveSession.created_at)}</td>
                    <td className="col-date">{formatDateTime(liveSession.updated_at)}</td>
                    <td className="col-actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenPreview(liveSession.id, liveSession.title)}
                        >
                          预览
                        </button>
                        <Link
                          className="btn btn-secondary btn-sm"
                          to={`/live-sessions/${liveSession.id}`}
                        >
                          查看
                        </Link>
                        <Link
                          className="btn btn-secondary btn-sm"
                          to={`/live-sessions/${liveSession.id}/edit`}
                        >
                          编辑
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={submitting}
                          onClick={() => void handleDelete(liveSession.id, liveSession.title)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SessionChatPreviewModal
        open={previewSessionId != null}
        sessionId={previewSessionId}
        sessionTitle={previewSessionTitle}
        previewPath="/live"
        fetchSessionDetail={fetchPreviewSession}
        onClose={handleClosePreview}
      />
    </section>
  );
}
