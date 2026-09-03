import { useEffect } from "react";

import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/stores/auth-store";

/**
 * 登录路由守卫：未登录跳转登录页，已登录渲染子路由。
 *
 * 挂载时用现有令牌调用 /auth/me 校验有效性；
 * 令牌过期由请求层 401 拦截器兜底跳转登录页。
 */
export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadMe = useAuthStore((state) => state.loadMe);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
