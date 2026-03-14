import logging
import os
from typing import Any, List

import litellm

from shared.models import Credential
from shared.security import decrypt_secret
from .base import ProviderAdapter, ModelInfo, QuotaInfo, fetch_json_safe

logger = logging.getLogger(__name__)


class OllamaAdapter(ProviderAdapter):
    """Ollama / Ollama Cloud adapter.

    Key differences from the generic ProviderAdapter:
    - Uses the ``ollama_chat/`` litellm prefix so requests hit ``/api/chat``
      (the generic ``ollama/`` prefix hits the legacy ``/api/generate`` endpoint).
    - Explicitly injects ``Authorization: Bearer <key>`` as an extra HTTP header
      because litellm's built-in Ollama handler ignores the ``api_key`` parameter.
    - Resolves the API base URL from (in priority order):
        1. The ``PROVIDER_OLLAMA_BASE_URL`` environment variable.
        2. The provider's ``base_url`` field stored in the database.
        3. The default ``https://ollama.com`` (Ollama Cloud).
    - Implements ``list_models`` by querying the ``/api/tags`` endpoint when a
      base URL is known, falling back to an empty list gracefully.
    """

    def __init__(self) -> None:
        super().__init__("ollama", "ollama_chat")

    def _resolve_base_url(self, credential: Credential) -> str:
        """Return the API base URL to use, respecting env overrides and DB value."""
        pname = "OLLAMA"
        env_override = os.environ.get(f"PROVIDER_{pname}_BASE_URL")
        if env_override:
            return env_override.rstrip("/")
        if credential.provider and credential.provider.base_url:
            return credential.provider.base_url.rstrip("/")
        return "https://ollama.com"

    async def chat(
        self,
        credential: Credential,
        messages: list,
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> Any:
        """Chat via litellm using ollama_chat/ prefix with Bearer auth header."""
        api_key = decrypt_secret(credential.secret_enc, credential.iv)
        api_base = self._resolve_base_url(credential)
        model_str = f"ollama_chat/{model}"

        litellm.drop_params = True

        # litellm's Ollama handler silently ignores `api_key`, so we must inject
        # the Authorization header ourselves.
        extra_headers: dict = kwargs.pop("extra_headers", {})
        if api_key and api_key.strip():
            extra_headers["Authorization"] = f"Bearer {api_key}"

        logger.info(
            "🚀 OUTBOUND REQUEST (Ollama): model=[%s] target=[%s] api_base=[%s] stream=[%s]",
            model,
            model_str,
            api_base,
            stream,
        )

        try:
            response = await litellm.acompletion(
                model=model_str,
                messages=messages,
                api_key=api_key,
                api_base=api_base,
                stream=stream,
                extra_headers=extra_headers,
                **kwargs,
            )
            logger.info("✅ SUCCESS (Ollama): model=[%s] stream=[%s]", model, stream)
            return response
        except Exception as exc:
            logger.error(
                "❌ FAILED (Ollama): model=[%s] api_base=[%s] | Error: %s",
                model,
                api_base,
                str(exc),
            )
            raise

    async def list_models(self, credential: Credential) -> List[ModelInfo]:
        """Fetch models from Ollama's /api/tags endpoint."""
        api_key = decrypt_secret(credential.secret_enc, credential.iv)
        base_url = self._resolve_base_url(credential)
        tags_url = f"{base_url}/api/tags"

        headers: dict = {}
        if api_key and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key}"

        data = await fetch_json_safe(url=tags_url, headers=headers, timeout_ms=10_000)
        
        # If /api/tags fails or returns empty, try OpenAI-style /v1/models
        if not data or (not data.get("models") and not data.get("data")):
            fallback_url = f"{base_url}/v1/models"
            data2 = await fetch_json_safe(url=fallback_url, headers=headers, timeout_ms=10_000)
            if data2:
                data = data2

        if not data:
            logger.warning("list_models (Ollama): api returned no data from %s", base_url)
            return []

        raw_models = data.get("models") or data.get("data", [])
        results: List[ModelInfo] = []
        for m in raw_models:
            model_id = m.get("name") or m.get("id", "")
            if not model_id:
                continue
            results.append(
                ModelInfo(
                    model_id=model_id,
                    display_name=model_id,
                    context_window=m.get("context_window", 128_000),
                    supports_streaming=True,
                    supports_functions=False,
                )
            )
        logger.info("list_models (Ollama): %d model(s) returned from %s", len(results), base_url)
        return results
