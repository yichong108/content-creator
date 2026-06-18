import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/layouts/AdminLayout";
import { SessionCreatePage } from "@/pages/SessionCreatePage";
import { SessionDetailPage } from "@/pages/SessionDetailPage";
import { SessionEditPage } from "@/pages/SessionEditPage";
import { LiveSessionPage } from "@/pages/LiveSessionPage";
import { ModelConfigPage } from "@/pages/ModelConfigPage";
import { SessionListPage } from "@/pages/SessionListPage";

/**
 * 应用路由配置。
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<SessionListPage />} />
          <Route path="sessions/new" element={<SessionCreatePage />} />
          <Route path="sessions/:id/edit" element={<SessionEditPage />} />
          <Route path="sessions/:id" element={<SessionDetailPage />} />
          <Route path="live-sessions" element={<LiveSessionPage />} />
          <Route path="system/models" element={<ModelConfigPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
