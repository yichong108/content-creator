/** 当前选中的 AI 提供商 */
export type AiProvider = "openai" | "cursor_sdk";

/** OpenAI 兼容 API 配置 */
export interface OpenAiConfig {
  api_key: string;
  base_url: string;
  model: string;
}

/** Cursor SDK 配置 */
export interface CursorSdkConfig {
  api_key: string;
  model: string;
  runtime: "local" | "cloud";
  cwd: string;
  repos: string;
}

/** 完整 AI 配置 */
export interface AiConfig {
  provider: AiProvider;
  openai: OpenAiConfig;
  cursor_sdk: CursorSdkConfig;
}

/** 新建空配置时的默认值 */
export const EMPTY_OPENAI_CONFIG: OpenAiConfig = {
  api_key: "",
  base_url: "",
  model: "gpt-4o-mini",
};

/** Cursor SDK 默认配置 */
export const EMPTY_CURSOR_SDK_CONFIG: CursorSdkConfig = {
  api_key: "",
  model: "composer-2.5",
  runtime: "local",
  cwd: "",
  repos: "",
};

/** 完整 AI 配置默认值 */
export const EMPTY_AI_CONFIG: AiConfig = {
  provider: "openai",
  openai: EMPTY_OPENAI_CONFIG,
  cursor_sdk: EMPTY_CURSOR_SDK_CONFIG,
};
