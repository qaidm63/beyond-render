"""
Ops Agent — Telegram notification gateway.
Blueprint § 2 (`agents/ops.py`) and § 6 Phase 4.

Pushes urgent alerts (high-match discoveries, pitches awaiting approval) to the
operator's Telegram chat via webhook.

PHASE 4 implements this.
"""

from __future__ import annotations

from backend.core.secrets import get_secret


def configured() -> bool:
    """True when both the bot token and the target chat id are present."""
    return (
        get_secret("TELEGRAM_BOT_TOKEN") is not None
        and get_secret("TELEGRAM_CHAT_ID") is not None
    )


async def notify(message: str) -> None:
    """Send an operator alert. Phase 4."""
    raise NotImplementedError("Telegram gateway lands in Phase 4.")
