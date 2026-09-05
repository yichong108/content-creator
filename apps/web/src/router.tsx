import { BrowserRouter, Route, Routes } from "react-router-dom";

import { CapturePage } from "@/pages/CapturePage";
import { ChatPage } from "@/pages/ChatPage";
import { CustomerServicePage } from "@/pages/CustomerServicePage";
import { HomePage } from "@/pages/HomePage";
import { SessionListPage } from "@/pages/SessionListPage";
import { WechatChatMessageListPage } from "@/pages/WechatChatMessageListPage";
import { StartSessionLayout } from "@/pages/StartSessionLayout";
import { StartSessionPage } from "@/pages/StartSessionPage";
import { StartSessionSelectNpcPage } from "@/pages/StartSessionSelectNpcPage";

/**
 * 应用路由配置
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首页导航 - 聚合主要功能入口，点击卡片跳转到对应页面 */}
        <Route index element={<HomePage />} />
        {/* 会话列表页 - 微信风格聊天会话列表 */}
        <Route path="sessions" element={<SessionListPage />} />
        {/* 发起会话流程（嵌套路由） */}
        <Route path="start-session" element={<StartSessionLayout />}>
          {/* 发起会话入口页 */}
          <Route index element={<StartSessionPage />} />
          {/* 选择 NPC 角色（self 或 peer 侧） */}
          <Route path="select/:side" element={<StartSessionSelectNpcPage />} />
        </Route>
        {/* 截图预览页 - 可选会话 ID 参数 */}
        <Route path="capturePage/:sessionId?" element={<CapturePage />} />
        {/* 生产聊天页 - WebSocket 实时拉取会话消息，可选会话 ID */}
        <Route path="chatPage/:sessionId?" element={<ChatPage />} />
        {/* iframe 嵌入预览页 - 仅渲染消息列表，供 admin 嵌入 */}
        <Route path="chatMessageListPage" element={<WechatChatMessageListPage />} />
        {/* 移动端客服入口页 - 含底部输入框和发送按钮 */}
        <Route path="customer-service" element={<CustomerServicePage />} />
      </Routes>
    </BrowserRouter>
  );
}
