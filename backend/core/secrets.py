"""
Shadow Matrix — Secret & session management.
============================================
Blueprint § 2 / § 6: "API key and session management (manual configuration)".

HARD RULES enforced by this module (Blueprint closing note):
  * Secrets are READ ONLY — never generated, never fabricated, never guessed.
  * No 2FA bypass, no credential automation. Browser sessions arrive as a
    `cookies.json` file that the system operator exports and places manually.
  * Missing secrets fail loudly and early, with an actionable message.
  * Nothing in this file contains a real value. Placeholders only.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Repository root = two levels up from backend/core/
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / ".env"
COOKIES_PATH = REPO_ROOT / "backend" / "cookies.json"

load_dotenv(ENV_PATH)


class MissingSecretError(RuntimeError):
    """Raised when a required secret is absent. Never swallowed silently."""


@dataclass(frozen=True)
class SecretSpec:
    name: str
    description: str
    required: bool = True


# The complete inventory of secrets this system consumes.
# `placeholder` values live in `.env.example`; real values live only in `.env`,
# which is git-ignored.
SECRET_INVENTORY: tuple[SecretSpec, ...] = (
    SecretSpec("SUPABASE_URL", "Supabase project REST URL"),
    SecretSpec(
        "SUPABASE_SECRET_KEY",
        "Supabase secret/service key — server-side only, never sent to a browser",
    ),
    SecretSpec(
        "SUPABASE_SERVICE_ROLE_JWT",
        "Legacy JWT service-role key (required by supabase-py 2.x)",
        required=False,
    ),
    SecretSpec(
        "SUPABASE_PUBLISHABLE_KEY",
        "Supabase publishable/anon key",
        required=False,
    ),
    SecretSpec("DATABASE_URL", "Postgres connection string (pgvector enabled)"),
    SecretSpec("GEMINI_API_KEY", "Gemini key for embeddings and analysis"),
    SecretSpec("GEMINI_MODEL", "Gemini generation model id", required=False),
    SecretSpec("GEMINI_EMBEDDING_MODEL", "Gemini embedding model id", required=False),
    SecretSpec("SUPABASE_JWKS_URL", "JWKS endpoint for operator JWT verification", required=False),
    SecretSpec("SUPABASE_JWT_SECRET", "Legacy HS256 JWT secret (fallback verifier)", required=False),
    SecretSpec("ADMIN_EMAILS", "Comma-separated operator allowlist", required=False),
    SecretSpec("TELEGRAM_BOT_TOKEN", "Telegram bot token for ops alerts", required=False),
    SecretSpec("TELEGRAM_CHAT_ID", "Telegram chat id for ops alerts", required=False),
    SecretSpec(
        "PUBLIC_BASE_URL",
        "Public origin recruiters reach, used to build absolute VIP links",
        required=False,
    ),
    SecretSpec("AMD_BASE_URL", "AMD Radeon Cloud OpenAI-compatible base URL", required=False),
    SecretSpec(
        "AMD_API_KEYS",
        "Comma-separated AMD Radeon Cloud keys, rotated round-robin",
        required=False,
    ),
    SecretSpec("AMD_MODEL_VISION", "Model id for DOM/vision extraction", required=False),
    SecretSpec("AMD_MODEL_ANALYST", "Model id for the relevance pre-filter", required=False),
    SecretSpec("AMD_MODEL_TAILOR", "Model id for cover-letter generation", required=False),
    SecretSpec(
        "SWEEP_INTERVAL_MINUTES",
        "Periodic sweep interval; 0 or unset disables the scheduler",
        required=False,
    ),
)


def get_secret(name: str, default: str | None = None) -> str | None:
    """Read a secret from the environment. Returns ``default`` when unset."""
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def require_secret(name: str) -> str:
    """Read a secret, raising a precise error when it is absent."""
    value = get_secret(name)
    if value is None:
        spec = next((s for s in SECRET_INVENTORY if s.name == name), None)
        hint = f" ({spec.description})" if spec else ""
        raise MissingSecretError(
            f"Required secret '{name}'{hint} is not set. "
            f"Add it to {ENV_PATH} — see .env.example. "
            "Secrets are supplied manually by the system operator."
        )
    return value


def audit_secrets() -> dict[str, bool]:
    """Report which inventory secrets are present. Never returns values."""
    return {spec.name: get_secret(spec.name) is not None for spec in SECRET_INVENTORY}


def missing_required_secrets() -> list[str]:
    """Names of required secrets that are not configured."""
    return [s.name for s in SECRET_INVENTORY if s.required and get_secret(s.name) is None]


def load_browser_cookies(path: Path | None = None) -> list[dict[str, Any]]:
    """
    Load the browser session cookies used by the DOM engine (Blueprint § 4,
    Layer 2) to pass login walls on anti-bot platforms.

    The file is EXPORTED MANUALLY by the system operator from a real, already
    authenticated browser session. This function never performs a login, never
    touches 2FA, and never creates credentials.
    """
    target = path or COOKIES_PATH
    if not target.exists():
        raise MissingSecretError(
            f"Browser session file not found at {target}. "
            "Export cookies manually from an authenticated browser session and "
            "save them as a JSON array (Playwright storage format). "
            "Automated login and 2FA handling are explicitly out of scope."
        )
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise MissingSecretError(f"{target} is not valid JSON: {exc}") from exc

    if isinstance(data, dict) and "cookies" in data:
        data = data["cookies"]
    if not isinstance(data, list):
        raise MissingSecretError(
            f"{target} must contain a JSON array of cookie objects "
            "(or a Playwright storage_state object with a 'cookies' key)."
        )
    return data


def cookies_available(path: Path | None = None) -> bool:
    """Non-throwing check used by health reporting and the scout router."""
    return (path or COOKIES_PATH).exists()
