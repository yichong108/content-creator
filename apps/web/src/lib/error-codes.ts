/**
 * 与后端 ``app/schemas/error_codes.py`` 对齐的业务错误码。
 *
 * 编码规则：HTTP 类别 × 100 + 序号，例如 ``40101`` 表示未授权类第 1 号错误。
 */

/** 业务成功码（与 HTTP 200 独立，body 内 ``code`` 为 0 表示成功） */
export const API_SUCCESS_CODE = 0;

/** 请求参数错误 */
export const ERR_BAD_REQUEST = 40001;

/** 未登录或登录已过期 */
export const ERR_UNAUTHORIZED = 40101;

/** 没有访问权限 */
export const ERR_FORBIDDEN = 40301;

/** 资源不存在 */
export const ERR_NOT_FOUND = 40401;

/** 请求数据校验失败 */
export const ERR_VALIDATION = 42201;

/** 服务器内部错误 */
export const ERR_INTERNAL = 50001;

/**
 * 从五位数业务错误码提取 HTTP 类别（前三位）。
 *
 * 用于按大类统一处理，例如所有 ``401xx`` 跳转登录。
 *
 * @param code - 业务错误码
 * @returns HTTP 类别，如 ``40101`` 返回 ``401``
 */
export function errorCategory(code: number): number {
  return Math.floor(code / 100);
}
