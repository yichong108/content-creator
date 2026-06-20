import { Outlet } from "react-router-dom";

import { StartSessionProvider } from "@/contexts/StartSessionContext";

/**
 * 发起会话路由布局，为子页面提供共享的 NPC 选择与创建会话状态。
 */
export function StartSessionLayout() {
  return (
    <StartSessionProvider>
      <Outlet />
    </StartSessionProvider>
  );
}
