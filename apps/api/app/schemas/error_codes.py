"""业务错误码定义。

``code`` 为应用层错误码，与 HTTP 响应状态码相互独立：

- HTTP 状态码：传输/协议层（401、404、500 等）
- ``code``：业务语义（``0`` 成功；``40001``、``40101`` 等失败）

编码规则：``HTTP 类别 * 100 + 序号``，例如 ``40101`` 表示未授权类第 1 号错误。
"""

# 成功
API_SUCCESS_CODE = 0

# 客户端 / 权限
ERR_BAD_REQUEST = 40001
ERR_UNAUTHORIZED = 40101
ERR_FORBIDDEN = 40301
ERR_NOT_FOUND = 40401
ERR_VALIDATION = 42201

# 服务端
ERR_INTERNAL = 50001

# HTTP 状态码 → 默认业务错误码（未知 HTTP 状态回退为 ERR_INTERNAL）
_HTTP_TO_BUSINESS: dict[int, int] = {
    400: ERR_BAD_REQUEST,
    401: ERR_UNAUTHORIZED,
    403: ERR_FORBIDDEN,
    404: ERR_NOT_FOUND,
    422: ERR_VALIDATION,
    500: ERR_INTERNAL,
}


def business_code_for_http(http_status: int) -> int:
    """将 HTTP 状态码映射为默认业务错误码。

    Args:
        http_status: HTTP 响应状态码。

    Returns:
        对应的业务错误码；无映射时返回 ``ERR_INTERNAL``。
    """
    return _HTTP_TO_BUSINESS.get(http_status, ERR_INTERNAL)
