/** OpenAI 兼容 API 配置 */
export interface OpenAiConfig {
  api_key: string;
  base_url: string;
  model: string;
}

/** 完整 AI 配置 */
export interface AiConfig {
  openai: OpenAiConfig;
}

/** 新建空配置时的默认值 */
export const EMPTY_OPENAI_CONFIG: OpenAiConfig = {
  api_key: "",
  base_url: "",
  model: "gpt-4o-mini",
};

/** 完整 AI 配置默认值 */
export const EMPTY_AI_CONFIG: AiConfig = {
  openai: EMPTY_OPENAI_CONFIG,
};
