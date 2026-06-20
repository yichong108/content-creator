import { NpcAvatar } from "@/components/NpcAvatar";
import type { NpcSummary } from "@/types/npc";

interface SessionNpcFieldsProps {
  /** 全部 NPC 列表 */
  npcs: NpcSummary[];
  /** NPC 列表是否加载中 */
  listLoading: boolean;
  /** 当前选中的对方 NPC ID 列表 */
  peerNpcIds: number[];
  /** 当前选中的己方 NPC ID */
  selfNpcId: number | null;
  /** 对方 NPC 变更回调 */
  onPeerNpcChange: (npcIds: number[]) => void;
  /** 己方 NPC 变更回调 */
  onSelfNpcChange: (npcId: number | null) => void;
  /** 是否禁用交互 */
  disabled?: boolean;
}

/**
 * 渲染单个 NPC 单选列表。
 */
function NpcSingleSelect({
  npcs,
  groupName,
  selectedId,
  onChange,
  disabled = false,
}: {
  npcs: NpcSummary[];
  groupName: string;
  selectedId: number | null;
  onChange: (npcId: number | null) => void;
  disabled?: boolean;
}) {
  if (npcs.length === 0) {
    return <p className="muted">暂无 NPC，请先在 NPC 管理中创建</p>;
  }

  return (
    <div className="npc-picker">
      <label className="npc-picker-item">
        <input
          type="radio"
          name={groupName}
          checked={selectedId == null}
          disabled={disabled}
          onChange={() => onChange(null)}
        />
        <span className="npc-picker-name">不设置</span>
      </label>
      {npcs.map((npc) => (
        <label key={npc.id} className="npc-picker-item">
          <input
            type="radio"
            name={groupName}
            checked={selectedId === npc.id}
            disabled={disabled}
            onChange={() => onChange(npc.id)}
          />
          <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} size={32} />
          <span className="npc-picker-name">{npc.name}</span>
          <span className="npc-picker-meta">{npc.chat_item_count} 条对话</span>
        </label>
      ))}
    </div>
  );
}

/**
 * 渲染 NPC 多选列表。
 */
function NpcMultiSelect({
  npcs,
  selectedIds,
  onChange,
  disabled = false,
}: {
  npcs: NpcSummary[];
  selectedIds: number[];
  onChange: (npcIds: number[]) => void;
  disabled?: boolean;
}) {
  if (npcs.length === 0) {
    return <p className="muted">暂无 NPC，请先在 NPC 管理中创建</p>;
  }

  return (
    <div className="npc-picker">
      {npcs.map((npc) => {
        const checked = selectedIds.includes(npc.id);

        return (
          <label key={npc.id} className="npc-picker-item">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange(checked ? selectedIds : [...selectedIds, npc.id]);
                  return;
                }
                onChange(selectedIds.filter((id) => id !== npc.id));
              }}
            />
            <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} size={32} />
            <span className="npc-picker-name">{npc.name}</span>
            <span className="npc-picker-meta">{npc.chat_item_count} 条对话</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * 会话表单中的对方/己方 NPC 选择区。
 */
export function SessionNpcFields({
  npcs,
  listLoading,
  peerNpcIds,
  selfNpcId,
  onPeerNpcChange,
  onSelfNpcChange,
  disabled = false,
}: SessionNpcFieldsProps) {
  return (
    <>
      <div className="form-field">
        <span className="form-label">对方</span>
        <span className="form-hint">可多选；选中后按顺序合并各 NPC 的 incoming 侧对话</span>
        {listLoading && npcs.length === 0 ? (
          <p className="muted">加载 NPC 列表…</p>
        ) : (
          <NpcMultiSelect
            npcs={npcs}
            selectedIds={peerNpcIds}
            onChange={onPeerNpcChange}
            disabled={disabled}
          />
        )}
      </div>

      <div className="form-field">
        <span className="form-label">己方</span>
        <span className="form-hint">可选；选中后将其 outgoing 侧对话合并到聊天记录</span>
        {listLoading && npcs.length === 0 ? (
          <p className="muted">加载 NPC 列表…</p>
        ) : (
          <NpcSingleSelect
            npcs={npcs}
            groupName="self-npc"
            selectedId={selfNpcId}
            onChange={onSelfNpcChange}
            disabled={disabled}
          />
        )}
      </div>
    </>
  );
}
