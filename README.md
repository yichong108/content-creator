# WeChat Bot

高仿微信聊天页面，对话内容由 AI 生成。

## 技术栈

| 目录 | 技术 | 说明 |
|------|------|------|
| `apps/web` | React 19 + Vite + Tailwind CSS | 前端聊天 UI |
| `apps/api` | Python + FastAPI + LangGraph | AI 对话 API |
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

## 快速开始

### 1. 初始化项目（首次克隆后执行）

```bash
pnpm setup
```

该命令会依次完成：

- 安装 Node 依赖（pnpm install）
- 在 `apps/api` 创建 Python 虚拟环境 `.venv`
- 安装 `requirements.txt` 中的 Python 包
- 若不存在则从 `.env.example` 复制 `.env`

在 `apps/api/.env` 中配置 `OPENAI_API_KEY` 与 `DATABASE_URL`（见 `.env.example`）。

### 2. 启动 MySQL

项目根目录提供 Docker Compose 配置：

```bash
pnpm db:up
```

默认连接串：`mysql+aiomysql://wechat:wechat@127.0.0.1:3307/wechat_bot`（Docker 映射到宿主机 **3307**，避免与本机已有 MySQL 的 3306 冲突）

首次启动 API 时会自动建表；若表为空，会导入初始聊天数据。也可手动执行：

```bash
pnpm --dir apps/api seed
```

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

### 4. 常用命令

```bash
pnpm build      # 构建前端
pnpm lint       # 全仓库 lint
pnpm typecheck  # 类型检查
```

## API

### GET /api/chat-items

返回微信聊天 mock 列表（来自 MySQL `chat_items` 表），按 `sort_order` 排序：

```json
[
  { "kind": "timestamp", "text": "6月7日 上午8:15" },
  { "kind": "incoming", "text": "DeepSeek 在吗" },
  { "kind": "outgoing", "text": "在" }
]
```

### POST /api/chat

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

响应：

```json
{
  "message": {
    "role": "assistant",
    "content": "你好！有什么可以帮你的？"
  }
}
```
