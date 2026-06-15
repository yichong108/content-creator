import { useState, type FormEvent } from "react";

import type { SessionFormValues } from "@/components/session-form-types";
import { parseChatItemsJson } from "@/lib/chat-items";
import type { SessionFormPayload } from "@/types/session";

interface SessionFormProps {
  /** 表单标题 */
  heading: string;
  /** 表单说明 */
  description?: string;
  /** 初始值 */
  initialValues?: Partial<SessionFormValues>;
  /** 是否提交中 */
  submitting: boolean;
  /** 服务端或校验错误 */
  error: string | null;
  /** 提交按钮文案 */
  submitLabel: string;
  /** 提交回调 */
  onSubmit: (payload: SessionFormPayload) => Promise<void>;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 会话新建/编辑共用表单。
 */
export function SessionForm({
  heading,
  description,
  initialValues,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: SessionFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [formDescription, setFormDescription] = useState(initialValues?.description ?? "");
  const [chatItemsJson, setChatItemsJson] = useState(initialValues?.chatItemsJson ?? "[]");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFieldError("标题不能为空");
      return;
    }

    const parsed = parseChatItemsJson(chatItemsJson);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }

    const trimmedDescription = formDescription.trim();

    await onSubmit({
      title: trimmedTitle,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      chat_items: parsed.data,
    });
  };

  const displayError = fieldError ?? error;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{heading}</h1>
          {description ? <p className="page-desc">{description}</p> : null}
        </div>
      </header>

      {displayError ? <div className="alert alert-error">{displayError}</div> : null}

      <form className="card form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="form-field">
          <span className="form-label">标题</span>
          <input
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：豆包 × DeepSeek 练车记"
            maxLength={200}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">描述</span>
          <textarea
            className="form-textarea"
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
            placeholder="可选，会话简介"
            rows={3}
          />
        </label>

        <label className="form-field">
          <span className="form-label">聊天记录 JSON</span>
          <span className="form-hint">
            数组格式，每项包含 kind（timestamp/system/incoming/outgoing）与 text
          </span>
          <textarea
            className="form-textarea form-textarea--code"
            value={chatItemsJson}
            onChange={(event) => setChatItemsJson(event.target.value)}
            rows={16}
            spellCheck={false}
          />
        </label>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "提交中…" : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
