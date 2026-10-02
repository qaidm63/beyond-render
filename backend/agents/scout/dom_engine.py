"""
Scout Layer 2 — Vision & DOM Engine.
Blueprint § 4.2: the emergency path, ~20% of coverage.

Strategy: drive Playwright to emulate genuine browsing against anti-bot
protected platforms (e.g. LinkedIn). The script loads `cookies.json`, which the
system operator exports MANUALLY from an already-authenticated session, in
order to pass login walls.

EXPLICIT PROHIBITION (Blueprint closing note): this engine never attempts to
log in, never handles 2FA, and never fabricates credentials. If the session
file is absent or expired it fails loudly and defers to the operator.

PHASE 2 implements this. Phase 1 fixes the contract only.
"""

from __future__ import annotations

from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity
from backend.core.secrets import cookies_available, load_browser_cookies

SUPPORTED_SOURCES: tuple[str, ...] = ("linkedin",)


def session_ready() -> bool:
    """True when an operator-provided browser session file is present."""
    return cookies_available()


async def fetch(
    config: SearchConfiguration,
    search_terms: list[str],
) -> list[JobOpportunity]:
    """Scrape protected platforms behind an operator session. Phase 2."""
    load_browser_cookies()  # fails loudly when the operator has not supplied it
    raise NotImplementedError("DOM engine lands in Phase 2.")
