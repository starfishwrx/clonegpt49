# AI Proxy Backend

Single-user FastAPI backend that proxies chat requests to Gemini or Anthropic.

## Requirements
- Python 3.11+
- `uv` installed

## Install
```bash
uv sync
```

## Configure
Create `.env` and set keys/providers:
```env
GEMINI_API_KEY=...
ANTHROPIC_BASE_URL=...
ANTHROPIC_AUTH_TOKEN=...
```

## Run
```bash
uv run uvicorn main:app --reload --port 8000
```

## Docs
- Swagger: `http://127.0.0.1:8000/swagger`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Endpoints
- `GET /health`
- `GET /api/models`
- `POST /api/chat`
