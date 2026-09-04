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
          <NavLink className="nav-link" to="/documents">
            文档管理
          </NavLink>
          <NavLink className="nav-link" to="/rag-test">
            RAG 测试
          </NavLink>
          <div className="nav-group">
            <span className="nav-group-title">系统配置</span>
            <div className="nav-sub">
              <NavLink className="nav-link nav-sublink" to="/system/models">
                AI配置
              </NavLink>
              <NavLink className="nav-link nav-sublink" to="/system/token-usage">
                token用量
              </NavLink>
            </div>
          </div>
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.username ?? "管理员"}</span>
          <button
            className="sidebar-logout"
            type="button"
            title="退出登录"
            aria-label="退出登录"
            onClick={handleLogout}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
