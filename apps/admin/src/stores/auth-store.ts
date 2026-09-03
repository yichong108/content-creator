import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchMe, login as loginApi } from "@/api/auth";
import { getAuthToken, setAuthToken } from "@/lib/auth-token";
import { getRequestErrorMessage } from "@/lib/request";
import type { AdminUserSummary, LoginPayload } from "@/types/auth";

interface AuthState {
  /** 当前登录的管理员账号；未登录为 null */
  user: AdminUserSummary | null;
  /** 是否已登录（以是否存在访问令牌判断） */
  isAuthenticated: () => boolean;
  /**
   * 登录。
   *
   * @param payload - 用户名与密码
   * @returns 登录失败时的错误文案；成功返回 null
   */
  login: (payload: LoginPayload) => Promise<string | null>;
  /** 退出登录：清除令牌与本地用户信息 */
  logout: () => void;
  /** 用现有令牌拉取当前用户，校验令牌有效性 */
  loadMe: () => Promise<void>;
}

/**
 * 后台登录状态 store。
 *
 * 令牌本体存于 localStorage（见 lib/auth-token），仅用于请求携带与登录态判断；
 * 本 store 负责登录/退出动作与用户信息展示，用户信息通过 persist 持久化。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      isAuthenticated: () => getAuthToken() != null,

      login: async (payload) => {
        const result = await loginApi(payload);
        if (!result.ok) {
          return getRequestErrorMessage(result);
        }
        setAuthToken(result.data.token);
        set({ user: result.data.user });
        return null;
      },

      logout: () => {
        setAuthToken(null);
        set({ user: null });
      },

      loadMe: async () => {
        if (getAuthToken() == null) {
          return;
        }
        const result = await fetchMe();
        if (result.ok) {
          set({ user: result.data });
        }
      },
    }),
    {
      name: "contentcreator_admin_auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
