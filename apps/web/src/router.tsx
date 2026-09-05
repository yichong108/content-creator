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
        <Route index element={<HomePage />} />
        <Route path="sessions" element={<SessionListPage />} />
        <Route path="start-session" element={<StartSessionLayout />}>
          <Route index element={<StartSessionPage />} />
          <Route path="select/:side" element={<StartSessionSelectNpcPage />} />
        </Route>
        <Route path="capturePage/:sessionId?" element={<CapturePage />} />
        <Route path="chatPage/:sessionId?" element={<ChatPage />} />
        <Route path="chatMessageListPage" element={<WechatChatMessageListPage />} />
        <Route path="customer-service" element={<CustomerServicePage />} />
      </Routes>
    </BrowserRouter>
  );
}
