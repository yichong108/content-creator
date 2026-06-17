# WeChat Bot

高仿微信聊天页面，对话内容由 AI 生成。

## 技术栈

| 目录 | 技术 | 说明 |
|------|------|------|
| `apps/web` | React 19 + Vite + Tailwind CSS | 前端聊天 UI |
| `apps/api` | Python + FastAPI + LangGraph + [uv](https://docs.astral.sh/uv/) | AI 对话 API |
| 根目录 | pnpm + Turborepo | Monorepo 管理 |

## 目录结构

```
wechat-bot/
├── apps/
│   ├── web/          # React + Vite 前端
│   └── api/          # Python 后端
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 前置要求

- Node.js >= 20、pnpm
- [uv](https://docs.astral.sh/uv/getting-started/installation/)（管理 Python 版本与依赖）

  ```powershell
  # Windows
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```

  ```bash
  # macOS / Linux
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

## 快速开始

### 1. 初始化项目（首次克隆后执行）

```bash
pnpm setup
```

该命令会依次完成：

- 安装 Node 依赖（pnpm install）
- 用 uv 创建 `.venv` 并安装 `pyproject.toml` 中的 Python 依赖（版本锁定在 `uv.lock`）
- 若不存在则从 `.env.example` 复制 `.env`

在 `apps/api/.env` 中配置 `OPENAI_API_KEY` 与 `DATABASE_URL`（见 `.env.example`）。

### 2. 启动 MySQL

项目根目录提供 Docker Compose 配置：

```bash
pnpm db:up
```

默认连接串：`mysql+aiomysql://wechat:wechat@127.0.0.1:3307/wechat_bot`（Docker 映射到宿主机 **3307**，避免与本机已有 MySQL 的 3306 冲突）

首次启动 API 时会自动建表。

### 3. 启动开发服务

在项目根目录：

```bash
pnpm dev
```

- 前端：http://localhost:3001（Vite 开发服务器）
- 后端：http://localhost:8000
- 健康检查：http://localhost:8000/health
- 聊天列表：http://localhost:8000/api/chat-items

若只需重装 Python 依赖：

```bash
pnpm setup:py
```

修改 `apps/api/pyproject.toml` 中的依赖后，需重新生成锁文件并提交：

```bash
pnpm lock:py
```

### 4. 常用命令

```bash
pnpm build      # 构建前端
pnpm lint       # 全仓库 lint
pnpm typecheck  # 类型检查
```

## API

所有 JSON 接口（含 `/health`）统一返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| 字段 | 说明 |
|------|------|
| `code` | **业务错误码**：`0` 表示成功；失败时为 `40001`、`40101`、`42201`、`50001` 等（与 HTTP 状态码无关） |
| `message` | 人类可读描述；成功时为 `ok`，失败时为错误原因 |
| `data` | 业务数据；失败时为 `null` |

HTTP 响应状态码（如 `401`、`422`、`500`）在响应行单独返回，表示协议/传输层结果，**不要**与 body 里的 `code` 混为一谈。

### 业务错误码

| 业务码 | 含义 | 常见对应 HTTP |
|--------|------|----------------|
| `0` | 成功 | `200` |
| `40001` | 请求参数错误 | `400` |
| `40101` | 未登录或登录已过期 | `401` |
| `40301` | 没有访问权限 | `403` |
| `40401` | 资源不存在 | `404` |
| `42201` | 请求数据验证失败 | `422` |
| `50001` | 服务器内部错误 | `500` |

### GET /api/chat-items

成功示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "kind": "timestamp", "text": "6月7日 上午8:15" },
    { "kind": "incoming", "text": "DeepSeek 在吗" },
    { "kind": "outgoing", "text": "在" }
  ]
}
```

失败示例（HTTP 500，业务码 `50001`）：

```json
{
  "code": 50001,
  "message": "服务器内部错误，请稍后重试",
  "data": null
}
```

### POST /api/chat

请求体：

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "message": {
      "role": "assistant",
      "content": "你好！有什么可以帮你的？"
    }
  }
}
```
