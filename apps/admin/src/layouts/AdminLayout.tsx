import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/stores/auth-store";

/**
 * 管理后台布局，包含顶部导航、侧边栏用户信息与内容区。
 */
export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CC</span>
          <div>
            <strong>ContentCreator</strong>
            <span className="brand-sub">管理后台</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink end className="nav-link" to="/">
            直播会话
          </NavLink>
          <NavLink className="nav-link" to="/npcs">
            NPC管理
          </NavLink>
          <div className="nav-group">
            <span className="nav-group-title">系统配置</span>
            <div className="nav-sub">
              <NavLink className="nav-link nav-sublink" to="/system/models">
                AI配置
              </NavLink>
            </div>
          </div>
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.username ?? "管理员"}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
