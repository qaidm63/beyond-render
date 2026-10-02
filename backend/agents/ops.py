"""
Ops Agent — Telegram notification gateway.
Blueprint § 2 (`agents/ops.py`) and § 6 Phase 4.

Pushes urgent alerts (high-match discoveries, pitches awaiting approval) to the
operator's Telegram chat.

Design rule, enforced throughout: **notification is never load-bearing.**
A dead bot token, a revoked chat, or an offline sandbox must degrade to a log
line — never to a failed sweep or a 500 on an operator action. Every public
coroutine here returns a bool instead of raising.
"""

from __future__ import annotations

import html
import logging

import httpx

from backend.core.schemas import JobOpportunity
from backend.core.secrets import get_secret

logger = logging.getLogger("shadow-matrix.ops")

TELEGRAM_API = "https://api.telegram.org"

# Telegram hard-rejects messages over 4096 characters.
MAX_MESSAGE_LENGTH = 4096


def configured() -> bool:
    """True when both the bot token and the target chat id are present."""
    return (
        get_secret("TELEGRAM_BOT_TOKEN") is not None
        and get_secret("TELEGRAM_CHAT_ID") is not None
    )


def _truncate(message: str) -> str:
    if len(message) <= MAX_MESSAGE_LENGTH:
        return message
    return message[: MAX_MESSAGE_LENGTH - 3] + "..."


async def notify(message: str, *, timeout: float = 15.0) -> bool:
    """
    Send an operator alert. Returns True on success, False on any failure.

    Deliberately swallows every exception: see the module docstring.
    """
    if not configured():
        logger.info("Telegram not configured; skipping alert: %s", message[:80])
        return False

    token = get_secret("TELEGRAM_BOT_TOKEN")
    chat_id = get_secret("TELEGRAM_CHAT_ID")
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": _truncate(message),
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
    except Exception as exc:  # noqa: BLE001 - alerts must never break callers
        logger.warning("Telegram alert failed to send: %s", exc)
        return False

    if response.status_code >= 400:
        # The token never reaches the log; Telegram echoes it in no field, but
        # the URL would, so only the body is recorded.
        logger.warning(
            "Telegram rejected the alert (HTTP %s): %s",
            response.status_code,
            response.text[:200],
        )
        return False

    return True


def _esc(value: str) -> str:
    """Escape user/vendor-controlled text for Telegram's HTML parse mode."""
    return html.escape(value, quote=False)


def format_high_match(job: JobOpportunity) -> str:
    """Render a single high-match discovery."""
    score = f"{job.fitScore:.1f}" if job.fitScore is not None else "n/a"
    lines = [
        "<b>High match discovered</b>",
        f"<b>{_esc(job.title)}</b> — {_esc(job.company)}",
        f"Fit score: <b>{score}</b>",
    ]
    if job.location:
        lines.append(f"Location: {_esc(job.location)}")
    if job.bestProjectId:
        lines.append(f"Closest project: {_esc(job.bestProjectId)}")
    lines.append(f'<a href="{_esc(job.url)}">Open posting</a>')
    return "\n".join(lines)


async def notify_high_matches(
    jobs: list[JobOpportunity],
    *,
    limit: int = 5,
) -> bool:
    """
    Announce the accepted jobs from a sweep as one digest.

    One message, not one per job: a sweep that surfaces twenty matches should
    not produce twenty notifications.
    """
    if not jobs:
        return False

    ranked = sorted(jobs, key=lambda j: j.fitScore or 0.0, reverse=True)
    header = f"<b>Sweep complete — {len(jobs)} high match(es)</b>"
    body = "\n\n".join(format_high_match(job) for job in ranked[:limit])
    if len(ranked) > limit:
        body += f"\n\n<i>…and {len(ranked) - limit} more in the Radar.</i>"
    return await notify(f"{header}\n\n{body}")


async def notify_pitch_ready(
    company_name: str,
    company_id: str,
    vip_link: str,
) -> bool:
    """Announce a drafted pitch waiting for approval in the Pitch Studio."""
    message = "\n".join(
        [
            "<b>Pitch drafted — awaiting approval</b>",
            f"Company: {_esc(company_name)}",
            f"VIP route: {_esc(vip_link)}",
            "",
            "<i>The link stays private (404) until you approve it.</i>",
        ]
    )
    return await notify(message)


async def notify_sweep_failure(reason: str) -> bool:
    """Announce a sweep that could not complete."""
    return await notify(
        f"<b>Sweep failed</b>\n<pre>{_esc(reason[:500])}</pre>"
    )
