import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

import { AppRouter } from "@/router";

/**
 * 管理后台根组件。
 *
 * 使用 antd ConfigProvider 注入中文本地化，使表格分页、空状态等文案显示为中文。
 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AppRouter />
    </ConfigProvider>
  );
}
