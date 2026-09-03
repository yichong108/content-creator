import { create } from "zustand";

import {
  createNpc as createNpcApi,
  deleteNpc as deleteNpcApi,
  fetchAllNpcs,
  fetchNpc as fetchNpcApi,
  fetchNpcs,
  updateNpc as updateNpcApi,
  uploadNpcAvatar as uploadNpcAvatarApi,
} from "@/api/npcs";
import { getRequestErrorMessage } from "@/lib/request";
import type { NpcFormOptions, NpcFormPayload, NpcSummary } from "@/types/npc";
import { NPC_PAGE_SIZE } from "@/types/npc";

interface NpcState {
  /** NPC 列表（当前页） */
  npcs: NpcSummary[];
  /** NPC 总数 */
  total: number;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页记录数 */
  pageSize: number;
  /** 全部 NPC 列表（供表单下拉等场景使用） */
  allNpcs: NpcSummary[];
  /** 全部 NPC 加载中 */
  allNpcsLoading: boolean;
  /** 列表加载中 */
  listLoading: boolean;
  /** 详情加载中 */
  detailLoading: boolean;
  /** 表单提交中 */
  submitting: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 拉取 NPC 列表 */
  loadNpcs: (page?: number, pageSize?: number) => Promise<void>;
  /** 拉取全部 NPC 列表 */
  loadAllNpcs: () => Promise<void>;
  /** 拉取指定 NPC 详情 */
  loadNpc: (npcId: number) => Promise<NpcSummary | null>;
  /** 创建 NPC */
  createNpc: (payload: NpcFormPayload, options?: NpcFormOptions) => Promise<NpcSummary | null>;
  /** 更新 NPC */
  updateNpc: (
    npcId: number,
    payload: NpcFormPayload,
    options?: NpcFormOptions,
  ) => Promise<NpcSummary | null>;
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
  total: 0,
  page: 1,
  pageSize: NPC_PAGE_SIZE,
  allNpcs: [],
  allNpcsLoading: false,
  listLoading: false,
  detailLoading: false,
  submitting: false,
  error: null,

  loadNpcs: async (page: number = get().page, pageSize: number = get().pageSize) => {
    set({ listLoading: true, error: null, page, pageSize });
    const result = await fetchNpcs(page, pageSize);
    if (result.ok) {
      set({ npcs: result.data.items, total: result.data.total, listLoading: false });
      return;
    }
    set({ listLoading: false, error: getRequestErrorMessage(result) });
  },

  loadAllNpcs: async () => {
    set({ allNpcsLoading: true });
    const result = await fetchAllNpcs();
    set({ allNpcs: result.ok ? result.data : [], allNpcsLoading: false });
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

  createNpc: async (payload: NpcFormPayload, options?: NpcFormOptions) => {
    set({ submitting: true, error: null });
    const result = await createNpcApi(payload);
    if (!result.ok) {
      set({ submitting: false, error: getRequestErrorMessage(result) });
      return null;
    }

    let npc = result.data;
    if (options?.avatarFile) {
      const uploadResult = await uploadNpcAvatarApi(npc.id, options.avatarFile);
      if (!uploadResult.ok) {
        set({ submitting: false, error: getRequestErrorMessage(uploadResult) });
        await get().loadNpcs();
        return npc;
      }
      npc = uploadResult.data;
    }

    await get().loadNpcs();
    set({ submitting: false });
    return npc;
  },

  updateNpc: async (npcId: number, payload: NpcFormPayload, options?: NpcFormOptions) => {
    set({ submitting: true, error: null });
    const result = await updateNpcApi(npcId, payload);
    if (!result.ok) {
      set({ submitting: false, error: getRequestErrorMessage(result) });
      return null;
    }

    let npc = result.data;
    if (options?.avatarFile) {
      const uploadResult = await uploadNpcAvatarApi(npcId, options.avatarFile);
      if (!uploadResult.ok) {
        set({ submitting: false, error: getRequestErrorMessage(uploadResult) });
        await get().loadNpcs();
        return npc;
      }
      npc = uploadResult.data;
    }

    await get().loadNpcs();
    set({ submitting: false });
    return npc;
  },

  deleteNpc: async (npcId: number) => {
    set({ submitting: true, error: null });
    const result = await deleteNpcApi(npcId);
    if (result.ok) {
      set({ submitting: false });
      const { page, pageSize, total } = get();
      // 删除后若当前页超出新的最大页码，则回退一页，避免停留空页
      const lastPage = Math.max(1, Math.ceil((total - 1) / pageSize));
      await get().loadNpcs(Math.max(1, Math.min(page, lastPage)));
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  clearError: () => {
    set({ error: null });
  },
}));
