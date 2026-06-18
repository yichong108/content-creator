/**
 * 直播会话页，用于管理直播演示用的会话。
 *
 * 当前为占位页面，后续可在此接入直播会话列表与配置能力。
 */
export function LiveSessionPage() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>直播会话</h1>
          <p className="page-desc">管理用于直播演示的会话与展示配置</p>
        </div>
      </header>

      <div className="card">
        <div className="empty-state">
          <p className="muted">暂无内容，功能开发中</p>
        </div>
      </div>
    </section>
  );
}
