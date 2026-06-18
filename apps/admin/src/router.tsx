import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/layouts/AdminLayout";
import { LiveSessionCreatePage } from "@/pages/LiveSessionCreatePage";
import { LiveSessionDetailPage } from "@/pages/LiveSessionDetailPage";
import { LiveSessionEditPage } from "@/pages/LiveSessionEditPage";
import { LiveSessionListPage } from "@/pages/LiveSessionListPage";
import { ModelConfigPage } from "@/pages/ModelConfigPage";
import { SessionCreatePage } from "@/pages/SessionCreatePage";
import { SessionDetailPage } from "@/pages/SessionDetailPage";
import { SessionEditPage } from "@/pages/SessionEditPage";
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
          <Route path="live-sessions/new" element={<LiveSessionCreatePage />} />
          <Route path="live-sessions/:id/edit" element={<LiveSessionEditPage />} />
          <Route path="live-sessions/:id" element={<LiveSessionDetailPage />} />
          <Route path="live-sessions" element={<LiveSessionListPage />} />
          <Route path="system/models" element={<ModelConfigPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
