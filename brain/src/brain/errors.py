"""Brain friendly error handling.

Maps exceptions and HTTP errors to human-readable messages,
so Brain endpoints never surface raw tracebacks to callers.
"""
from __future__ import annotations


def brain_safe_message(exc: Exception) -> str:
    """Convert any exception into a safe, user-friendly message string."""
    msg = str(exc).lower()

    if "insufficient balance" in msg or "insufficient_quota" in msg or "more credits" in msg or "out of credits" in msg:
        return (
            "The AI provider account has insufficient balance or quota. "
            "Please recharge or check your billing settings."
        )
    if "authenticationerror" in msg or "invalid_api_key" in msg or "incorrect api key" in msg or "unauthorized" in msg:
        return (
            "The API key for this provider is invalid or unauthorized. "
            "Please verify the credential."
        )
    if "ratelimiterror" in msg or "rate limit" in msg or "429" in msg:
        return (
            "The rate limit for this provider has been exceeded. "
            "Please wait and try again."
        )
    if "connection" in msg or "timeout" in msg or "readtimeout" in msg or "connecterror" in msg:
        return (
            "Unable to reach the provider's API. "
            "The server may be unavailable or there is a network issue."
        )
    if "not found" in msg or "404" in msg:
        return "The requested provider endpoint was not found. The URL may be incorrect."
    if "ssl" in msg or "certificate" in msg:
        return "An SSL/TLS error occurred when contacting the provider."
    if "name or service not known" in msg or "nodename nor servname provided" in msg or "errno -2" in msg or "errno 8" in msg:
        return (
            "Domain not reachable. Please verify the API Base URL is correct. "
            "For custom endpoints, you must provide the correct API Base URL."
        )
    # Fallback: sanitised first 200 chars
    raw = str(exc)
    return raw[:200] if len(raw) <= 200 else raw[:197] + "..."
