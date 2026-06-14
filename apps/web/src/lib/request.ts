/**
 * 统一后端返回的数据格式
 * 统一处理request请求的返回结果
 */

import axios, { type AxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 服务端数据格式
 */
export interface ApiEnvelope<T> {
  // 业务状态，正常为0
  code: number;
  // 业务描述
  message: string;
  // 业务用到的数据
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

export type RequestResult<T> =
  | {
      // 表示无网络或系统错误，正常为 true
      ok: true;
      // API返回的数据
      data: ApiEnvelope<T> | null | undefined;
    }
  | {
      ok: false;
    };

const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * 发起 API 请求，参数与 axios 的 ``AxiosRequestConfig`` 一致，返回 ``ApiEnvelope<T>``。
 *
 * @typeParam T - 业务 data 类型（对应 envelope.data 成功时的类型）
 * @param config - axios 请求配置（url、method、headers、data 等）
 */
export function request<T>(config: AxiosRequestConfig): Promise<RequestResult<T>> {
  return client
    .request(config)
    .then((response): RequestResult<T> => {
      if (!isApiEnvelope(response.data)) {
        console.error("请求出错了，接口返回数据不符合结构", response.data);
        return { ok: false };
      }

      if (response.status === 200) {
        return { ok: true, data: response.data as ApiEnvelope<T> };
      }

      console.error("请求出错了", response);
      return { ok: false };
    })
    .catch((error) => {
      console.error("请求出错了", error);
      return { ok: false };
    });
}
