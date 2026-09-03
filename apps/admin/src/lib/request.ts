import axios, { type AxiosRequestConfig, isAxiosError } from "axios";

const API_SUCCESS_CODE = 0;

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 服务端统一响应信封格式。
 *
 * 成功：HTTP 2xx + ``code === 0``
 * 失败：HTTP 非 2xx + ``code`` 为非 0 业务错误码，``data`` 为 ``null``
 */
interface ApiEnvelope<T> {
  code: number;
  message: string;
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
      /** HTTP 非 2xx 或 body.code 非 0 的业务错误 */
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

type RequestConfig = AxiosRequestConfig;

/**
 * 将 envelope 解析为业务失败结果。
 *
 * @param envelope - 服务端响应体
 * @returns 业务错误结果
 */
function toBusinessFailure(envelope: ApiEnvelope<unknown>): RequestFailure {
  return {
    ok: false,
    kind: "business",
    code: envelope.code,
    message: envelope.message,
  };
}

/**
 * 发起 API 请求并解包统一 envelope 响应。
 *
 * - HTTP 2xx 且 ``code === 0``：``{ ok: true, data }``
 * - HTTP 2xx 且 ``code !== 0``：``{ ok: false, kind: "business", code, message }``
 * - HTTP 非 2xx 且 body 含 envelope：``{ ok: false, kind: "business", code, message }``
 * - 断网、超时、结构异常：``{ ok: false, kind: "network" }``
 *
 * @typeParam T - 业务 data 类型（envelope.data 成功时的类型）
 * @param config - axios 请求配置
 * @returns 解包后的请求结果
 */
export function request<T>(config: RequestConfig): Promise<RequestResult<T>> {
  return client
    .request(config)
    .then((response): RequestResult<T> => {
      if (!isApiEnvelope(response.data)) {
        console.error("请求出错了，接口返回数据不符合结构", response.data);
        return { ok: false, kind: "network" };
      }

      const envelope = response.data as ApiEnvelope<T>;

      if (envelope.code === API_SUCCESS_CODE) {
        return { ok: true, data: envelope.data as T };
      }

      return toBusinessFailure(envelope);
    })
    .catch((error): RequestResult<T> => {
      if (isAxiosError(error) && error.response) {
        const body = error.response.data;

        if (isApiEnvelope(body)) {
          return toBusinessFailure(body);
        }
      }

      console.error("请求出错了", error);
      return { ok: false, kind: "network" };
    });
}
