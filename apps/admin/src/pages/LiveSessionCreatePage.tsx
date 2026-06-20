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
        mode="create"
        heading="新建直播会话"
        description="选择 NPC 并填写标题、描述；聊天记录将合并所选 NPC 的对话"
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
