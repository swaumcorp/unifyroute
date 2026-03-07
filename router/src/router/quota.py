import os
import json
import redis.asyncio as redis
from typing import Optional, Tuple
from uuid import UUID

# Redis global pool
_redis_pool = None

def get_redis() -> redis.Redis:
    global _redis_pool
    if _redis_pool is None:
        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        _redis_pool = redis.from_url(url, decode_responses=True)
    return _redis_pool

async def get_quota_for_model(credential_id: UUID, model_id: str) -> Optional[int]:
    """Retrieves the quota remaining for a specific credential + model from Redis."""
    try:
        r = get_redis()
        key = f"quota:{credential_id}:{model_id}"
        val = await r.get(key)
        if val is not None:
            return int(val)
    except Exception as e:
        print(f"[Quota Error] Redis connection failed: {e}")
    return None

async def mark_provider_failed(credential_id: UUID, model_id: str, timeout_seconds: int = 60):
    """Marks a selected provider/model combination as failed (e.g., 429/503), preventing usage for `timeout_seconds`."""
    try:
        r = get_redis()
        key = f"failed:{credential_id}:{model_id}"
        await r.setex(key, timeout_seconds, "1")
    except Exception as e:
        print(f"[Quota Error] Failed to mark provider failed: {e}")

async def is_provider_failed(credential_id: UUID, model_id: str) -> bool:
    """Checks if the provider/model combo is currently in a cooldown state."""
    try:
        r = get_redis()
        key = f"failed:{credential_id}:{model_id}"
        return await r.exists(key) > 0
    except Exception as e:
        print(f"[Quota Error] Redis connection failed: {e}")
        return False

async def trigger_provider_sync():
    """Trigger a background synchronization of provider models and credentials."""
    # This might be handled by the quota-poller service now.
    pass

