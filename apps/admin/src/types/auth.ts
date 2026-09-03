/**
 * 管理员账号摘要（不含敏感字段）。
 */
export interface AdminUserSummary {
  id: number;
  /** 管理员用户名 */
  username: string;
  created_at: string;
}

/**
 * 登录成功响应，携带访问令牌与账号信息。
 */
export interface LoginResponse {
  /** JWT 访问令牌 */
  token: string;
  /** 令牌类型，固定为 bearer */
  token_type: string;
  /** 令牌过期时间 */
  expires_at: string;
  /** 当前登录的管理员账号 */
  user: AdminUserSummary;
}

/**
 * 登录请求体。
 */
export interface LoginPayload {
  username: string;
  password: string;
}
