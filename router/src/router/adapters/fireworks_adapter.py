import httpx
from typing import Dict, Any, List
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo

class FireworksAdapter(ProviderAdapter):
    """Adapter for Fireworks AI — OpenAI-compatible at api.fireworks.ai/inference/v1."""

    _BASE = "https://api.fireworks.ai/inference/v1"

    def __init__(self):
        # litellm uses 'fireworks_ai' prefix for Fireworks models
        super().__init__("fireworks", "fireworks_ai")

    async def _list_models_impl(self, api_key: str, auth_type: str = "api_key") -> List[ModelInfo]:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self._BASE}/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
        if r.status_code != 200:
            return []
        models = []
        for m in r.json().get("data", []):
            mid = m.get("id", "")
            models.append(ModelInfo(
                model_id=mid,
                display_name=m.get("display_name", mid) or mid,
                context_window=m.get("context_length", 131072),
                supports_functions=True,
            ))
        return models

    async def _get_quota_impl(self, api_key: str, auth_type: str = "api_key") -> QuotaInfo:
        """Fireworks. Returns rate-limit headers on API responses when they are applied."""
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self._BASE}/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
        if r.status_code != 200:
            return QuotaInfo(tokens_remaining=0)
        x_tokens = r.headers.get("x-ratelimit-remaining-tokens", "")
        x_requests = r.headers.get("x-ratelimit-remaining-requests", "")
        return QuotaInfo(
            tokens_remaining=int(x_tokens) if x_tokens.isdigit() else 500_000,
            requests_remaining=int(x_requests) if x_requests.isdigit() else 1_000,
        )
