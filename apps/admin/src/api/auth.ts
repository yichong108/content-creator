import { request, type RequestResult } from "@/lib/request";
import type { AdminUserSummary, LoginPayload, LoginResponse } from "@/types/auth";

/**
 * 管理员登录。
 *
 * @param payload - 用户名与密码
 * @returns 成功时返回含 JWT 令牌的登录响应
 */
export function login(payload: LoginPayload): Promise<RequestResult<LoginResponse>> {
  return request<LoginResponse>({
    url: "/api/admin/auth/login",
    method: "POST",
    data: payload,
  });
}

/**
 * 获取当前登录管理员信息（校验令牌有效性）。
 *
 * @returns 当前管理员账号摘要
 */
export function fetchMe(): Promise<RequestResult<AdminUserSummary>> {
  return request<AdminUserSummary>({
    url: "/api/admin/auth/me",
    method: "GET",
  });
}
