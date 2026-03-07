import httpx
from typing import Dict, Any, List
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo

class GroqAdapter(ProviderAdapter):
    def __init__(self):
        super().__init__("groq", "groq")

    async def _list_models_impl(self, api_key: str, auth_type: str = "api_key") -> List[ModelInfo]:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
        if r.status_code != 200:
            return []
        return [
            ModelInfo(
                model_id=m.get("id", ""),
                display_name=m.get("id", ""),
                context_window=m.get("context_window", 131072),
                supports_functions=True,
            )
            for m in r.json().get("data", [])
        ]

    async def _get_quota_impl(self, api_key: str, auth_type: str = "api_key") -> QuotaInfo:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
        if r.status_code != 200:
            return QuotaInfo(tokens_remaining=0)
        x_tokens = r.headers.get("x-ratelimit-remaining-tokens", "")
        x_requests = r.headers.get("x-ratelimit-remaining-requests", "")
        return QuotaInfo(
            tokens_remaining=int(x_tokens) if x_tokens.isdigit() else 100_000,
            requests_remaining=int(x_requests) if x_requests.isdigit() else 1_000,
        )
