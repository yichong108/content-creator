"""AI 提供商统一异常类型。"""


class AiConfigurationError(Exception):
    """AI 配置缺失或无效。"""


class AiAuthenticationError(Exception):
    """API Key 无效或无权访问。"""


class AiConnectionError(Exception):
    """无法连接 AI 服务。"""


class AiUnavailableError(Exception):
    """AI 服务返回错误状态或暂时不可用。"""


class AiResponseError(Exception):
    """AI 返回空结果或无法解析的响应。"""
