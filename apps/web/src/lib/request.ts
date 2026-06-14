/**
 * 统一 API 请求库，基于 axios 实现。
 * 统一处理HTTP状态码
 * 统一返回Result结构
 *
 * @example result结构示例
 * {
 *   ok: true,
 *   data: {
 *     code: 0,
 *     message: "ok",
 *     data: {
 *       name: "John",
 *     },
 *   },
 * }
 * {
 *   ok: false,
 *   error: {
 *     code: 40101,
 *     message: "未授权",
 *   },
 * }
 * {
 *   ok: false,
 *   error: {
 *     code: 40001,
 *     message: "请求参数错误",
 *   },
 * }
 *
 * @example
 * const result = await request({ url: "/api/chat-items" });
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 *
 * const result = await request({ url: "/api/chat-items", method: "POST", data: { name: "John" } });
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 *
 * @example 业务错误码code处理
 * const result = await request({ url: "/api/chat-items" });
 * if (result.ok) {
 * } else {
 *  if (result.error.code === 40101) {
 *    console.log("未授权");
 *  } else {
 *    console.error(result.error);
 *  }
 * }
 *
 */

import axios, { type AxiosRequestConfig, isAxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * - `code === 0`：业务成功，`data` 为业务载荷
 * - `code !== 0`：业务失败，`data` 为 null
 *
 * 注意：`code` 是业务错误码，不是 HTTP 状态码；HTTP 状态在响应行单独返回。
 */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

/** 业务成功码*/
export const API_SUCCESS_CODE = 0;

/**
 * 判断未知 JSON 是否符合 ApiEnvelope 结构。
 *
 * @param value - 待检查的响应体
 */
export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    "code" in value &&
    typeof value.code === "number" &&
    "message" in value &&
    typeof value.message === "string" &&
    "data" in value
  );
}

/**
 * API 请求结果 — 拦截器直接返回该结构，不通过 throw 传递错误。
 *
 * @typeParam T - 成功时的业务数据类型
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: RequestError };

/**
 * 统一 API 错误类型。
 *
 * - `status`：HTTP 响应状态码（协议层）
 * - `code`：业务错误码（body.code，与 HTTP 无关）
 */
export class RequestError extends Error {
  readonly status?: number;
  readonly code?: number;

  constructor(message: string, status?: number, code?: number) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

/**
 * 将 ``ApiEnvelope`` 转为 ``Result``。
 *
 * @typeParam T - 业务数据类型
 * @param body - 原始响应 JSON
 * @param status - HTTP 状态码
 */
function envelopeToResult<T>(body: unknown, status: number): Result<T> {
  if (!isApiEnvelope(body)) {
    return { ok: false, error: new RequestError("响应格式错误", status) };
  }

  if (body.code !== API_SUCCESS_CODE) {
    return { ok: false, error: new RequestError(body.message, status, body.code) };
  }

  if (body.data === null || body.data === undefined) {
    return { ok: false, error: new RequestError("响应数据为空", status) };
  }

  return { ok: true, data: body.data as T };
}

/**
 * 从 axios 网络错误响应中解析 ``Result``（兜底路径）。
 *
 * @param error - axios 或未知错误
 */
function networkErrorToResult(error: unknown): Result<never> {
  if (isAxiosError(error) && error.response) {
    return envelopeToResult(error.response.data, error.response.status);
  }

  const message = isAxiosError(error) && error.message ? error.message : "请求失败";
  return { ok: false, error: new RequestError(message) };
}

const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.response.use(
  (response) => envelopeToResult(response.data, response.status) as never,
  (error: unknown) => Promise.resolve(networkErrorToResult(error)) as never,
);

/**
 * 发起 API 请求，参数与 axios 的 ``AxiosRequestConfig`` 一致，返回 ``Result<T>``。
 *
 * @typeParam T - 业务数据类型
 * @param config - axios 请求配置（url、method、headers、data 等）
 * @returns 拦截器解包后的 Result
 */
export function request<T>(config: AxiosRequestConfig): Promise<Result<T>> {
  return client.request(config) as unknown as Promise<Result<T>>;
}
