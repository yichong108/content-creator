import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ChatPage } from "@/pages/ChatPage";
import { LivePage } from "@/pages/LivePage";
import { SessionListPage } from "@/pages/SessionListPage";
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
        <Route index element={<SessionListPage />} />
        <Route path="start-session" element={<StartSessionLayout />}>
          <Route index element={<StartSessionPage />} />
          <Route path="select/:side" element={<StartSessionSelectNpcPage />} />
        </Route>
        <Route path="chatPage/:liveSessionId?" element={<ChatPage />} />
        <Route path="live" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  );
}
