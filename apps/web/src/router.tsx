import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ChatPage } from "@/pages/ChatPage";
import { LivePage } from "@/pages/LivePage";

/**
 * 应用路由配置
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<ChatPage />} />
        <Route path="live" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  );
}
