import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SessionForm } from "@/components/SessionForm";
import { sessionToFormValues } from "@/lib/session-form";
import { useSessionStore } from "@/stores/session-store";

/**
 * 编辑会话页。
 */
export function SessionEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = Number(id);

  const currentSession = useSessionStore((state) => state.currentSession);
  const detailLoading = useSessionStore((state) => state.detailLoading);
  const submitting = useSessionStore((state) => state.submitting);
  const error = useSessionStore((state) => state.error);
  const loadSession = useSessionStore((state) => state.loadSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const clearCurrentSession = useSessionStore((state) => state.clearCurrentSession);
  const clearError = useSessionStore((state) => state.clearError);

  useEffect(() => {
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return;
    }

    void loadSession(sessionId);

    return () => {
      clearCurrentSession();
    };
  }, [sessionId, loadSession, clearCurrentSession]);

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

  if (detailLoading && !currentSession) {
    return (
      <section className="page">
        <Link className="breadcrumb" to="/">
          ← 返回列表
        </Link>
        <p className="muted">加载中…</p>
      </section>
    );
  }

  if (!currentSession) {
    return (
      <section className="page">
        <Link className="breadcrumb" to="/">
          ← 返回列表
        </Link>
        {error ? <div className="alert alert-error">{error}</div> : null}
      </section>
    );
  }

  return (
    <>
      <Link className="breadcrumb" to={`/sessions/${sessionId}`}>
        ← 返回详情
      </Link>
      <SessionForm
        key={currentSession.id}
        heading="编辑会话"
        description={`正在编辑 #${currentSession.id}`}
        initialValues={sessionToFormValues(currentSession)}
        submitting={submitting}
        error={error}
        submitLabel="保存"
        onCancel={() => {
          clearError();
          navigate(`/sessions/${sessionId}`);
        }}
        onSubmit={async (payload) => {
          const updated = await updateSession(sessionId, payload);
          if (updated) {
            navigate(`/sessions/${sessionId}`);
          }
        }}
      />
    </>
  );
}
