import { useEffect, useMemo, useState, type FormEvent } from "react";

import { NpcAvatar } from "@/components/NpcAvatar";
import { generateLiveChatItems, generateLiveSessionTitle } from "@/api/live-sessions";
import type { ChatSessionFormValues } from "@/components/chat-session-form-types";
import { parseChatItemsJson, stringifyChatItems } from "@/lib/chat-items";
import { mergeNpcChatItems } from "@/lib/merge-npc-chat-items";
import { getRequestErrorMessage } from "@/lib/request";
import { useNpcStore } from "@/stores/npc-store";
import type { LiveSessionFormPayload } from "@/types/live-session";

interface LiveSessionFormProps {
  /** 表单模式：新建可多选 NPC，编辑仅可追加 */
  mode: "create" | "edit";
  /** 表单标题 */
  heading: string;
  /** 表单说明 */
  description?: string;
  /** 初始值 */
  initialValues?: Partial<ChatSessionFormValues>;
  /** 编辑模式下已关联且不可移除的 NPC ID */
  lockedNpcIds?: number[];
  /** 是否提交中 */
  submitting: boolean;
  /** 服务端或校验错误 */
  error: string | null;
  /** 提交按钮文案 */
  submitLabel: string;
  /** 提交回调 */
  onSubmit: (payload: LiveSessionFormPayload) => Promise<void>;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 直播会话新建/编辑共用表单。
 */
export function LiveSessionForm({
  mode,
  heading,
  description,
  initialValues,
  lockedNpcIds = [],
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: LiveSessionFormProps) {
  const npcs = useNpcStore((state) => state.npcs);
  const listLoading = useNpcStore((state) => state.listLoading);
  const loadNpcs = useNpcStore((state) => state.loadNpcs);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [formDescription, setFormDescription] = useState(initialValues?.description ?? "");
  const [chatItemsJson, setChatItemsJson] = useState(initialValues?.chatItemsJson ?? "[]");
  const [selectedNpcIds, setSelectedNpcIds] = useState<number[]>(
    mode === "create" ? (initialValues?.npcIds ?? []) : [],
  );
  const [addNpcIds, setAddNpcIds] = useState<number[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingChatItems, setGeneratingChatItems] = useState(false);

  const generating = generatingTitle || generatingChatItems;

  useEffect(() => {
    void loadNpcs();
  }, [loadNpcs]);

  const lockedNpcIdSet = useMemo(() => new Set(lockedNpcIds), [lockedNpcIds]);

  const handleNpcToggle = (npcId: number, checked: boolean) => {
    if (mode === "edit") {
      if (lockedNpcIdSet.has(npcId)) {
        return;
      }

      setAddNpcIds((prev) => {
        if (checked) {
          return prev.includes(npcId) ? prev : [...prev, npcId];
        }
        return prev.filter((id) => id !== npcId);
      });
      return;
    }

    setSelectedNpcIds((prev) => {
      const next = checked
        ? prev.includes(npcId)
          ? prev
          : [...prev, npcId]
        : prev.filter((id) => id !== npcId);

      setChatItemsJson(stringifyChatItems(mergeNpcChatItems(npcs, next)));
      return next;
    });
  };

  const handleGenerateTitle = async () => {
    setFieldError(null);

    const parsed = parseChatItemsJson(chatItemsJson);
    const chatItems = parsed.ok && parsed.data.length > 0 ? parsed.data : undefined;

    setGeneratingTitle(true);

    const trimmedDescription = formDescription.trim();
    const result = await generateLiveSessionTitle({
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      chat_items: chatItems,
    });

    setGeneratingTitle(false);

    if (!result.ok) {
      setFieldError(getRequestErrorMessage(result));
      return;
    }

    setTitle(result.data.title);
  };

  const handleGenerateChatItems = async () => {
    setFieldError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFieldError("请先填写标题后再自动生成聊天记录");
      return;
    }

    setGeneratingChatItems(true);

    const result = await generateLiveChatItems(trimmedTitle);

    setGeneratingChatItems(false);

    if (!result.ok) {
      setFieldError(getRequestErrorMessage(result));
      return;
    }

    setChatItemsJson(stringifyChatItems(result.data.chat_items));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFieldError("标题不能为空");
      return;
    }

    if (mode === "create" && selectedNpcIds.length === 0) {
      setFieldError("请至少选择一个 NPC");
      return;
    }

    const parsed = parseChatItemsJson(chatItemsJson);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }

    const trimmedDescription = formDescription.trim();
    const hasAddNpcIds = mode === "edit" && addNpcIds.length > 0;

    await onSubmit({
      title: trimmedTitle,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      npc_ids: mode === "create" ? selectedNpcIds : undefined,
      add_npc_ids: hasAddNpcIds ? addNpcIds : undefined,
      chat_items: hasAddNpcIds ? undefined : parsed.data,
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
        <div className="form-field">
          <span className="form-label">关联 NPC</span>
          <span className="form-hint">
            {mode === "create"
              ? "可多选；创建后不可移除，聊天记录将合并所选 NPC 的对话"
              : "已关联 NPC 不可移除，可继续勾选追加新 NPC"}
          </span>
          {listLoading && npcs.length === 0 ? (
            <p className="muted">加载 NPC 列表…</p>
          ) : npcs.length === 0 ? (
            <p className="muted">暂无 NPC，请先在 NPC 管理中创建</p>
          ) : (
            <div className="npc-picker">
              {npcs.map((npc) => {
                const locked = lockedNpcIdSet.has(npc.id);
                const checked =
                  mode === "create"
                    ? selectedNpcIds.includes(npc.id)
                    : locked || addNpcIds.includes(npc.id);

                return (
                  <label
                    key={npc.id}
                    className={`npc-picker-item${locked ? " npc-picker-item--locked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked || submitting || generating}
                      onChange={(event) => handleNpcToggle(npc.id, event.target.checked)}
                    />
                    <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} size={32} />
                    <span className="npc-picker-name">{npc.name}</span>
                    <span className="npc-picker-meta">{npc.chat_item_count} 条对话</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-field">
          <div className="form-label-row">
            <span className="form-label">标题</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleGenerateTitle()}
              disabled={submitting || generating}
            >
              {generatingTitle ? "生成中…" : "自动生成"}
            </button>
          </div>
          <span className="form-hint">
            可根据描述或聊天记录自动生成；无参考信息时将随机生成场景标题
          </span>
          <input
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：豆包 × DeepSeek 直播夜"
            maxLength={200}
            required
          />
        </div>

        <label className="form-field">
          <span className="form-label">描述</span>
          <textarea
            className="form-textarea"
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
            placeholder="可选，直播会话简介"
            rows={3}
          />
        </label>

        <div className="form-field">
          <div className="form-label-row">
            <span className="form-label">聊天记录 JSON</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleGenerateChatItems()}
              disabled={submitting || generating || (mode === "edit" && addNpcIds.length > 0)}
            >
              {generatingChatItems ? "生成中…" : "自动生成"}
            </button>
          </div>
          <span className="form-hint">
            {mode === "edit" && addNpcIds.length > 0
              ? "追加 NPC 时将由服务端自动合并新 NPC 的聊天记录"
              : "数组格式，每项包含 kind（timestamp/system/incoming/outgoing）与 text；可根据标题自动生成"}
          </span>
          <textarea
            className="form-textarea form-textarea--code"
            value={chatItemsJson}
            onChange={(event) => setChatItemsJson(event.target.value)}
            rows={16}
            spellCheck={false}
            readOnly={mode === "edit" && addNpcIds.length > 0}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting || generating}
          >
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || generating}>
            {submitting ? "提交中…" : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
