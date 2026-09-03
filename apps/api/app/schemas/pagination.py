from pydantic import BaseModel, Field


class PageResult[T](BaseModel):
    """通用分页结果。

    作为 ``ApiResponse`` 的 ``data`` 返回，供各列表接口复用同一分页结构。
    """

    items: list[T] = Field(description="当前页数据列表")
    total: int = Field(description="总记录数")
    page: int = Field(description="当前页码，从 1 开始")
    page_size: int = Field(description="每页记录数")
