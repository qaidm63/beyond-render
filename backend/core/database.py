"""
Shadow Matrix — Supabase connection.
Blueprint § 2 (`core/database.py`).

Phase 1 scope: a lazily-initialised, validated client plus a non-throwing
health probe. Table access and the pgvector schema land in Phase 2.
"""

from __future__ import annotations

import logging
from typing import Any

from .secrets import MissingSecretError, get_secret, require_secret

logger = logging.getLogger(__name__)

_client: Any | None = None


def _service_key() -> str:
    """
    Resolve the server-side Supabase key.

    Supabase now issues short `sb_secret_...` keys, but supabase-py 2.x still
    validates for the legacy JWT format and rejects the new style outright.
    We therefore prefer the JWT service-role key when the operator supplied it,
    and fall back to the modern secret key.

    Either way the key is service-grade: it bypasses row-level security and
    must never be sent to a browser.
    """
    jwt_key = get_secret("SUPABASE_SERVICE_ROLE_JWT")
    if jwt_key:
        return jwt_key
    return require_secret("SUPABASE_SECRET_KEY")


def get_supabase() -> Any:
    """
    Return a memoised Supabase client built with the SECRET (service) key.

    This key bypasses row-level security and must never leave the backend.
    """
    global _client
    if _client is not None:
        return _client

    try:
        from supabase import create_client  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "The 'supabase' package is not installed. "
            "Run: pip install -r backend/requirements.txt"
        ) from exc

    url = require_secret("SUPABASE_URL")
    key = _service_key()
    _client = create_client(url, key)
    logger.info("Supabase client initialised for %s", url)
    return _client


def database_status() -> str:
    """
    Non-throwing connectivity descriptor for /api/health.

    Returns one of: 'connected', 'unreachable: ...', 'not_configured',
    'driver_missing'.
    """
    if get_secret("SUPABASE_URL") is None or get_secret("SUPABASE_SECRET_KEY") is None:
        return "not_configured"
    try:
        client = get_supabase()
    except MissingSecretError:
        return "not_configured"
    except RuntimeError:
        return "driver_missing"
    except Exception as exc:  # noqa: BLE001 - health probe must never raise
        return f"client_error: {type(exc).__name__}"

    # Cheapest possible round-trip: ask PostgREST for its schema document.
    # Done over plain httpx so the probe does not depend on supabase-py
    # internals, which move between releases.
    import httpx

    url = require_secret("SUPABASE_URL").rstrip("/")
    key = _service_key()
    try:
        res = httpx.get(
            f"{url}/rest/v1/",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=8.0,
        )
    except Exception as exc:  # noqa: BLE001 - health probe must never raise
        return f"unreachable: {type(exc).__name__}"

    if res.status_code < 400:
        return "connected"
    if res.status_code in (401, 403):
        return f"auth_rejected: HTTP {res.status_code}"
    return f"error: HTTP {res.status_code}"
