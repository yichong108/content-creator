import { Link, useNavigate } from "react-router-dom";

import { LiveSessionForm } from "@/components/LiveSessionForm";
import { useLiveSessionStore } from "@/stores/live-session-store";

/**
 * 新建直播会话页。
 */
export function LiveSessionCreatePage() {
  const navigate = useNavigate();
  const submitting = useLiveSessionStore((state) => state.submitting);
  const error = useLiveSessionStore((state) => state.error);
  const createLiveSession = useLiveSessionStore((state) => state.createLiveSession);
  const clearError = useLiveSessionStore((state) => state.clearError);

  return (
    <>
      <Link className="breadcrumb" to="/live-sessions">
        ← 返回列表
      </Link>
      <LiveSessionForm
        heading="新建直播会话"
        description="可选设置对方/己方 NPC，并填写标题、描述与聊天记录"
        submitting={submitting}
        error={error}
        submitLabel="创建"
        onCancel={() => {
          clearError();
          navigate("/live-sessions");
        }}
        onSubmit={async (payload) => {
          const created = await createLiveSession(payload);
          if (created) {
            navigate(`/live-sessions/${created.id}`);
          }
        }}
      />
    </>
  );
}
