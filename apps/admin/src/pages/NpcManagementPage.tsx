import { useCallback, useEffect, useState } from "react";

import { Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import { NpcAvatar } from "@/components/NpcAvatar";
import { NpcModal } from "@/components/NpcModal";
import { NpcTagList } from "@/components/NpcTagList";
import { formatDateTime } from "@/lib/format";
import { useNpcStore } from "@/stores/npc-store";
import type { NpcFormOptions, NpcFormPayload, NpcSummary } from "@/types/npc";

interface NpcModalState {
  mode: "view" | "edit" | "create";
  npc: NpcSummary | null;
}

/**
 * NPC 管理页面，使用 antd Table 展示 NPC 列表及增删改查操作。
 */
export function NpcManagementPage() {
  const npcs = useNpcStore((state) => state.npcs);
  const total = useNpcStore((state) => state.total);
  const page = useNpcStore((state) => state.page);
  const pageSize = useNpcStore((state) => state.pageSize);
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
    async (payload: NpcFormPayload, options?: NpcFormOptions) => {
      const created = await createNpc(payload, options);
      if (created != null) {
        setModalState(null);
      }
    },
    [createNpc],
  );

  const handleSave = useCallback(
    async (npcId: number, payload: NpcFormPayload, options?: NpcFormOptions) => {
      const updated = await updateNpc(npcId, payload, options);
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleGotoPage = useCallback(
    (target: number) => {
      if (listLoading || target < 1 || target > totalPages || target === page) {
        return;
      }
      void loadNpcs(target, pageSize);
    },
    [listLoading, totalPages, page, loadNpcs, pageSize],
  );

  const columns: ColumnsType<NpcSummary> = [
    {
      title: "头像",
      dataIndex: "avatar_url",
      key: "avatar",
      width: 80,
      align: "center",
      render: (_, npc) => <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} size={36} />,
    },
    {
      title: "NPC名称",
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (name: string) => <span className="cell-title">{name}</span>,
    },
    {
      title: "标签",
      dataIndex: "tags",
      key: "tags",
      render: (tags: string[]) => <NpcTagList tags={tags ?? []} />,
    },
    {
      title: "人设描述",
      dataIndex: "persona_description",
      key: "persona_description",
      ellipsis: true,
      render: (description: string) => (
        <span className="cell-desc" title={description}>
          {description}
        </span>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (value: string) => <span className="col-date">{formatDateTime(value)}</span>,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 180,
      render: (value: string) => <span className="col-date">{formatDateTime(value)}</span>,
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, npc) => (
        <div className="table-actions">
          <Button size="small" disabled={submitting} onClick={() => void handleView(npc)}>
            查看
          </Button>
          <Button size="small" disabled={submitting} onClick={() => handleEdit(npc)}>
            编辑
          </Button>
          <Button size="small" danger disabled={submitting} onClick={() => void handleDelete(npc)}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header page-header--bare">
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
        <Table<NpcSummary>
          rowKey="id"
          columns={columns}
          dataSource={npcs}
          loading={listLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (totalCount) => `共 ${totalCount} 个 NPC`,
            onChange: handleGotoPage,
          }}
          locale={{
            emptyText: (
              <div className="empty-state empty-state--table">
                <p className="muted">暂无 NPC</p>
                <Button type="primary" onClick={handleOpenCreate}>
                  创建第一个 NPC
                </Button>
              </div>
            ),
          }}
        />
      </div>

      <NpcModal
        open={modalState != null}
        mode={modalState?.mode ?? "view"}
        npc={modalState?.npc ?? null}
        submitting={modalBusy}
        detailLoading={modalState?.mode === "view" && detailLoading}
        error={modalState != null ? error : null}
        onClose={handleCloseModal}
        onCreate={(payload, options) => void handleCreate(payload, options)}
        onSave={(npcId, payload, options) => void handleSave(npcId, payload, options)}
      />
    </section>
  );
}
