import { useEffect, useState, type FormEvent } from "react";

import { fetchAiConfig, saveAiConfig } from "@/api/ai-config";
import { getRequestErrorMessage } from "@/lib/request";
import type { AiConfig, OpenAiConfig } from "@/types/ai-config";
import { EMPTY_AI_CONFIG } from "@/types/ai-config";

interface OpenAiConfigFieldsProps {
  /** 当前 OpenAI 配置 */
  value: OpenAiConfig;
  /** 字段变更回调 */
  onChange: (next: OpenAiConfig) => void;
  /** 是否禁用输入 */
  disabled?: boolean;
}

/**
 * OpenAI 配置表单字段。
 */
function OpenAiConfigFields({ value, onChange, disabled = false }: OpenAiConfigFieldsProps) {
  const patch = (partial: Partial<OpenAiConfig>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <>
      <label className="form-field">
        <span className="form-label">API Key</span>
        <span className="form-hint">OpenAI 或兼容服务（如 DeepSeek）的 API Key</span>
        <input
          className="form-input"
          type="password"
          autoComplete="off"
          value={value.api_key}
          onChange={(event) => patch({ api_key: event.target.value })}
          placeholder="sk-..."
          disabled={disabled}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Base URL</span>
        <span className="form-hint">可选，留空则使用 OpenAI 官方地址</span>
        <input
          className="form-input"
          type="url"
          value={value.base_url}
          onChange={(event) => patch({ base_url: event.target.value })}
          placeholder="https://api.openai.com/v1"
          disabled={disabled}
        />
      </label>

      <label className="form-field">
        <span className="form-label">模型</span>
        <input
          className="form-input"
          value={value.model}
          onChange={(event) => patch({ model: event.target.value })}
          placeholder="gpt-4o-mini"
          disabled={disabled}
        />
      </label>
    </>
  );
}

/**
 * AI 配置页：维护 OpenAI 兼容 API 配置。
 */
export function ModelConfigPage() {
  const [openaiConfig, setOpenaiConfig] = useState(EMPTY_AI_CONFIG.openai);
  const [tokenQuota, setTokenQuota] = useState(EMPTY_AI_CONFIG.token_quota);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const result = await fetchAiConfig();
      if (cancelled) {
        return;
      }

      setLoading(false);

      if (!result.ok) {
        setError(getRequestErrorMessage(result));
        return;
      }

      setOpenaiConfig(result.data.openai);
      setTokenQuota(result.data.token_quota);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const payload: AiConfig = {
      openai: openaiConfig,
      token_quota: tokenQuota,
    };

    const result = await saveAiConfig(payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(getRequestErrorMessage(result));
      return;
    }

    setOpenaiConfig(result.data.openai);
    setTokenQuota(result.data.token_quota);
    setSuccessMessage("配置已保存");
  };

  const formDisabled = loading || submitting;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>AI配置</h1>
          <p className="page-desc">配置 OpenAI 兼容 API 的密钥、地址与默认模型</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {successMessage ? <div className="alert alert-success">{successMessage}</div> : null}

      <form className="form ai-config-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="card config-panel">
          <h2 className="section-title">OpenAI 配置</h2>
          <OpenAiConfigFields
            value={openaiConfig}
            onChange={setOpenaiConfig}
            disabled={formDisabled}
          />
        </div>

        <div className="card config-panel">
          <h2 className="section-title">token 额度</h2>
          <label className="form-field">
            <span className="form-label">总量额度</span>
            <span className="form-hint">
              用于「token 用量」页面计算消耗占比，DeepSeek 官方 API 不提供该值
            </span>
            <input
              className="form-input"
              type="number"
              min={1}
              value={tokenQuota}
              onChange={(event) => setTokenQuota(Number(event.target.value))}
              disabled={formDisabled}
            />
          </label>
        </div>

        <div className="form-actions form-actions--page-footer">
          <button type="submit" className="btn btn-primary" disabled={formDisabled}>
            {submitting ? "保存中…" : loading ? "加载中…" : "保存配置"}
          </button>
        </div>
      </form>
    </section>
  );
}
