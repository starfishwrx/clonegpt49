# API Documentation (Detailed)

## Base URL
- Local: `http://127.0.0.1:8000`

## Interactive Docs
- Swagger UI: `http://127.0.0.1:8000/swagger`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Endpoint: Health Check
- Method: `GET`
- Path: `/health`
- Purpose: Verify service availability.

### Success Response
- Status: `200 OK`
```json
{ "ok": true }
```

## Endpoint: Provider Defaults
- Method: `GET`
- Path: `/api/models`
- Purpose: Return provider default model config from backend env.

### Success Response
- Status: `200 OK`
```json
{
  "providers": [
    {
      "provider": "gemini",
      "default_model": "gemini-2.5-flash",
      "available_env_models": ["gemini-2.5-flash"]
    },
    {
      "provider": "anthropic",
      "default_model": "anthropic.claude-sonnet-4-5-20250929",
      "available_env_models": [
        "anthropic.claude-sonnet-4-5-20250929",
        "anthropic.claude-opus-4-5-20251101",
        "anthropic.claude-haiku-4-5-20251001"
      ]
    }
  ]
}
```

## Endpoint: Chat Completion
- Method: `POST`
- Path: `/api/chat`
- Purpose: Forward user prompt to selected provider and return model response.
- Content-Type: `application/json`

### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | User prompt text. |
| `provider` | string | No | `gemini` or `anthropic`. Default: `gemini`. |
| `model` | string | No | Model name. If empty, backend default model is used by provider. |

### Request Example (Gemini)
```json
{
  "message": "Write a short welcome sentence",
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

### Request Example (Anthropic)
```json
{
  "message": "Summarize this in 3 bullet points",
  "provider": "anthropic",
  "model": "anthropic.claude-sonnet-4-5-20250929"
}
```

### Success Response
- Status: `200 OK`
```json
{
  "provider": "anthropic",
  "model": "anthropic.claude-sonnet-4-5-20250929",
  "reply": "..."
}
```

### Error Responses
- `400 Bad Request`
```json
{ "detail": "message cannot be empty" }
```
- `502 Bad Gateway`
```json
{ "detail": "Anthropic API call failed: ..." }
```

## cURL Examples

### Gemini
```bash
curl -X POST "http://127.0.0.1:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","provider":"gemini","model":"gemini-2.5-flash"}'
```

### Anthropic
```bash
curl -X POST "http://127.0.0.1:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","provider":"anthropic","model":"anthropic.claude-sonnet-4-5-20250929"}'
```

## Notes
- CORS is enabled (`allow_origins=*`) for local frontend integration.
- Service currently has no auth by design (single-user local usage).
- Configure keys and provider settings in `.env`.
