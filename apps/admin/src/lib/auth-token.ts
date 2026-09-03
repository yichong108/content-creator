/** 管理后台 token 在 localStorage 中的存储键 */
const AUTH_TOKEN_KEY = "contentcreator_admin_token";

/**
 * 读取当前访问令牌。
 *
 * token 以模块级单例形式缓存在内存中，初始化时从 localStorage 恢复，
 * 避免每次请求都访问 localStorage。
 *
 * @returns 当前 token；未登录时返回 null
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * 写入或清除访问令牌。
 *
 * @param token - 新 token；传 null 表示退出登录
 */
export function setAuthToken(token: string | null): void {
  if (token == null) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}
