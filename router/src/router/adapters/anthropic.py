import httpx
from typing import Dict, Any, List
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo

class AnthropicAdapter(ProviderAdapter):
    def __init__(self):
        super().__init__("anthropic", "anthropic")

    async def _list_models_impl(self, api_key: str, auth_type: str = "api_key") -> List[ModelInfo]:
        from .base import fetch_json_safe
        
        data = await fetch_json_safe(
            url="https://api.anthropic.com/v1/models",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            timeout_ms=10000,
            method="GET"
        )
        
        if not data or not isinstance(data, dict):
            return []
            
        models = []
        for m in data.get("data", []):
            mid = m.get("id", "")
            models.append(ModelInfo(
                model_id=mid,
                display_name=m.get("display_name", mid),
                context_window=200000,
                supports_functions=True
            ))
        return models

    async def _get_quota_impl(self, api_key: str, auth_type: str = "api_key") -> QuotaInfo:
        import httpx
        
        # Anthropic exposes rate limit headers on standard API calls.
        # OpenClaw handles header parsing independently from JSON bodies, so we mirror
        # the timeout wrappings directly here for header-only extraction safely.
        try:
            timeout = httpx.Timeout(10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}
                )
                resp.raise_for_status()
                rem_tokens = resp.headers.get("x-ratelimit-remaining-tokens", "100000")
                rem_reqs = resp.headers.get("x-ratelimit-remaining-requests", "1000")
                
                return QuotaInfo(
                    tokens_remaining=int(rem_tokens) if rem_tokens.isdigit() else 100000,
                    requests_remaining=int(rem_reqs) if rem_reqs.isdigit() else 1000
                )
        except Exception:
             return QuotaInfo(tokens_remaining=100000, requests_remaining=1000)
