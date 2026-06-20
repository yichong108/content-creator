import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { LiveSessionForm } from "@/components/LiveSessionForm";
import { liveSessionToFormValues } from "@/lib/live-session-form";
import { useLiveSessionStore } from "@/stores/live-session-store";

/**
 * 编辑直播会话页。
 */
export function LiveSessionEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const liveSessionId = Number(id);

  const currentLiveSession = useLiveSessionStore((state) => state.currentLiveSession);
  const detailLoading = useLiveSessionStore((state) => state.detailLoading);
  const submitting = useLiveSessionStore((state) => state.submitting);
  const error = useLiveSessionStore((state) => state.error);
  const loadLiveSession = useLiveSessionStore((state) => state.loadLiveSession);
  const updateLiveSession = useLiveSessionStore((state) => state.updateLiveSession);
  const clearCurrentLiveSession = useLiveSessionStore((state) => state.clearCurrentLiveSession);
  const clearError = useLiveSessionStore((state) => state.clearError);

  useEffect(() => {
    if (!Number.isFinite(liveSessionId) || liveSessionId <= 0) {
      return;
    }

    void loadLiveSession(liveSessionId);

    return () => {
      clearCurrentLiveSession();
    };
  }, [liveSessionId, loadLiveSession, clearCurrentLiveSession]);

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

  if (detailLoading && !currentLiveSession) {
    return (
      <section className="page">
        <Link className="breadcrumb" to="/live-sessions">
          ← 返回列表
        </Link>
        <p className="muted">加载中…</p>
      </section>
    );
  }

  if (!currentLiveSession) {
    return (
      <section className="page">
        <Link className="breadcrumb" to="/live-sessions">
          ← 返回列表
        </Link>
        {error ? <div className="alert alert-error">{error}</div> : null}
      </section>
    );
  }

  return (
    <>
      <Link className="breadcrumb" to={`/live-sessions/${liveSessionId}`}>
        ← 返回详情
      </Link>
      <LiveSessionForm
        key={currentLiveSession.id}
        heading="编辑直播会话"
        description={`正在编辑 #${currentLiveSession.id}`}
        initialValues={liveSessionToFormValues(currentLiveSession)}
        submitting={submitting}
        error={error}
        submitLabel="保存"
        onCancel={() => {
          clearError();
          navigate(`/live-sessions/${liveSessionId}`);
        }}
        onSubmit={async (payload) => {
          const updated = await updateLiveSession(liveSessionId, payload);
          if (updated) {
            navigate(`/live-sessions/${liveSessionId}`);
          }
        }}
      />
    </>
  );
}
