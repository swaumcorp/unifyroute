import httpx
from typing import Dict, Any, List
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo

class CohereAdapter(ProviderAdapter):
    def __init__(self):
        super().__init__("cohere", "cohere")

    async def _list_models_impl(self, api_key: str, auth_type: str = "api_key") -> List[ModelInfo]:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.cohere.com/v2/models",
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
            )
        if r.status_code != 200:
            return []
        models = []
        for m in r.json().get("models", []):
            name = m.get("name", "")
            if "chat" in m.get("endpoints", []):
                models.append(ModelInfo(
                    model_id=name,
                    display_name=name,
                    context_window=m.get("context_length", 128000),
                    supports_functions=True,
                ))
        return models

    async def _get_quota_impl(self, api_key: str, auth_type: str = "api_key") -> QuotaInfo:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.cohere.com/v2/models?page_size=1",
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
            )
        if r.status_code != 200:
            return QuotaInfo(tokens_remaining=0)
        x_tokens = r.headers.get("x-ratelimit-remaining-tokens", "")
        x_requests = r.headers.get("x-ratelimit-remaining-requests", "")
        return QuotaInfo(
            tokens_remaining=int(x_tokens) if x_tokens.isdigit() else 100_000,
            requests_remaining=int(x_requests) if x_requests.isdigit() else 1_000,
        )
