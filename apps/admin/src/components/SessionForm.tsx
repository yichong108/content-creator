import { useEffect, useState, type FormEvent } from "react";

import { generateChatItems, generateSessionTitle } from "@/api/sessions";
import type { ChatSessionFormValues } from "@/components/chat-session-form-types";
import { SessionNpcFields } from "@/components/SessionNpcFields";
import { parseChatItemsJson, stringifyChatItems } from "@/lib/chat-items";
import { mergeNpcChatItems } from "@/lib/merge-npc-chat-items";
import { getRequestErrorMessage } from "@/lib/request";
import { useNpcStore } from "@/stores/npc-store";
import type { SessionFormPayload } from "@/types/session";

interface SessionFormProps {
  /** 表单标题 */
  heading: string;
  /** 表单说明 */
  description?: string;
  /** 初始值 */
  initialValues?: Partial<ChatSessionFormValues>;
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
  const npcs = useNpcStore((state) => state.npcs);
  const listLoading = useNpcStore((state) => state.listLoading);
  const loadNpcs = useNpcStore((state) => state.loadNpcs);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [formDescription, setFormDescription] = useState(initialValues?.description ?? "");
  const [chatItemsJson, setChatItemsJson] = useState(initialValues?.chatItemsJson ?? "[]");
  const [peerNpcIds, setPeerNpcIds] = useState<number[]>(initialValues?.peerNpcIds ?? []);
  const [selfNpcId, setSelfNpcId] = useState<number | null>(initialValues?.selfNpcId ?? null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingChatItems, setGeneratingChatItems] = useState(false);

  const generating = generatingTitle || generatingChatItems;

  useEffect(() => {
    void loadNpcs();
  }, [loadNpcs]);

  const syncChatItemsFromNpcs = (nextPeerNpcIds: number[], nextSelfNpcId: number | null) => {
    setChatItemsJson(stringifyChatItems(mergeNpcChatItems(npcs, nextPeerNpcIds, nextSelfNpcId)));
  };

  const handlePeerNpcChange = (npcIds: number[]) => {
    setPeerNpcIds(npcIds);
    syncChatItemsFromNpcs(npcIds, selfNpcId);
  };

  const handleSelfNpcChange = (npcId: number | null) => {
    setSelfNpcId(npcId);
    syncChatItemsFromNpcs(peerNpcIds, npcId);
  };

  const handleGenerateTitle = async () => {
    setFieldError(null);

    const parsed = parseChatItemsJson(chatItemsJson);
    const chatItems = parsed.ok && parsed.data.length > 0 ? parsed.data : undefined;

    setGeneratingTitle(true);

    const trimmedDescription = formDescription.trim();
    const result = await generateSessionTitle({
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

    const result = await generateChatItems(trimmedTitle);

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

    const parsed = parseChatItemsJson(chatItemsJson);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }

    const trimmedDescription = formDescription.trim();

    await onSubmit({
      title: trimmedTitle,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      peer_npc_ids: peerNpcIds,
      self_npc_id: selfNpcId,
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
        <SessionNpcFields
          npcs={npcs}
          listLoading={listLoading}
          peerNpcIds={peerNpcIds}
          selfNpcId={selfNpcId}
          onPeerNpcChange={handlePeerNpcChange}
          onSelfNpcChange={handleSelfNpcChange}
          disabled={submitting || generating}
        />

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
            placeholder="例如：豆包 × DeepSeek 练车记"
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
            placeholder="可选，会话简介"
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
              disabled={submitting || generating}
            >
              {generatingChatItems ? "生成中…" : "自动生成"}
            </button>
          </div>
          <span className="form-hint">
            数组格式，每项包含 kind（timestamp/system/incoming/outgoing）与 text；incoming
            为非己方，outgoing 为己方；可根据标题自动生成
          </span>
          <textarea
            className="form-textarea form-textarea--code"
            value={chatItemsJson}
            onChange={(event) => setChatItemsJson(event.target.value)}
            rows={16}
            spellCheck={false}
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
