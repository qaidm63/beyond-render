"""
Shadow Matrix — Asynchronous key rotation with circuit breaking.
Blueprint § 4 (resilience of the swarm) · Phase 4 extension.

A pool of interchangeable API keys consumed round-robin. Any key that hits a
rate limit or a transient server fault is isolated for a cool-down window while
the request immediately retries on the next healthy key, so a single throttled
credential never stalls the pipeline.

State machine per key
---------------------
    CLOSED  — healthy, eligible for selection
    OPEN    — isolated until `recovers_at`; skipped by the selector
    (there is no HALF_OPEN: expiry of the window returns a key straight to
     CLOSED, and the next real request is itself the probe. A separate
     half-open state would add bookkeeping without changing behaviour here.)

Concurrency
-----------
Each key carries its own semaphore. The provider documents a per-key
concurrency ceiling, and exceeding it earns a 429 — which would trip the very
key we are trying to use. Bounding in-flight requests per key prevents us from
manufacturing our own rate limiting.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger("shadow-matrix.keyring")

DEFAULT_COOLDOWN_SECONDS = 60.0
# The provider documents 8 concurrent requests per key.
DEFAULT_CONCURRENCY_PER_KEY = 8


class NoKeysConfiguredError(RuntimeError):
    """Raised when the pool is empty — a configuration fault, not a runtime one."""


class AllKeysUnavailableError(RuntimeError):
    """Every key in the pool is currently isolated."""

    def __init__(self, retry_after: float) -> None:
        self.retry_after = retry_after
        super().__init__(
            f"All API keys are rate-limited or failing. "
            f"Earliest recovery in {retry_after:.1f}s."
        )


@dataclass
class KeyState:
    """Health and usage of one credential. Never holds the key in logs."""

    key: str
    label: str
    recovers_at: float = 0.0
    trip_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    last_error: str | None = None
    semaphore: asyncio.Semaphore = field(
        default_factory=lambda: asyncio.Semaphore(DEFAULT_CONCURRENCY_PER_KEY)
    )

    def is_open(self, now: float | None = None) -> bool:
        """True while the breaker is isolating this key."""
        return (now or time.monotonic()) < self.recovers_at

    def as_dict(self) -> dict:
        now = time.monotonic()
        return {
            "label": self.label,
            "state": "open" if self.is_open(now) else "closed",
            "cooldownRemaining": round(max(0.0, self.recovers_at - now), 1),
            "tripCount": self.trip_count,
            "successCount": self.success_count,
            "failureCount": self.failure_count,
            "lastError": self.last_error,
        }


def mask(key: str) -> str:
    """
    Render a key safe for logs and dashboards.

    Keeps a short prefix and suffix so an operator can tell *which* key
    misbehaved without the log becoming a credential leak.
    """
    if len(key) <= 12:
        return "****"
    return f"{key[:6]}…{key[-4:]}"


class KeyRing:
    """Round-robin pool of API keys with per-key circuit breaking."""

    def __init__(
        self,
        keys: list[str],
        *,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
        concurrency_per_key: int = DEFAULT_CONCURRENCY_PER_KEY,
    ) -> None:
        cleaned: list[str] = []
        for key in keys:
            candidate = key.strip()
            # Duplicated keys would share a rate limit while presenting as
            # independent capacity — worse than having one.
            if candidate and candidate not in cleaned:
                cleaned.append(candidate)

        if not cleaned:
            raise NoKeysConfiguredError(
                "No API keys supplied. Set the relevant *_API_KEYS variable in "
                ".env as a comma-separated list. Keys are provided manually by "
                "the system operator and are never generated."
            )

        self.cooldown_seconds = cooldown_seconds
        self._states: list[KeyState] = [
            KeyState(
                key=key,
                label=mask(key),
                semaphore=asyncio.Semaphore(concurrency_per_key),
            )
            for key in cleaned
        ]
        self._cursor = 0
        self._lock = asyncio.Lock()

    def __len__(self) -> int:
        return len(self._states)

    @property
    def states(self) -> list[KeyState]:
        return list(self._states)

    async def acquire(self, *, exclude: set[str] | None = None) -> KeyState:
        """
        Return the next healthy key, advancing the round-robin cursor.

        `exclude` holds keys already tried for the *current* request, so a
        failover never retries the credential that just failed.
        """
        exclude = exclude or set()
        async with self._lock:
            now = time.monotonic()
            total = len(self._states)

            for offset in range(total):
                index = (self._cursor + offset) % total
                state = self._states[index]
                if state.key in exclude or state.is_open(now):
                    continue
                # Advance past the key we just handed out.
                self._cursor = (index + 1) % total
                return state

            # Nothing available. Report the shortest wait so the caller can
            # decide between backing off and failing fast.
            candidates = [
                s.recovers_at for s in self._states if s.key not in exclude
            ]
            retry_after = max(0.0, min(candidates) - now) if candidates else 0.0
            raise AllKeysUnavailableError(retry_after)

    def trip(self, state: KeyState, reason: str, cooldown: float | None = None) -> None:
        """Isolate a key for the cool-down window."""
        state.recovers_at = time.monotonic() + (cooldown or self.cooldown_seconds)
        state.trip_count += 1
        state.failure_count += 1
        state.last_error = reason
        logger.warning(
            "Key %s isolated for %.0fs — %s",
            state.label,
            cooldown or self.cooldown_seconds,
            reason,
        )

    def record_success(self, state: KeyState) -> None:
        """Mark a healthy response; closes the breaker immediately."""
        state.success_count += 1
        state.recovers_at = 0.0
        state.last_error = None

    def record_failure(self, state: KeyState, reason: str) -> None:
        """Mark a failure that does NOT justify isolating the key."""
        state.failure_count += 1
        state.last_error = reason

    def snapshot(self) -> dict:
        """Observable health, safe to serve to the dashboard. Never leaks keys."""
        now = time.monotonic()
        return {
            "total": len(self._states),
            "available": sum(1 for s in self._states if not s.is_open(now)),
            "cooldownSeconds": self.cooldown_seconds,
            "keys": [s.as_dict() for s in self._states],
        }
