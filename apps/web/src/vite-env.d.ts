/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** 允许向 iframe 推送聊天记录的父页面 origin，逗号分隔 */
  readonly VITE_PREVIEW_PARENT_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
