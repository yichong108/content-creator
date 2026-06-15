/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** web 聊天预览页地址，供 iframe 嵌入 */
  readonly VITE_WEB_PREVIEW_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
