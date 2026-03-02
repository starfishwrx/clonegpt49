# 克隆大模型对话平台

这个是一个克隆49AI模型对话平台的项目

## 环境要求
- Python 3.11 及以上
- 已安装 `uv`

## 安装依赖
```bash
uv sync
```

## 环境配置
在 `backend` 目录创建 `.env`，至少配置以下内容：

```env
GEMINI_API_KEY=你的_GEMINI_KEY
ANTHROPIC_BASE_URL=你的_ANTHROPIC_BASE_URL
ANTHROPIC_AUTH_TOKEN=你的_ANTHROPIC_TOKEN
```

可选配置：

```env
GEMINI_MODEL=gemini-2.5-flash
API_TIMEOUT_MS=250000
ANTHROPIC_MODEL=anthropic.claude-sonnet-4-5-20250929
ANTHROPIC_SMALL_FAST_MODEL=anthropic.claude-sonnet-4-5-20250929
ANTHROPIC_DEFAULT_OPUS_MODEL=anthropic.claude-opus-4-5-20251101
ANTHROPIC_DEFAULT_SONNET_MODEL=anthropic.claude-sonnet-4-5-20250929
ANTHROPIC_DEFAULT_HAIKU_MODEL=anthropic.claude-haiku-4-5-20251001
```

## 启动服务
```bash
uv run uvicorn main:app --reload --port 8000
```

启动后访问：
- Swagger 文档：`http://127.0.0.1:8000/swagger`
- ReDoc 文档：`http://127.0.0.1:8000/redoc`

## 接口说明
- `GET /health`
  - 健康检查
- `GET /api/models`
  - 返回后端可用提供方及默认模型（来源于环境变量）
- `POST /api/chat`
  - 发送聊天请求到指定提供方
  - 请求体示例：
    ```json
    {
      "message": "你好，帮我写一句欢迎语",
      "provider": "gemini",
      "model": "gemini-2.5-flash"
    }
    ```
  - `provider` 可选：`gemini` / `anthropic`

## 前端联调
如果你使用项目里的前端页面 `chatgpt-ui`，默认后端地址是：

`http://127.0.0.1:8000/api/chat`

请确保后端和前端同时启动。
