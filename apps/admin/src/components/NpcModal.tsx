import { useEffect, useState, type FormEvent } from "react";

import { NpcTagList } from "@/components/NpcTagList";
import { formatDateTime } from "@/lib/format";
import { formatNpcTagsInput, parseNpcTagsInput } from "@/lib/npc-tags";
import type { NpcFormPayload, NpcSummary } from "@/types/npc";

interface NpcModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 查看、编辑或新建模式 */
  mode: "view" | "edit" | "create";
  /** 当前 NPC 数据，新建模式下为 null */
  npc: NpcSummary | null;
  /** 是否提交中 */
  submitting?: boolean;
  /** 服务端错误信息 */
  error?: string | null;
  /** 详情加载中（查看模式） */
  detailLoading?: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 新建保存回调 */
  onCreate?: (payload: NpcFormPayload) => void;
  /** 编辑保存回调 */
  onSave?: (npcId: number, payload: NpcFormPayload) => void;
}

/**
 * NPC 查看/编辑/新建弹窗。
 *
 * 查看模式只读展示 NPC 字段；编辑与新建模式提供表单并触发对应保存回调。
 */
export function NpcModal({
  open,
  mode,
  npc,
  submitting = false,
  error = null,
  detailLoading = false,
  onClose,
  onCreate,
  onSave,
}: NpcModalProps) {
  const [name, setName] = useState("");
  const [personaDescription, setPersonaDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "create") {
      setName("");
      setPersonaDescription("");
      setTagsInput("");
    } else if (npc != null) {
      setName(npc.name);
      setPersonaDescription(npc.persona_description);
      setTagsInput(formatNpcTagsInput(npc.tags ?? []));
    }

    setFieldError(null);
  }, [open, mode, npc]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, submitting]);

  if (!open || (mode !== "create" && npc == null)) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    const trimmedName = name.trim();
    const trimmedPersona = personaDescription.trim();

    if (!trimmedName) {
      setFieldError("请填写 NPC 名称");
      return;
    }

    if (!trimmedPersona) {
      setFieldError("请填写人设描述");
      return;
    }

    const payload: NpcFormPayload = {
      name: trimmedName,
      persona_description: trimmedPersona,
      tags: parseNpcTagsInput(tagsInput),
    };

    if (mode === "create") {
      onCreate?.(payload);
      return;
    }

    if (npc != null) {
      onSave?.(npc.id, payload);
    }
  };

  const title = mode === "view" ? "查看 NPC" : mode === "edit" ? "编辑 NPC" : "新建 NPC";

  return (
    <div className="modal-overlay" role="presentation" onClick={submitting ? undefined : onClose}>
      <div
        className="modal-panel modal-panel--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="npc-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="npc-modal-title" className="modal-title">
              {title}
            </h2>
            {mode !== "create" && npc != null ? (
              <p className="modal-desc">{npc.name}</p>
            ) : (
              <p className="modal-desc">填写 NPC 基本信息</p>
            )}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="关闭"
            disabled={submitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {mode === "view" && npc != null ? (
          <div className="modal-body">
            {error ? <div className="alert alert-error">{error}</div> : null}
            {detailLoading ? (
              <p className="muted">加载中…</p>
            ) : (
              <dl className="detail-list">
                <div className="detail-item">
                  <dt>NPC名称</dt>
                  <dd>{npc.name}</dd>
                </div>
                <div className="detail-item">
                  <dt>标签</dt>
                  <dd>
                    <NpcTagList tags={npc.tags ?? []} />
                  </dd>
                </div>
                <div className="detail-item">
                  <dt>人设描述</dt>
                  <dd className="detail-text">{npc.persona_description}</dd>
                </div>
                <div className="detail-item">
                  <dt>创建时间</dt>
                  <dd>{formatDateTime(npc.created_at)}</dd>
                </div>
                <div className="detail-item">
                  <dt>更新时间</dt>
                  <dd>{formatDateTime(npc.updated_at)}</dd>
                </div>
              </dl>
            )}
          </div>
        ) : (
          <form className="form modal-form" onSubmit={handleSubmit}>
            <div className="modal-body">
              {error ? <div className="alert alert-error">{error}</div> : null}
              {fieldError ? <div className="alert alert-error">{fieldError}</div> : null}

              <label className="form-field">
                <span className="form-label">NPC名称</span>
                <input
                  className="form-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：豆包"
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="form-field">
                <span className="form-label">标签</span>
                <span className="form-hint">多个标签可用逗号或空格分隔，例如：AI，助手</span>
                <input
                  className="form-input"
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="例如：AI，助手"
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span className="form-label">人设描述</span>
                <span className="form-hint">描述 NPC 的性格、说话风格与背景设定</span>
                <textarea
                  className="form-textarea"
                  value={personaDescription}
                  onChange={(event) => setPersonaDescription(event.target.value)}
                  rows={5}
                  placeholder="例如：语气活泼、善于倾听，擅长日常闲聊与情感陪伴"
                  disabled={submitting}
                />
              </label>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={onClose}
              >
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "保存中…" : mode === "create" ? "创建" : "保存"}
              </button>
            </footer>
          </form>
        )}

        {mode === "view" ? (
          <footer className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              关闭
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
