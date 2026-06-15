/**
 * 统一后端返回的数据格式 {@link ApiEnvelope}
 * 统一处理 request 请求的返回结果 {@link RequestResult}
 *
 * @example request
 * const result = await request({
 *   url: "/api/chat",
 *   method: "POST",
 *   data: {
 *     messages: [
 *       { role: "user", content: "Hello, world!" }
 *     ]
 *   }
 * });
 *
 * @example result
 * {
 *   ok: true,
 *   data: {
 *     message: "Hello, world!"
 *   }
 * }
 *
 * @example result
 * {
 *   ok: false,
 *   kind: "network",
 * }
 *
 * @example result
 * {
 *   ok: false,
 *   kind: "business",
 *   code: 40001,
 *   message: "请求参数错误"
 * }
 */

import axios, { type AxiosRequestConfig } from "axios";

const API_SUCCESS_CODE = 0;

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 服务端统一响应信封格式。
 */
interface ApiEnvelope<T> {
  /** 业务状态码，非 HTTP 状态码；成功为 {@link API_SUCCESS_CODE} */
  code: number;
  /** 人类可读描述 */
  message: string;
  /** 业务数据；失败时为 null */
  data: T | null;
}

/**
 * 判断未知 JSON 是否符合 ApiEnvelope 结构。
 *
 * @param value - 待检查的响应体
 * @returns 是否为合法 envelope
 */
function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
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

/** 请求失败时的联合类型（不含成功分支） */
export type RequestFailure =
  | {
      ok: false;
      /** 断网、超时、响应体结构异常等传输层错误 */
      kind: "network";
    }
  | {
      ok: false;
      /** HTTP 200 但 body.code 为五位数等业务错误码 */
      kind: "business";
      code: number;
      message: string;
    };

/**
 * API 请求结果：成功时直接返回业务 data，失败时区分网络与业务错误。
 */
export type RequestResult<T> =
  | {
      ok: true;
      data: T;
    }
  | RequestFailure;

const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * 将失败结果转为可展示的错误文案。
 *
 * 业务错误优先使用后端 ``message``；网络类错误使用通用提示。
 *
 * @param result - ``ok: false`` 的请求结果
 * @returns 面向用户的错误描述
 */
export function getRequestErrorMessage(result: RequestFailure): string {
  if (result.kind === "business") {
    return result.message;
  }

  return "网络异常，请稍后重试";
}

type RequestConfig = AxiosRequestConfig & {
  customHandleBusinessError?: false;
};

/**
 * 发起 API 请求。
 *
 * - HTTP 200 且 ``code === API_SUCCESS_CODE``：``{ ok: true, data }``
 * - HTTP 200 且 ``code`` 为五位数等业务错误：``{ ok: false, kind: "business", code, message }``
 * - 断网、超时、结构异常：``{ ok: false, kind: "network" }``
 *
 * @typeParam T - 业务 data 类型（envelope.data 成功时的类型）
 * @param config - axios 请求配置（url、method、headers、data 等）
 * @returns 解包后的请求结果
 */
export function request<T>(config: RequestConfig): Promise<RequestResult<T>> {
  const { customHandleBusinessError = false } = config;

  return client
    .request(config)
    .then((response): RequestResult<T> => {
      if (!isApiEnvelope(response.data)) {
        console.error("请求出错了，接口返回数据不符合结构", response.data);
        return { ok: false, kind: "network" };
      }

      const envelope = response.data as ApiEnvelope<T>;

      if (response.status === 200 && envelope.code === API_SUCCESS_CODE) {
        return { ok: true, data: envelope.data as T };
      }

      if (response.status === 200) {
        console.error("业务错误", envelope.code, envelope.message);

        if (!customHandleBusinessError) {
          // 自动处理业务错误
        }

        return {
          ok: false,
          kind: "business",
          code: envelope.code,
          message: envelope.message,
        };
      }

      console.error("请求出错了", response);
      return { ok: false, kind: "network" };
    })
    .catch((error) => {
      console.error("请求出错了", error);
      return { ok: false, kind: "network" };
    });
}
