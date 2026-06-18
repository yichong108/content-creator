import { create } from "zustand";

import {
  createNpc as createNpcApi,
  deleteNpc as deleteNpcApi,
  fetchNpc as fetchNpcApi,
  fetchNpcs,
  updateNpc as updateNpcApi,
} from "@/api/npcs";
import { getRequestErrorMessage } from "@/lib/request";
import type { NpcFormPayload, NpcSummary } from "@/types/npc";

interface NpcState {
  /** NPC 列表 */
  npcs: NpcSummary[];
  /** 列表加载中 */
  listLoading: boolean;
  /** 详情加载中 */
  detailLoading: boolean;
  /** 表单提交中 */
  submitting: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 拉取 NPC 列表 */
  loadNpcs: () => Promise<void>;
  /** 拉取指定 NPC 详情 */
  loadNpc: (npcId: number) => Promise<NpcSummary | null>;
  /** 创建 NPC */
  createNpc: (payload: NpcFormPayload) => Promise<NpcSummary | null>;
  /** 更新 NPC */
  updateNpc: (npcId: number, payload: NpcFormPayload) => Promise<NpcSummary | null>;
  /** 删除 NPC */
  deleteNpc: (npcId: number) => Promise<boolean>;
  /** 清空错误信息 */
  clearError: () => void;
}

/**
 * NPC 管理 Zustand store，负责列表与增删改状态。
 */
export const useNpcStore = create<NpcState>((set, get) => ({
  npcs: [],
  listLoading: false,
  detailLoading: false,
  submitting: false,
  error: null,

  loadNpcs: async () => {
    set({ listLoading: true, error: null });
    const result = await fetchNpcs();
    if (result.ok) {
      set({ npcs: result.data, listLoading: false });
      return;
    }
    set({ listLoading: false, error: getRequestErrorMessage(result) });
  },

  loadNpc: async (npcId: number) => {
    set({ detailLoading: true, error: null });
    const result = await fetchNpcApi(npcId);
    if (result.ok) {
      set({ detailLoading: false });
      return result.data;
    }
    set({ detailLoading: false, error: getRequestErrorMessage(result) });
    return null;
  },

  createNpc: async (payload: NpcFormPayload) => {
    set({ submitting: true, error: null });
    const result = await createNpcApi(payload);
    if (result.ok) {
      await get().loadNpcs();
      set({ submitting: false });
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  updateNpc: async (npcId: number, payload: NpcFormPayload) => {
    set({ submitting: true, error: null });
    const result = await updateNpcApi(npcId, payload);
    if (result.ok) {
      await get().loadNpcs();
      set({ submitting: false });
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  deleteNpc: async (npcId: number) => {
    set({ submitting: true, error: null });
    const result = await deleteNpcApi(npcId);
    if (result.ok) {
      set({ submitting: false });
      await get().loadNpcs();
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  clearError: () => {
    set({ error: null });
  },
}));
