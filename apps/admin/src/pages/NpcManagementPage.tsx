import { useCallback, useEffect, useState } from "react";

import { NpcModal } from "@/components/NpcModal";
import { NpcTagList } from "@/components/NpcTagList";
import { formatDateTime } from "@/lib/format";
import { useNpcStore } from "@/stores/npc-store";
import type { NpcFormPayload, NpcSummary } from "@/types/npc";

interface NpcModalState {
  mode: "view" | "edit" | "create";
  npc: NpcSummary | null;
}

/**
 * NPC 管理页面，以表格展示 NPC 列表及增删改查操作。
 */
export function NpcManagementPage() {
  const npcs = useNpcStore((state) => state.npcs);
  const listLoading = useNpcStore((state) => state.listLoading);
  const detailLoading = useNpcStore((state) => state.detailLoading);
  const submitting = useNpcStore((state) => state.submitting);
  const error = useNpcStore((state) => state.error);
  const loadNpcs = useNpcStore((state) => state.loadNpcs);
  const loadNpc = useNpcStore((state) => state.loadNpc);
  const createNpc = useNpcStore((state) => state.createNpc);
  const updateNpc = useNpcStore((state) => state.updateNpc);
  const deleteNpc = useNpcStore((state) => state.deleteNpc);
  const clearError = useNpcStore((state) => state.clearError);

  const [modalState, setModalState] = useState<NpcModalState | null>(null);

  useEffect(() => {
    void loadNpcs();
  }, [loadNpcs]);

  const handleOpenCreate = useCallback(() => {
    clearError();
    setModalState({ mode: "create", npc: null });
  }, [clearError]);

  const handleView = useCallback(
    async (npc: NpcSummary) => {
      clearError();
      setModalState({ mode: "view", npc });

      const detail = await loadNpc(npc.id);
      if (detail != null) {
        setModalState({ mode: "view", npc: detail });
      }
    },
    [clearError, loadNpc],
  );

  const handleEdit = useCallback(
    (npc: NpcSummary) => {
      clearError();
      setModalState({ mode: "edit", npc });
    },
    [clearError],
  );

  const handleCloseModal = useCallback(() => {
    if (submitting) {
      return;
    }
    clearError();
    setModalState(null);
  }, [clearError, submitting]);

  const handleCreate = useCallback(
    async (payload: NpcFormPayload) => {
      const created = await createNpc(payload);
      if (created != null) {
        setModalState(null);
      }
    },
    [createNpc],
  );

  const handleSave = useCallback(
    async (npcId: number, payload: NpcFormPayload) => {
      const updated = await updateNpc(npcId, payload);
      if (updated != null) {
        setModalState(null);
      }
    },
    [updateNpc],
  );

  const handleDelete = useCallback(
    async (npc: NpcSummary) => {
      const confirmed = window.confirm(`确定删除 NPC「${npc.name}」吗？此操作不可恢复。`);
      if (!confirmed) {
        return;
      }

      const deleted = await deleteNpc(npc.id);
      if (deleted) {
        setModalState((prev) => (prev?.npc?.id === npc.id ? null : prev));
      }
    },
    [deleteNpc],
  );

  const modalBusy = submitting;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>NPC管理</h1>
          <p className="page-desc">管理对话 NPC 角色与相关配置</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void loadNpcs()}>
            刷新
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            新建 NPC
          </button>
        </div>
      </header>

      {error && modalState == null ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card--flush">
        <div className="table-toolbar">
          <span className="table-toolbar-meta">
            {listLoading ? "加载中…" : `共 ${npcs.length} 个 NPC`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <colgroup>
              <col className="col-title" />
              <col className="col-tags" />
              <col className="col-desc" />
              <col className="col-date" />
              <col className="col-date" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">NPC名称</th>
                <th scope="col">标签</th>
                <th scope="col">人设描述</th>
                <th scope="col">创建时间</th>
                <th scope="col">更新时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td className="table-state" colSpan={6}>
                    正在加载 NPC 列表…
                  </td>
                </tr>
              ) : npcs.length === 0 ? (
                <tr>
                  <td className="table-state" colSpan={6}>
                    <div className="empty-state empty-state--table">
                      <p className="muted">暂无 NPC</p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleOpenCreate}
                      >
                        创建第一个 NPC
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                npcs.map((npc) => (
                  <tr key={npc.id}>
                    <td className="cell-title">{npc.name}</td>
                    <td className="cell-tags">
                      <NpcTagList tags={npc.tags ?? []} />
                    </td>
                    <td className="cell-desc">{npc.persona_description}</td>
                    <td className="col-date">{formatDateTime(npc.created_at)}</td>
                    <td className="col-date">{formatDateTime(npc.updated_at)}</td>
                    <td className="col-actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                          onClick={() => void handleView(npc)}
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                          onClick={() => handleEdit(npc)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={submitting}
                          onClick={() => void handleDelete(npc)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NpcModal
        open={modalState != null}
        mode={modalState?.mode ?? "view"}
        npc={modalState?.npc ?? null}
        submitting={modalBusy}
        detailLoading={modalState?.mode === "view" && detailLoading}
        error={modalState != null ? error : null}
        onClose={handleCloseModal}
        onCreate={(payload) => void handleCreate(payload)}
        onSave={(npcId, payload) => void handleSave(npcId, payload)}
      />
    </section>
  );
}
