import { create } from "zustand";

import {
  createSession as createSessionApi,
  deleteSession as deleteSessionApi,
  fetchSession,
  fetchSessions,
  updateSession as updateSessionApi,
} from "@/api/sessions";
import { getRequestErrorMessage } from "@/lib/request";
import type { SessionDetail, SessionFormPayload, SessionSummary } from "@/types/session";

interface SessionState {
  /** 会话列表 */
  sessions: SessionSummary[];
  /** 当前查看的会话详情 */
  currentSession: SessionDetail | null;
  /** 列表加载中 */
  listLoading: boolean;
  /** 详情加载中 */
  detailLoading: boolean;
  /** 表单提交中 */
  submitting: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 拉取会话列表 */
  loadSessions: () => Promise<void>;
  /** 拉取指定会话详情 */
  loadSession: (sessionId: number) => Promise<void>;
  /** 创建会话 */
  createSession: (payload: SessionFormPayload) => Promise<SessionDetail | null>;
  /** 更新会话 */
  updateSession: (sessionId: number, payload: SessionFormPayload) => Promise<SessionDetail | null>;
  /** 删除会话 */
  deleteSession: (sessionId: number) => Promise<boolean>;
  /** 清空当前详情 */
  clearCurrentSession: () => void;
  /** 清空错误信息 */
  clearError: () => void;
}

/**
 * 会话管理 Zustand store，负责列表、详情与增删改状态。
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  listLoading: false,
  detailLoading: false,
  submitting: false,
  error: null,

  loadSessions: async () => {
    set({ listLoading: true, error: null });
    const result = await fetchSessions();
    if (result.ok) {
      set({ sessions: result.data, listLoading: false });
      return;
    }
    set({ listLoading: false, error: getRequestErrorMessage(result) });
  },

  loadSession: async (sessionId: number) => {
    set({ detailLoading: true, error: null });
    const result = await fetchSession(sessionId);
    if (result.ok) {
      set({ currentSession: result.data, detailLoading: false });
      return;
    }
    set({ detailLoading: false, error: getRequestErrorMessage(result) });
  },

  createSession: async (payload: SessionFormPayload) => {
    set({ submitting: true, error: null });
    const result = await createSessionApi(payload);
    if (result.ok) {
      await get().loadSessions();
      set({ submitting: false });
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  updateSession: async (sessionId: number, payload: SessionFormPayload) => {
    set({ submitting: true, error: null });
    const result = await updateSessionApi(sessionId, payload);
    if (result.ok) {
      set({ currentSession: result.data, submitting: false });
      await get().loadSessions();
      return result.data;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return null;
  },

  deleteSession: async (sessionId: number) => {
    set({ submitting: true, error: null });
    const result = await deleteSessionApi(sessionId);
    if (result.ok) {
      set({ submitting: false });
      await get().loadSessions();
      return true;
    }
    set({ submitting: false, error: getRequestErrorMessage(result) });
    return false;
  },

  clearCurrentSession: () => {
    set({ currentSession: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
