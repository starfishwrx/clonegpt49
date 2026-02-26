import os
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field

load_dotenv()

DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_ANTHROPIC_MODEL = os.getenv(
    "ANTHROPIC_MODEL",
    os.getenv("ANTHROPIC_DEFAULT_SONNET_MODEL", "anthropic.claude-sonnet-4-5-20250929"),
)

app = FastAPI(
    title="AI Proxy API",
    version="0.2.0",
    summary="Single-user multi-provider AI proxy built with FastAPI",
    description=(
        "A minimal backend API that receives user messages and forwards them to Gemini or Anthropic."
    ),
    docs_url="/swagger",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "System", "description": "Service status endpoints."},
        {"name": "Chat", "description": "Send chat prompts to AI providers and get replies."},
        {"name": "Models", "description": "Get backend provider/model defaults."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


def _create_gemini_client() -> genai.Client | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


gemini_client = _create_gemini_client()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default


def _call_gemini(prompt: str, model: str) -> str:
    if gemini_client is None:
        raise RuntimeError("Missing GEMINI_API_KEY in environment.")
    result = gemini_client.models.generate_content(model=model, contents=prompt)
    return result.text or ""


def _call_anthropic(prompt: str, model: str) -> str:
    base_url = os.getenv("ANTHROPIC_BASE_URL", "").strip()
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN", "").strip()
    timeout_ms = _int_env("API_TIMEOUT_MS", 250000)
    if not base_url:
        raise RuntimeError("Missing ANTHROPIC_BASE_URL in environment.")
    if not auth_token:
        raise RuntimeError("Missing ANTHROPIC_AUTH_TOKEN in environment.")

    url = f"{base_url.rstrip('/')}/v1/messages"
    headers = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": auth_token,
        "authorization": f"Bearer {auth_token}",
    }
    payload = {
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    }

    with httpx.Client(timeout=timeout_ms / 1000.0) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            detail = response.text
            raise RuntimeError(f"Anthropic API error ({response.status_code}): {detail}")
        data = response.json()

    content = data.get("content")
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                chunks.append(item.get("text", ""))
        merged = "".join(chunks).strip()
        if merged:
            return merged

    if isinstance(data.get("completion"), str):
        return data["completion"]
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    raise RuntimeError("Anthropic response has no text content.")


class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="User input text that will be sent to selected provider.",
        examples=["Please write a short welcome message."],
    )
    provider: Literal["gemini", "anthropic"] = Field(
        default="gemini",
        description="AI provider to route the request to.",
        examples=["gemini"],
    )
    model: str | None = Field(
        default=None,
        description="Optional model name. If empty, backend default model for the provider is used.",
        examples=[DEFAULT_GEMINI_MODEL],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Give me a 3-day study plan.",
                "provider": "anthropic",
                "model": "anthropic.claude-sonnet-4-5-20250929",
            }
        }
    }


class ChatResponse(BaseModel):
    provider: str = Field(description="Provider that handled the request.")
    model: str = Field(description="Model that handled the request.")
    reply: str = Field(description="Model-generated plain text response.")


class ErrorResponse(BaseModel):
    detail: str


class ProviderModels(BaseModel):
    provider: str
    default_model: str
    available_env_models: list[str]


@app.get(
    "/health",
    tags=["System"],
    summary="Health check",
    description="Quick health check endpoint used by monitoring and startup tests.",
)
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get(
    "/api/models",
    tags=["Models"],
    summary="Get provider model defaults",
    description="Returns backend provider defaults from environment variables.",
)
def get_models() -> dict[str, list[ProviderModels]]:
    anthropic_models = [
        os.getenv("ANTHROPIC_MODEL", "").strip(),
        os.getenv("ANTHROPIC_SMALL_FAST_MODEL", "").strip(),
        os.getenv("ANTHROPIC_DEFAULT_OPUS_MODEL", "").strip(),
        os.getenv("ANTHROPIC_DEFAULT_SONNET_MODEL", "").strip(),
        os.getenv("ANTHROPIC_DEFAULT_HAIKU_MODEL", "").strip(),
    ]
    anthropic_models = [m for i, m in enumerate(anthropic_models) if m and m not in anthropic_models[:i]]

    gemini_models = [DEFAULT_GEMINI_MODEL]
    return {
        "providers": [
            ProviderModels(
                provider="gemini",
                default_model=DEFAULT_GEMINI_MODEL,
                available_env_models=gemini_models,
            ),
            ProviderModels(
                provider="anthropic",
                default_model=DEFAULT_ANTHROPIC_MODEL,
                available_env_models=anthropic_models,
            ),
        ]
    }


@app.post(
    "/api/chat",
    tags=["Chat"],
    response_model=ChatResponse,
    summary="Send prompt to selected provider",
    description="Accepts a user message and routes it to Gemini or Anthropic.",
    responses={
        200: {"description": "Successful response from model provider."},
        400: {"description": "Invalid request.", "model": ErrorResponse},
        502: {"description": "Failed to call provider API.", "model": ErrorResponse},
    },
)
def chat(payload: ChatRequest) -> ChatResponse:
    prompt = payload.message.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    if payload.provider == "gemini":
        model = (payload.model or DEFAULT_GEMINI_MODEL).strip()
        try:
            reply = _call_gemini(prompt, model)
            return ChatResponse(provider="gemini", model=model, reply=reply)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Gemini API call failed: {exc}") from exc

    model = (payload.model or DEFAULT_ANTHROPIC_MODEL).strip()
    try:
        reply = _call_anthropic(prompt, model)
        return ChatResponse(provider="anthropic", model=model, reply=reply)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API call failed: {exc}") from exc
