# 管理后台登录认证功能

## 概要

为项目添加登录功能，形成「后台管理系统（认证）」能力闭环：

- **后端**（apps/api）：新增 `admin_users` 表与默认管理员种子，提供 `POST /api/admin/auth/login`、`GET /api/admin/auth/me`；使用 JWT（HS256）+ bcrypt。所有 `/api/admin/*` 接口改为要求登录（未登录返回 401）。
- **管理端**（apps/admin）：新增登录页、路由守卫、认证状态 store、请求自动携带 token、侧边栏显示当前用户与退出登录。
- **移动端预览页**（apps/web）：其依赖的 3 个 `/api/admin/*` 接口迁移为公开的 `/api/mobile/*`，保证移动端（不登录）继续可用。

## 现状分析

- 后端为 FastAPI + SQLAlchemy(async) + MySQL，统一 `ApiResponse{code,message,data}` 信封与业务错误码（[error_codes.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/schemas/error_codes.py) 已定义 `ERR_UNAUTHORIZED=40101`）。
- 路由统一在 [main.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py) 里配置 prefix：`/api/admin/live-sessions`、`/api/admin/npcs`、`/api/admin/ai-config`。
- 管理端为 React + antd + zustand + axios，[request.ts](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/lib/request.ts) 已统一解包信封，但未带任何鉴权头；[router.tsx](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/router.tsx) 全部路由包在 `AdminLayout` 下，无登录页。
- **关键依赖**：移动端预览页 [api.ts](file:///d:/wishzhang/project/owner/wechat-bot/apps/web/src/lib/api.ts) 调用了 `GET /api/admin/npcs`、`POST /api/admin/live-sessions`、`PATCH /api/admin/live-sessions/:id/running`（发起会话流程）。因此不能直接保护全部 `/api/admin/*`，需先迁移这 3 个接口。
- 附带发现：web 端 `fetchNpcs()` 期望返回**普通列表**，但现有 `/api/admin/npcs` 返回分页 `PageResult`，存在类型不匹配隐患；新的 `/api/mobile/npcs` 直接返回普通列表即可一并修复。

## 变更方案

### 一、后端（apps/api）

#### 1. 新增依赖

在 [pyproject.toml](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/pyproject.toml) `dependencies` 增加：

- `pyjwt>=2.10,<3.0`（JWT 签发/校验）
- `bcrypt>=4.2,<5.0`（密码哈希）

并在 `apps/api` 虚拟环境中安装：`pip install "pyjwt>=2.10,<3.0" "bcrypt>=4.2,<5.0"`。

#### 2. 配置（config.py + .env）

[config.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/config.py) `Settings` 增加：

- `jwt_secret: str = "change-me-in-prod"` — JWT 签名密钥
- `jwt_expire_minutes: int = 60 * 24` — token 有效期（1 天）
- `admin_initial_username: str = "admin"` / `admin_initial_password: str = "admin123456"` — 首次启动种子账号

[apps/api/.env](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/.env) 增加对应项（`JWT_SECRET` 建议填随机长字符串）。

#### 3. 数据模型 `app/models/admin_user.py`（新建）

`AdminUserRow(Base)`，表 `admin_users`：

- `id`：BigInteger PK 自增
- `username`：String(64) 唯一、非空
- `password_hash`：String(255) 非空
- `is_active`：Boolean 默认 True
- `created_at` / `updated_at`：DateTime，与 [npc.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/models/npc.py) 相同的 `func.now()` 模式

在 [main.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py) 增加 `from app.models import admin_user as _admin_user_model`，让 `create_all` 建表。

#### 4. 安全服务 `app/services/auth_security.py`（新建）

- `hash_password(password: str) -> str` — bcrypt 加盐哈希
- `verify_password(password: str, password_hash: str) -> bool`
- `create_access_token(admin_user_id: int) -> str` — JWT HS256，payload 含 `sub`(id)、`exp`、`iat`
- `decode_access_token(token: str) -> int` — 校验并返回用户 id，无效/过期抛异常
- `get_current_admin` — FastAPI 依赖：解析 `Authorization: Bearer <token>`，解码后从库中加载 `AdminUserRow`（校验 `is_active`），失败一律 `raise HTTPException(status_code=401, detail="未登录或登录已过期")`

所有导出函数按 AGENTS.md 规范写 docstring。

#### 5. 鉴权 Schema `app/schemas/auth.py`（新建）

- `LoginRequest{username, password}`
- `AdminUserSummary{id, username, created_at}`
- `LoginResponse{token, token_type="bearer", expires_at, user: AdminUserSummary}`

#### 6. 鉴权路由 `app/routers/auth.py`（新建，tags=["admin-auth"]）

- `POST ""` — 校验 `LoginRequest`，失败返回 `fail_response(response, ERR_UNAUTHORIZED, "用户名或密码错误")`；成功签发 token 返回 `LoginResponse`
- `GET "/me"` — `Depends(get_current_admin)`，返回 `AdminUserSummary`

在 [main.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py) 以 `prefix="/api/admin/auth"` 注册。

#### 7. 种子管理员

在 `app/services/auth_security.py` 或独立 `seed` 函数中新增 `seed_default_admin()`：当 `admin_users` 表中不存在 `settings.admin_initial_username` 时，用 `settings.admin_initial_username/password` 创建（密码先哈希）。在 [db.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/db.py) `init_db()` 的 `create_all` 之后调用。

#### 8. 保护管理端路由

给以下 router 构造器加 `dependencies=[Depends(get_current_admin)]`：

- [routers/npcs.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/routers/npcs.py)
- [routers/live_sessions.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/routers/live_sessions.py)
- [routers/ai_config.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/routers/ai_config.py)

#### 9. 公开移动端路由 `app/routers/mobile.py`（新建，tags=["mobile"]）

从 `live_sessions.py` 抽离移动端所需 3 个公开接口（复用既有 service 函数，逻辑与现有实现一致）：

- `GET "" /api/mobile/npcs` — 返回全部 NPC 的**普通列表**（`select(NpcRow).order_by(updated_at.desc)`，用 `npc_row_to_summary` 转换），修复 web 端分页类型不匹配
- `POST "" /api/mobile/live-sessions` — 复用 `LiveSessionCreate`、`dedupe_npc_ids`、`resolve_session_npc_rows` 创建会话，返回 `LiveSessionDetail`
- `PATCH "" /api/mobile/live-sessions/{id}/running` — 复用 running 切换逻辑（含 `live_session_runner.start()` 与 `live_session_event_hub.publish`），返回 `LiveSessionSummary`

在 [main.py](file:///d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py) 以 `prefix="/api/mobile"` 注册。

### 二、管理端前端（apps/admin）

#### 1. token 存取 `src/lib/auth-token.ts`（新建）

`getAuthToken()` / `setAuthToken(token | null)`，底层 localStorage key 固定为 `contentcreator_admin_token`。作为 token 唯一真源，避免 store 与 request 循环依赖。

#### 2. 请求自动带 token（[request.ts](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/lib/request.ts)）

- 请求拦截器：有 token 时加 `Authorization: Bearer <token>` 头
- 响应处理：当业务 `code === 40101`（或 HTTP 401）时，`setAuthToken(null)` 并 `window.location.href = "/login"` 跳转登录页；其余逻辑保持不变

#### 3. 认证 API `src/api/auth.ts`（新建）

- `login(username, password)` → `RequestResult<LoginResponse>`
- `fetchMe()` → `RequestResult<AdminUserSummary>`

#### 4. 认证 store `src/stores/auth-store.ts`（新建，zustand + persist）

- state：`token`、`user`
- actions：`login`（成功后写 token）、`logout`（清 token/user）、`loadMe`（启动时用现有 token 调 `/me` 校验）
- 初始化 token 从 `auth-token.ts` 读取；持久化用 `zustand/middleware` 的 `persist` + localStorage

#### 5. 登录页 `src/pages/LoginPage.tsx`（新建）

antd `Form`（用户名 + 密码）+ 居中卡片，提交调 `authStore.login`，成功后 `navigate("/")`；失败用 `Alert`/`message` 展示错误。

#### 6. 路由守卫 `src/components/RequireAuth.tsx`（新建）+ [router.tsx](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/router.tsx)

- `RequireAuth`：无 token → `<Navigate to="/login" replace />`；有 token → 渲染 `<Outlet />`；挂载时后台触发 `loadMe`（过期 token 由 401 拦截器兜底跳登录页）
- 路由：新增 `/login` 独立路由；`AdminLayout` 及其子路由包进 `RequireAuth`

#### 7. 布局显示用户与退出（[AdminLayout.tsx](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/layouts/AdminLayout.tsx)）

侧边栏底部展示当前用户名 + 「退出登录」按钮，点击调 `authStore.logout()` 并跳 `/login`。

#### 8. 样式（[index.css](file:///d:/wishzhang/project/owner/wechat-bot/apps/admin/src/index.css)）

新增 `.login-page` 居中卡片样式块。

### 三、移动端预览页（apps/web）

[apps/web/src/lib/api.ts](file:///d:/wishzhang/project/owner/wechat-bot/apps/web/src/lib/api.ts) 三个请求地址改到公开移动端接口：

- `GET /api/admin/npcs` → `GET /api/mobile/npcs`
- `POST /api/admin/live-sessions` → `POST /api/mobile/live-sessions`
- `PATCH /api/admin/live-sessions/${id}/running` → `PATCH /api/mobile/live-sessions/${id}/running`

（返回结构不变，无需改调用方代码。）

## 假设与决策

- **技术选型**：JWT（HS256，PyJWT）+ bcrypt（直连 bcrypt 包，不用 passlib 避免其维护问题）。单 access token、无 refresh token、有效期 1 天（可后续扩展）。
- **账号体系**：仅登录，不做注册/改密码/角色权限（权限属后续里程碑）；种子账号 `admin/admin123456`，建议部署时改密码。
- **保护范围**：`/api/admin/*` 全部保护；移动端 3 个接口迁移到公开的 `/api/mobile/*`，移动端无需登录。
- **退出登录**：纯前端清除 token（JWT 无状态），不新增服务端注销接口。
- 前端 token 存 localStorage；有 token 即视为已登录，过期由 `/me` 校验 + 401 拦截器兜底。
- 所有新增/修改的导出函数遵循 AGENTS.md：Python docstring（Google 风格）、TS JSDoc。

## 验证步骤

1. **后端静态检查**：在 `apps/api` 下运行 `ruff check .`、`mypy .`（或项目约定的命令）。
2. **后端接口冒烟**（启动 uvicorn）：
   - 无 token 访问 `GET /api/admin/npcs` → 401 envelope
   - `POST /api/admin/auth/login` 错误密码 → 401「用户名或密码错误」
   - 正确登录 → 返回 token；带 token 访问 `/api/admin/auth/me` → 返回用户；`GET /api/admin/npcs` → 200
   - `GET /api/mobile/npcs` 无 token → 200 且为普通列表
3. **管理端**：`pnpm typecheck`、`pnpm lint`；`pnpm dev` 验证：未登录访问 `/` 跳 `/login`；登录成功进首页；侧边栏显示用户名、退出后回到登录页；刷新页面保持登录。
4. **移动端**：`pnpm dev` 验证发起会话流程正常（NPC 列表加载、创建会话、切换 running）。
5. **构建**：admin 与 web 分别 `pnpm build` 通过。
