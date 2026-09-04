import { useEffect, useState } from "react";

import { Progress } from "antd";

import { fetchTokenUsage } from "@/api/token-usage";
import { getRequestErrorMessage } from "@/lib/request";
import type { TokenUsage } from "@/types/token-usage";

/**
 * token 用量页：展示当前已消耗 token 占总量的占比进度。
 */
export function TokenUsagePage() {
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const result = await fetchTokenUsage();
      if (cancelled) {
        return;
      }

      setLoading(false);

      if (!result.ok) {
        setError(getRequestErrorMessage(result));
        return;
      }

      setUsage(result.data);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const percent =
    usage && usage.total_tokens > 0
      ? Math.min(100, Math.round((usage.used_tokens / usage.total_tokens) * 100))
      : 0;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Token 用量</h1>
          <p className="page-desc">当前 AI 调用累计消耗占总量的占比</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card token-usage-panel">
        {loading ? (
          <p className="muted">加载中…</p>
        ) : usage ? (
          <>
            <Progress type="dashboard" percent={percent} size={220} format={() => `${percent}%`} />
            <dl className="token-usage-metrics">
              <div className="token-usage-item">
                <dt>已消耗</dt>
                <dd>{usage.used_tokens.toLocaleString("zh-CN")} tokens</dd>
              </div>
              <div className="token-usage-item">
                <dt>总量额度</dt>
                <dd>{usage.total_tokens.toLocaleString("zh-CN")} tokens</dd>
              </div>
              <div className="token-usage-item">
                <dt>剩余</dt>
                <dd>
                  {Math.max(0, usage.total_tokens - usage.used_tokens).toLocaleString("zh-CN")}{" "}
                  tokens
                </dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}
