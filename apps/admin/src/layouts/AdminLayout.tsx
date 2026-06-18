import { NavLink, Outlet } from "react-router-dom";

/**
 * 管理后台布局，包含顶部导航与内容区。
 */
export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">WB</span>
          <div>
            <strong>WeChat Bot</strong>
            <span className="brand-sub">管理后台</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink end className="nav-link" to="/">
            会话列表
          </NavLink>
          <NavLink className="nav-link" to="/live-sessions">
            直播会话
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
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
