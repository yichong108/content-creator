import { useEffect, useState } from "react";

import { WechatSessionListPage } from "@/components/WechatSessionListPage";
import { fetchMobileSessions } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";
import type { MobileSessionSummary } from "@/types/mobile-session";

/**
 * 会话列表页
 *
 * 从 API 拉取移动端可展示的会话列表，并以微信风格列表页渲染。
 */
export function SessionListPage() {
  const [sessions, setSessions] = useState<MobileSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchMobileSessions()
      .then((res) => {
        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setError(getRequestErrorMessage(res));
          return;
        }

        setSessions(res.data ?? []);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <WechatSessionListPage sessions={sessions} loading={loading} error={error} />;
}
