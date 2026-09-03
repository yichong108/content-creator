"""业务错误码定义。

``code`` 为应用层错误码，与 HTTP 响应状态码相互独立：

- HTTP 状态码：正常 API 响应固定 ``200``；仅未匹配路由等由框架返回非 200
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


def http_status_for_business_code(business_code: int) -> int:
    """将业务错误码映射为 HTTP 状态码。

    Args:
        business_code: 业务错误码。

    Returns:
        对应的 HTTP 状态码；``API_SUCCESS_CODE`` 为 200，无映射时返回 500。
    """
    if business_code == API_SUCCESS_CODE:
        return 200

    for http_status, code in _HTTP_TO_BUSINESS.items():
        if code == business_code:
            return http_status

    return 500
