import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { createLiveSession, fetchNpcs } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";
import type { NpcSummary } from "@/types/npc";

const DEFAULT_PEER_NPC_NAME = "豆包";
const DEFAULT_SELF_NPC_NAME = "我";
/** 己方专属 NPC 标签，对方侧不可选 */
const SELF_NPC_TAG = "我是NPC";

/** 发起会话时的角色侧别 */
export type StartSessionSide = "peer" | "self";

/**
 * 按侧别过滤可选 NPC 列表。
 *
 * 对方侧排除名称「我」及带「我是NPC」标签的角色。
 *
 * @param npcs - 全部 NPC 列表
 * @param side - 当前选择侧别
 * @returns 该侧别下可展示的 NPC 列表
 */
export function filterNpcsForSide(npcs: NpcSummary[], side: StartSessionSide): NpcSummary[] {
  if (side === "self") {
    return npcs;
  }

  return npcs.filter(
    (npc) => npc.name !== DEFAULT_SELF_NPC_NAME && !npc.tags.includes(SELF_NPC_TAG),
  );
}

export type StartSessionContextValue = {
  /** 全部 NPC 列表 */
  npcs: NpcSummary[];
  /** 是否正在加载 NPC 列表 */
  loading: boolean;
  /** 加载失败时的错误文案 */
  error: string | null;
  /** 当前选中的对方 NPC ID 列表 */
  peerNpcIds: number[];
  /** 当前选中的己方 NPC ID */
  selfNpcId: number | null;
  /** 设置对方 NPC 列表 */
  setPeerNpcIds: (npcIds: number[]) => void;
  /** 切换对方 NPC 选中状态 */
  togglePeerNpcId: (npcId: number) => void;
  /** 从对方列表移除指定 NPC */
  removePeerNpcId: (npcId: number) => void;
  /** 设置己方 NPC */
  setSelfNpcId: (npcId: number | null) => void;
  /** 清除己方 NPC 选中 */
  removeSelfNpc: () => void;
  /** 是否正在创建会话 */
  submitting: boolean;
  /** 创建失败时的错误文案 */
  submitError: string | null;
  /** 创建会话并进入聊天页 */
  handleSubmit: () => Promise<void>;
};

const StartSessionContext = createContext<StartSessionContextValue | null>(null);

/**
 * 按名称在 NPC 列表中查找 ID。
 *
 * @param npcs - NPC 列表
 * @param name - 目标名称
 * @returns 匹配的 NPC ID；未找到时返回 null
 */
function findNpcIdByName(npcs: NpcSummary[], name: string): number | null {
  return npcs.find((npc) => npc.name === name)?.id ?? null;
}

/**
 * 发起会话流程的共享状态 Provider。
 *
 * 负责拉取 NPC 列表、维护对方/己方选中项，以及创建会话。
 */
export function StartSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [npcs, setNpcs] = useState<NpcSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerNpcIds, setPeerNpcIds] = useState<number[]>([]);
  const [selfNpcId, setSelfNpcId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchNpcs()
      .then((res) => {
        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setError(getRequestErrorMessage(res));
          return;
        }

        const list = res.data ?? [];
        setNpcs(list);
        const defaultPeerId = findNpcIdByName(list, DEFAULT_PEER_NPC_NAME);
        setPeerNpcIds(defaultPeerId != null ? [defaultPeerId] : []);
        setSelfNpcId(findNpcIdByName(list, DEFAULT_SELF_NPC_NAME));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const togglePeerNpcId = (npcId: number) => {
    setPeerNpcIds((current) =>
      current.includes(npcId) ? current.filter((id) => id !== npcId) : [...current, npcId],
    );
  };

  const removePeerNpcId = (npcId: number) => {
    setPeerNpcIds((current) => current.filter((id) => id !== npcId));
  };

  const removeSelfNpc = () => {
    setSelfNpcId(null);
  };

  const handleSubmit = async () => {
    if (peerNpcIds.length === 0 && selfNpcId == null) {
      setSubmitError("请至少选择对方或己方");
      return;
    }

    const peerNpcs = peerNpcIds
      .map((id) => npcs.find((npc) => npc.id === id))
      .filter((npc): npc is NpcSummary => npc != null);
    const title =
      peerNpcs.length > 0
        ? peerNpcs.map((npc) => npc.name).join("、")
        : (npcs.find((npc) => npc.id === selfNpcId)?.name ?? "新会话");

    setSubmitting(true);
    setSubmitError(null);

    const result = await createLiveSession({
      title,
      peer_npc_ids: peerNpcIds,
      self_npc_id: selfNpcId,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(getRequestErrorMessage(result));
      return;
    }

    navigate(`/chatPage/${result.data.id}`);
  };

  return (
    <StartSessionContext.Provider
      value={{
        npcs,
        loading,
        error,
        peerNpcIds,
        selfNpcId,
        setPeerNpcIds,
        togglePeerNpcId,
        removePeerNpcId,
        setSelfNpcId,
        removeSelfNpc,
        submitting,
        submitError,
        handleSubmit,
      }}
    >
      {children}
    </StartSessionContext.Provider>
  );
}

/**
 * 读取发起会话流程的共享状态。
 *
 * @returns 发起会话上下文
 * @throws 在 Provider 外使用时抛出
 */
export function useStartSession(): StartSessionContextValue {
  const context = useContext(StartSessionContext);
  if (!context) {
    throw new Error("useStartSession must be used within StartSessionProvider");
  }
  return context;
}
