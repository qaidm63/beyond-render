"""
Shadow Matrix — AMD Radeon Cloud provider (OpenAI-compatible).
Phase 4 extension.

Speaks the OpenAI `chat/completions` protocol against AMD's Token Factory,
driving a `KeyRing` so every request rotates across the configured keys and
fails over instantly when one is throttled.

No new dependency: the endpoint is plain HTTP and `httpx` is already in the
locked dependency list, so the `openai` SDK is not pulled in.

Retry policy
------------
    429, 5xx, timeouts, connection errors -> isolate the key, retry next key
    401 / 403                             -> isolate for a long window, retry
                                             next key (that credential is
                                             broken, not busy)
    400 / 404 / 422                       -> raise immediately; the request is
                                             malformed and every key will
                                             reject it identically

Each key is tried at most once per request, so a call can never spin.
"""

from __future__ import annotations

import logging

import httpx

from .keyring import AllKeysUnavailableError, KeyRing, KeyState
from .secrets import get_secret

logger = logging.getLogger("shadow-matrix.amd")

DEFAULT_BASE_URL = "https://developer.amd.com.cn/radeon/api/v1"

# A dead or revoked credential should not be retried every minute.
AUTH_FAILURE_COOLDOWN = 900.0

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
FATAL_STATUS = {400, 404, 405, 413, 422}


class AMDError(RuntimeError):
    """Raised when a completion could not be produced after full failover."""


def configured_keys() -> list[str]:
    """Parse `AMD_API_KEYS` (comma-separated). Empty list when unset."""
    raw = get_secret("AMD_API_KEYS", "") or ""
    return [part.strip() for part in raw.split(",") if part.strip()]


def base_url() -> str:
    return (get_secret("AMD_BASE_URL", DEFAULT_BASE_URL) or DEFAULT_BASE_URL).rstrip("/")


_ring: KeyRing | None = None


def get_keyring() -> KeyRing:
    """Process-wide key pool. Built once so breaker state survives requests."""
    global _ring
    if _ring is None:
        _ring = KeyRing(configured_keys())
    return _ring


def reset_keyring() -> None:
    """Drop the cached pool. Used by tests and after a config change."""
    global _ring
    _ring = None


def available() -> bool:
    """True when at least one AMD key is configured."""
    return bool(configured_keys())


class AMDChatProvider:
    """
    One model on AMD Radeon Cloud, backed by the shared rotating key pool.

    Instances are cheap: create one per agent/model. They all share the same
    `KeyRing`, so a key tripped by the Tailor is also skipped by the Analyst.
    """

    def __init__(
        self,
        model: str,
        *,
        timeout: float = 90.0,
        temperature: float = 0.4,
        max_tokens: int = 1024,
        keyring: KeyRing | None = None,
    ) -> None:
        self.model = model
        self.name = f"amd:{model}"
        self.online = True
        self._timeout = timeout
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._keyring = keyring

    @property
    def keyring(self) -> KeyRing:
        return self._keyring or get_keyring()

    # ------------------------------------------------------------- #
    # Request construction                                           #
    # ------------------------------------------------------------- #

    def _payload(
        self,
        prompt: str,
        system: str | None,
        images: list[str] | None = None,
    ) -> dict:
        """
        Build an OpenAI-shaped chat payload.

        When `images` are supplied the user turn switches to the multimodal
        content-array form. Text-only models reject that shape, which is the
        correct outcome: it surfaces a wrong model assignment loudly instead
        of silently discarding the image.
        """
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})

        if images:
            content: list[dict] = [{"type": "text", "text": prompt}]
            for image in images:
                content.append(
                    {"type": "image_url", "image_url": {"url": image}}
                )
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "user", "content": prompt})

        return {
            "model": self.model,
            "messages": messages,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
        }

    @staticmethod
    def _extract(body: dict) -> str:
        choices = body.get("choices") or []
        if not choices:
            raise AMDError("Response contained no choices.")
        message = choices[0].get("message") or {}
        content = message.get("content")

        # Some OpenAI-compatible servers return content as a parts array.
        if isinstance(content, list):
            content = "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict)
            )

        text = (content or "").strip()
        if not text:
            raise AMDError("Response contained an empty completion.")
        return text

    # ------------------------------------------------------------- #
    # Execution with rotation + failover                             #
    # ------------------------------------------------------------- #

    async def agenerate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        """Generate a completion, rotating keys and failing over on faults."""
        if not prompt or not prompt.strip():
            raise AMDError("Refusing to send an empty prompt.")

        ring = self.keyring
        url = f"{base_url()}/chat/completions"
        payload = self._payload(prompt, system, images)
        tried: set[str] = set()
        last_reason = "no attempt made"

        # At most one attempt per key: bounded, never a spin loop.
        for _ in range(len(ring)):
            try:
                state: KeyState = await ring.acquire(exclude=tried)
            except AllKeysUnavailableError as exc:
                raise AMDError(
                    f"{exc} Last failure: {last_reason}"
                ) from exc

            tried.add(state.key)

            async with state.semaphore:
                try:
                    async with httpx.AsyncClient(timeout=self._timeout) as client:
                        response = await client.post(
                            url,
                            headers={
                                "Authorization": f"Bearer {state.key}",
                                "Content-Type": "application/json",
                            },
                            json=payload,
                        )
                except Exception as exc:  # noqa: BLE001 - transport is retryable
                    last_reason = f"transport error: {exc}"
                    ring.trip(state, last_reason)
                    continue

                status = response.status_code

                if status in FATAL_STATUS:
                    # Every key would reject this identically — stop now.
                    ring.record_failure(state, f"HTTP {status}")
                    raise AMDError(
                        f"AMD rejected the request (HTTP {status}): "
                        f"{response.text[:300]}"
                    )

                if status in (401, 403):
                    last_reason = f"authentication failed (HTTP {status})"
                    ring.trip(state, last_reason, cooldown=AUTH_FAILURE_COOLDOWN)
                    continue

                if status in RETRYABLE_STATUS or status >= 500:
                    last_reason = f"HTTP {status}"
                    # Honour Retry-After when the server sends one.
                    cooldown = None
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            cooldown = max(1.0, float(retry_after))
                        except ValueError:
                            cooldown = None
                    ring.trip(state, last_reason, cooldown=cooldown)
                    continue

                if status >= 400:
                    ring.record_failure(state, f"HTTP {status}")
                    raise AMDError(
                        f"AMD returned HTTP {status}: {response.text[:300]}"
                    )

                try:
                    text = self._extract(response.json())
                except AMDError:
                    raise
                except Exception as exc:  # noqa: BLE001
                    last_reason = f"unparseable response: {exc}"
                    ring.record_failure(state, last_reason)
                    continue

                ring.record_success(state)
                return text

        raise AMDError(
            f"All {len(ring)} key(s) failed for model '{self.model}'. "
            f"Last failure: {last_reason}"
        )

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        """
        Blocking wrapper for synchronous call sites.

        Refuses to run inside a live event loop: `asyncio.run` would raise
        there anyway, and silently spawning a second loop hides the bug.
        Async callers must await `agenerate`.
        """
        import asyncio

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.agenerate(prompt, system=system))

        raise AMDError(
            "generate() was called from inside a running event loop. "
            "Await agenerate() instead."
        )
