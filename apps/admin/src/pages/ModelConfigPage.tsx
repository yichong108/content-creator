import { useEffect, useState, type FormEvent } from "react";

import { fetchAiConfig, saveAiConfig } from "@/api/ai-config";
import { getRequestErrorMessage } from "@/lib/request";
import type { AiConfig, AiProvider, CursorSdkConfig, OpenAiConfig } from "@/types/ai-config";
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
 * OpenAI 配置表单字段（受控组件，切换提供商时不卸载父级状态）。
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

interface CursorSdkConfigFieldsProps {
  /** 当前 Cursor SDK 配置 */
  value: CursorSdkConfig;
  /** 字段变更回调 */
  onChange: (next: CursorSdkConfig) => void;
  /** 是否禁用输入 */
  disabled?: boolean;
}

/**
 * Cursor SDK 配置表单字段（受控组件，切换提供商时不卸载父级状态）。
 */
function CursorSdkConfigFields({ value, onChange, disabled = false }: CursorSdkConfigFieldsProps) {
  const patch = (partial: Partial<CursorSdkConfig>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <>
      <label className="form-field">
        <span className="form-label">API Key</span>
        <span className="form-hint">Cursor 控制台获取的 API Key</span>
        <input
          className="form-input"
          type="password"
          autoComplete="off"
          value={value.api_key}
          onChange={(event) => patch({ api_key: event.target.value })}
          placeholder="key_..."
          disabled={disabled}
        />
      </label>

      <label className="form-field">
        <span className="form-label">模型</span>
        <input
          className="form-input"
          value={value.model}
          onChange={(event) => patch({ model: event.target.value })}
          placeholder="composer-2.5"
          disabled={disabled}
        />
      </label>

      <fieldset className="form-field radio-fieldset">
        <legend className="form-label">运行环境</legend>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="cursor-runtime"
              value="local"
              checked={value.runtime === "local"}
              onChange={() => patch({ runtime: "local" })}
              disabled={disabled}
            />
            <span>Local（本地）</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="cursor-runtime"
              value="cloud"
              checked={value.runtime === "cloud"}
              onChange={() => patch({ runtime: "cloud" })}
              disabled={disabled}
            />
            <span>Cloud（云端）</span>
          </label>
        </div>
      </fieldset>

      <label className="form-field">
        <span className="form-label">工作目录</span>
        <span className="form-hint">Local 模式下 Agent 的工作目录，留空则使用项目根目录</span>
        <input
          className="form-input"
          value={value.cwd}
          onChange={(event) => patch({ cwd: event.target.value })}
          placeholder="d:/path/to/wechat-bot"
          disabled={disabled || value.runtime === "cloud"}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Git 仓库</span>
        <span className="form-hint">Cloud 模式下 Agent 操作的仓库地址，多个用逗号或换行分隔</span>
        <textarea
          className="form-input form-textarea"
          value={value.repos}
          onChange={(event) => patch({ repos: event.target.value })}
          placeholder="https://github.com/your-org/wechat-bot"
          rows={3}
          disabled={disabled || value.runtime === "local"}
        />
      </label>
    </>
  );
}

/**
 * AI 配置页：选择 OpenAI 或 Cursor SDK，分别维护两套配置并统一保存。
 */
export function ModelConfigPage() {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [openaiConfig, setOpenaiConfig] = useState(EMPTY_AI_CONFIG.openai);
  const [cursorSdkConfig, setCursorSdkConfig] = useState(EMPTY_AI_CONFIG.cursor_sdk);
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

      setProvider(result.data.provider);
      setOpenaiConfig(result.data.openai);
      setCursorSdkConfig(result.data.cursor_sdk);
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
      provider,
      openai: openaiConfig,
      cursor_sdk: cursorSdkConfig,
    };

    const result = await saveAiConfig(payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(getRequestErrorMessage(result));
      return;
    }

    setProvider(result.data.provider);
    setOpenaiConfig(result.data.openai);
    setCursorSdkConfig(result.data.cursor_sdk);
    setSuccessMessage("配置已保存");
  };

  const formDisabled = loading || submitting;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>AI配置</h1>
          <p className="page-desc">配置 AI 模型提供商、默认模型及相关参数</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {successMessage ? <div className="alert alert-success">{successMessage}</div> : null}

      <form className="form ai-config-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="card">
          <h2 className="section-title">AI 提供商</h2>
          <fieldset className="radio-fieldset">
            <div className="radio-group radio-group--provider">
              <label className="radio-option">
                <input
                  type="radio"
                  name="ai-provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={() => setProvider("openai")}
                  disabled={formDisabled}
                />
                <span>OpenAI</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="ai-provider"
                  value="cursor_sdk"
                  checked={provider === "cursor_sdk"}
                  onChange={() => setProvider("cursor_sdk")}
                  disabled={formDisabled}
                />
                <span>Cursor SDK</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div
          className={
            provider === "openai" ? "card config-panel" : "card config-panel config-panel--hidden"
          }
        >
          <h2 className="section-title">OpenAI 配置</h2>
          <OpenAiConfigFields
            value={openaiConfig}
            onChange={setOpenaiConfig}
            disabled={formDisabled}
          />
        </div>

        <div
          className={
            provider === "cursor_sdk"
              ? "card config-panel"
              : "card config-panel config-panel--hidden"
          }
        >
          <h2 className="section-title">Cursor SDK 配置</h2>
          <CursorSdkConfigFields
            value={cursorSdkConfig}
            onChange={setCursorSdkConfig}
            disabled={formDisabled}
          />
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
