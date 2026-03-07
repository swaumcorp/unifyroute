import httpx
from typing import Dict, Any, List
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo

class OpenAIAdapter(ProviderAdapter):
    def __init__(self):
        super().__init__("openai", "openai")
        
    async def _list_models_impl(self, api_key: str, auth_type: str = "api_key") -> List[ModelInfo]:
        from .base import fetch_json_safe
        
        data = await fetch_json_safe(
            url="https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout_ms=10000,
            method="GET"
        )
        
        if not data or not isinstance(data, dict):
            return []
            
        models = []
        for m in data.get("data", []):
            m_id = m.get("id", "")
            # Exclude unusable/audio/realtime models
            if "realtime" in m_id or "audio" in m_id or m_id.startswith("tts-") or m_id.startswith("whisper-"):
                continue
            if m_id.startswith("dall-e") or m_id.startswith("babbage") or m_id.startswith("davinci"):
                continue
            models.append(ModelInfo(model_id=m_id, display_name=f"OpenAI {m_id}"))
        return models

    async def _get_quota_impl(self, api_key: str, auth_type: str = "api_key") -> QuotaInfo:
        # OpenAI doesn't have a direct quota endpoint anymore (deprecated).
        # Typically we check billing/usage or rely on headers from actual requests.
        # Fallback to returning a default "healthy" snapshot.
        return QuotaInfo(tokens_remaining=1000000, requests_remaining=10000)
