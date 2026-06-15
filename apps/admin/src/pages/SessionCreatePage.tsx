import { Link, useNavigate } from "react-router-dom";

import { SessionForm } from "@/components/SessionForm";
import { useSessionStore } from "@/stores/session-store";

/**
 * 新建会话页。
 */
export function SessionCreatePage() {
  const navigate = useNavigate();
  const submitting = useSessionStore((state) => state.submitting);
  const error = useSessionStore((state) => state.error);
  const createSession = useSessionStore((state) => state.createSession);
  const clearError = useSessionStore((state) => state.clearError);

  return (
    <>
      <Link className="breadcrumb" to="/">
        ← 返回列表
      </Link>
      <SessionForm
        heading="新建会话"
        description="填写标题、描述与 JSON 格式的聊天记录"
        submitting={submitting}
        error={error}
        submitLabel="创建"
        onCancel={() => {
          clearError();
          navigate("/");
        }}
        onSubmit={async (payload) => {
          const created = await createSession(payload);
          if (created) {
            navigate(`/sessions/${created.id}`);
          }
        }}
      />
    </>
  );
}
