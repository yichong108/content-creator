import { create } from "zustand";

import {
  createLiveSession as createLiveSessionApi,
  deleteLiveSession as deleteLiveSessionApi,
  fetchLiveSession,
  fetchLiveSessions,
  updateLiveSession as updateLiveSessionApi,
  updateLiveSessionEnabled as updateLiveSessionEnabledApi,
  updateLiveSessionRunning as updateLiveSessionRunningApi,
} from "@/api/live-sessions";
import { getRequestErrorMessage } from "@/lib/request";
import type {
  LiveSessionDetail,
  LiveSessionFormPayload,
  LiveSessionSummary,
} from "@/types/live-session";

interface LiveSessionState {
  /** 直播会话列表 */
  liveSessions: LiveSessionSummary[];
  /** 当前查看的直播会话详情 */
  currentLiveSession: LiveSessionDetail | null;
  /** 列表加载中 */
  listLoading: boolean;
  /** 详情加载中 */
  detailLoading: boolean;
  /** 表单提交中 */
  submitting: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 拉取直播会话列表 */
  loadLiveSessions: () => Promise<void>;
  /** 拉取指定直播会话详情 */
  loadLiveSession: (liveSessionId: number) => Promise<void>;
  /** 创建直播会话 */
  createLiveSession: (payload: LiveSessionFormPayload) => Promise<LiveSessionDetail | null>;
  /** 更新直播会话 */
  updateLiveSession: (
    liveSessionId: number,
    payload: LiveSessionFormPayload,
  ) => Promise<LiveSessionDetail | null>;
  /** 删除直播会话 */
  deleteLiveSession: (liveSessionId: number) => Promise<boolean>;
  /** 更新直播展示开关 */
  setEnabled: (liveSessionId: number, enabled: boolean) => Promise<boolean>;
  /** 更新直播运行状态 */
  setRunning: (liveSessionId: number, running: boolean) => Promise<boolean>;
  /** 清空当前详情 */
  clearCurrentLiveSession: () => void;
  /** 清空错误信息 */
  clearError: () => void;
}

/**
 * 直播会话管理 Zustand store，负责列表、详情与增删改状态。
 */
export const useLiveSessionStore = create<LiveSessionState>((set, get) => ({
  liveSessions: [],
  currentLiveSession: null,
  listLoading: false,
  detailLoading: false,
  submitting: false,
  error: null,

  loadLiveSessions: async () => {
    set({ listLoading: true, error: null });
    const result = await fetchLiveSessions();
    if (result.ok) {
      set({ liveSessions: result.data, listLoading: false });
      return;
    }
    set({ listLoading: false, error: getRequestErrorMessage(result) });
  },

  loadLiveSession: async (liveSessionId: number) => {
    set({ detailLoading: true, error: null });
    const result = await fetchLiveSession(liveSessionId);
    if (result.ok) {
      set({ currentLiveSession: result.data, detailLoading: false });
      return;
    }
    set({ detailLoading: false, error: getRequestErrorMessage(result) });
  },

  createLiveSession: async (payload: LiveSessionFormPayload) => {
    set({ submitting: true, error: null });
    const result = await createLiveSessionApi(payload);
    if (result.ok) {
      await get().loadLiveSessions();
      set({ submitting: false });
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  updateLiveSession: async (liveSessionId: number, payload: LiveSessionFormPayload) => {
    set({ submitting: true, error: null });
    const result = await updateLiveSessionApi(liveSessionId, payload);
    if (result.ok) {
      set({ currentLiveSession: result.data, submitting: false });
      await get().loadLiveSessions();
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  deleteLiveSession: async (liveSessionId: number) => {
    set({ submitting: true, error: null });
    const result = await deleteLiveSessionApi(liveSessionId);
    if (result.ok) {
      set({ submitting: false });
      await get().loadLiveSessions();
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  setEnabled: async (liveSessionId: number, enabled: boolean) => {
    set({ submitting: true, error: null });
    const result = await updateLiveSessionEnabledApi(liveSessionId, enabled);
    if (result.ok) {
      set({ submitting: false });
      await get().loadLiveSessions();
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  setRunning: async (liveSessionId: number, running: boolean) => {
    set({ submitting: true, error: null });
    const result = await updateLiveSessionRunningApi(liveSessionId, running);
    if (result.ok) {
      set({ submitting: false });
      await get().loadLiveSessions();
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  clearCurrentLiveSession: () => {
    set({ currentLiveSession: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
