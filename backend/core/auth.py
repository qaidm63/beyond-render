"""
Shadow Matrix — Operator authentication.
Blueprint § 5: "/matrix-admin — Protected Route".

DECISION: Supabase Auth. The operator signs in with Supabase in the browser;
the backend verifies the resulting JWT on every protected request. The browser
is never trusted to assert its own authorisation — `ProtectedRoute` only hides
UI, the real gate is here.

Two token families are supported, because Supabase is mid-migration:
  * Asymmetric (RS256/ES256) — verified against the project JWKS endpoint.
  * Legacy symmetric (HS256)  — verified with SUPABASE_JWT_SECRET.

Authorisation is an explicit allowlist (`ADMIN_EMAILS`). A valid Supabase user
is NOT automatically an operator: anyone can sign up to a Supabase project, so
authentication alone must never grant access to the Command Center.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from .secrets import get_secret

logger = logging.getLogger("shadow-matrix.auth")

# Cached JWKS client; refreshed lazily by PyJWT itself.
_jwks_client: Any | None = None
_jwks_failed_at: float = 0.0
_JWKS_RETRY_SECONDS = 60.0


@dataclass(frozen=True)
class Operator:
    """An authenticated, authorised Command Center user."""

    user_id: str
    email: str
    role: str


class AuthNotConfiguredError(RuntimeError):
    """Raised when no verification material is available at all."""


def admin_emails() -> set[str]:
    """The operator allowlist, lower-cased."""
    raw = get_secret("ADMIN_EMAILS", "") or ""
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def auth_configured() -> bool:
    """True when the backend can verify a token AND knows who may pass."""
    has_verifier = bool(
        get_secret("SUPABASE_JWKS_URL") or get_secret("SUPABASE_JWT_SECRET")
    )
    return has_verifier and bool(admin_emails())


def _get_jwks_client() -> Any | None:
    """Memoised PyJWKClient, with a cooldown so a dead JWKS doesn't hammer."""
    global _jwks_client, _jwks_failed_at

    if _jwks_client is not None:
        return _jwks_client

    url = get_secret("SUPABASE_JWKS_URL")
    if not url:
        return None

    if time.monotonic() - _jwks_failed_at < _JWKS_RETRY_SECONDS:
        return None

    try:
        from jwt import PyJWKClient

        _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=600)
        return _jwks_client
    except Exception as exc:  # noqa: BLE001 - fall back to HS256
        _jwks_failed_at = time.monotonic()
        logger.warning("JWKS client unavailable (%s); will try HS256.", exc)
        return None


ASYMMETRIC_ALGS = ("RS256", "ES256")
SYMMETRIC_ALGS = ("HS256",)


def decode_token(token: str) -> dict[str, Any]:
    """
    Verify a Supabase access token and return its claims.

    Signature, expiry and audience are all enforced.

    The token's own `alg` header selects the verification family. This matters:
    if we simply tried asymmetric and then fell through to symmetric, an
    invalid RS256 token would end up reported as "auth not configured" (a 503)
    instead of "rejected" (a 401) whenever no HS256 secret is set — masking an
    authentication failure as an outage.

    The header is untrusted input, so it is only ever used to CHOOSE a
    verifier, never to weaken one: an unexpected algorithm is rejected outright
    and `jwt.decode` is always pinned to an explicit algorithm allowlist (which
    is what makes an `alg: none` forgery fail).

    Raises:
        ValueError            - the token is invalid, expired or malformed (401)
        AuthNotConfiguredError- no material exists to verify this family (503)
    """
    import jwt

    options = {"require": ["exp", "sub"]}

    try:
        algorithm = str(jwt.get_unverified_header(token).get("alg", "")).upper()
    except jwt.PyJWTError as exc:
        raise ValueError(f"Malformed token: {exc}") from exc

    # --- Asymmetric family (current Supabase signing keys) -----------
    if algorithm in ASYMMETRIC_ALGS:
        client = _get_jwks_client()
        if client is None:
            raise AuthNotConfiguredError(
                "Cannot verify an asymmetric token: SUPABASE_JWKS_URL is unset "
                "or the JWKS endpoint is unreachable."
            )
        try:
            signing_key = client.get_signing_key_from_jwt(token)
        except jwt.PyJWTError as exc:
            # Unknown key id: the token was not issued by this project.
            raise ValueError(f"Token rejected: {exc}") from exc
        except Exception as exc:  # noqa: BLE001 - JWKS fetch/network problems
            raise AuthNotConfiguredError(f"JWKS lookup failed: {exc}") from exc

        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=list(ASYMMETRIC_ALGS),
                audience="authenticated",
                options=options,
            )
        except jwt.PyJWTError as exc:
            raise ValueError(f"Token rejected: {exc}") from exc

    # --- Legacy symmetric family -------------------------------------
    if algorithm in SYMMETRIC_ALGS:
        secret = get_secret("SUPABASE_JWT_SECRET")
        if not secret:
            raise AuthNotConfiguredError(
                "Cannot verify a legacy HS256 token: SUPABASE_JWT_SECRET is "
                "unset."
            )
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=list(SYMMETRIC_ALGS),
                audience="authenticated",
                options=options,
            )
        except jwt.PyJWTError as exc:
            raise ValueError(f"Token rejected: {exc}") from exc

    # Anything else — including `alg: none` — is refused outright.
    raise ValueError(f"Unsupported token algorithm: {algorithm or '<missing>'}")


def _extract_token(request: Request) -> str | None:
    """Bearer header first, then the session cookie set by supabase-js."""
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        candidate = header[7:].strip()
        if candidate:
            return candidate
    return request.cookies.get("sm_access_token")


async def current_operator(request: Request) -> Operator:
    """
    FastAPI dependency: resolve and authorise the caller.

    Raises 401 for anything that is not a verified operator on the allowlist.
    Error details are deliberately coarse — we never reveal whether a token was
    merely expired, badly signed, or simply not on the allowlist.
    """
    if not auth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Operator authentication is not configured. Set "
                "SUPABASE_JWKS_URL and ADMIN_EMAILS."
            ),
        )

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing operator credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = decode_token(token)
    except AuthNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    email = str(claims.get("email", "")).lower()
    if not email or email not in admin_emails():
        # Authenticated but not authorised. Logged, because a real user
        # reaching this point is worth knowing about.
        logger.warning("Rejected non-operator sign-in attempt: %r", email or "<none>")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    return Operator(
        user_id=str(claims.get("sub", "")),
        email=email,
        role=str(claims.get("role", "authenticated")),
    )


# Convenience alias for route signatures.
RequireOperator = Depends(current_operator)
