import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import { AdminLayout } from "@/layouts/AdminLayout";
import { LiveSessionCreatePage } from "@/pages/LiveSessionCreatePage";
import { LiveSessionDetailPage } from "@/pages/LiveSessionDetailPage";
import { LiveSessionEditPage } from "@/pages/LiveSessionEditPage";
import { LiveSessionListPage } from "@/pages/LiveSessionListPage";
import { ModelConfigPage } from "@/pages/ModelConfigPage";
import { NpcManagementPage } from "@/pages/NpcManagementPage";
import { TopicManagementPage } from "@/pages/TopicManagementPage";

/**
 * 将旧 /sessions/:id 路径重定向到直播会话详情。
 */
function RedirectLegacySessionRoute({ suffix = "" }: { suffix?: string }) {
  const { id } = useParams();
  return <Navigate replace to={`/live-sessions/${id ?? ""}${suffix}`} />;
}

/**
 * 应用路由配置。
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<LiveSessionListPage />} />
          <Route path="live-sessions/new" element={<LiveSessionCreatePage />} />
          <Route path="live-sessions/:id/edit" element={<LiveSessionEditPage />} />
          <Route path="live-sessions/:id" element={<LiveSessionDetailPage />} />
          <Route path="sessions/new" element={<Navigate replace to="/live-sessions/new" />} />
          <Route path="sessions/:id/edit" element={<RedirectLegacySessionRoute suffix="/edit" />} />
          <Route path="sessions/:id" element={<RedirectLegacySessionRoute />} />
          <Route path="sessions" element={<Navigate replace to="/" />} />
          <Route path="system/models" element={<ModelConfigPage />} />
          <Route path="npcs" element={<NpcManagementPage />} />
          <Route path="topics" element={<TopicManagementPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
