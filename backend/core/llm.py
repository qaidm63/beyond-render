"""
Shadow Matrix — Language model providers.
Blueprint § 2 (`agents/analyst.py` — "LLM engine") and § 6 Phase 4.

Mirrors the shape of `core/embeddings.py` deliberately: one narrow Protocol,
one production provider (Gemini `generateContent`), one deterministic offline
provider so the Tailor and Analyst agents stay fully testable without a
network. Nothing here invents credentials — the key is read from the
environment the operator populated.
"""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

import httpx

from .config import (
    AMD_MODEL_ANALYST,
    AMD_MODEL_CURATOR,
    AMD_MODEL_TAILOR,
    AMD_MODEL_VISION,
    CURATOR_VISION_MODEL,
    GEMINI_MODEL,
)
from .secrets import get_secret, require_secret

logger = logging.getLogger("shadow-matrix.llm")

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


def _as_inline_data(asset: str) -> dict | None:
    """
    Convert a `data:` URL into a Gemini `inlineData` part.

    Remote URLs are skipped rather than fetched: silently pulling an operator
    -supplied URL server-side would be a request-forgery vector.
    """
    if not asset.startswith("data:"):
        return None
    try:
        header, encoded = asset.split(",", 1)
    except ValueError:
        return None
    mime = header[5:].split(";", 1)[0] or "application/octet-stream"
    if ";base64" not in header:
        return None
    return {"mimeType": mime, "data": encoded}


class LLMError(RuntimeError):
    """Raised when a completion could not be produced."""


@runtime_checkable
class LLMProvider(Protocol):
    """Minimal contract every text-generation backend must satisfy."""

    name: str
    online: bool

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        """Return completion text for ``prompt``."""
        ...

    async def agenerate(self, prompt: str, *, system: str | None = None) -> str:
        """Async form. Blocking providers implement it via a worker thread."""
        ...


# ---------------------------------------------------------------- #
# Production provider                                               #
# ---------------------------------------------------------------- #


class GeminiLLMProvider:
    """Text generation via the Gemini `generateContent` endpoint."""

    def __init__(
        self,
        model: str | None = None,
        timeout: float = 60.0,
        temperature: float = 0.4,
        max_output_tokens: int = 1024,
    ) -> None:
        self.model = model or GEMINI_MODEL or "gemini-3-flash-preview"
        self.name = f"gemini:{self.model}"
        self.online = True
        self._timeout = timeout
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        if not prompt or not prompt.strip():
            raise LLMError("Refusing to send an empty prompt.")

        api_key = require_secret("GEMINI_API_KEY")
        url = f"{GEMINI_ENDPOINT}/{self.model}:generateContent"

        parts: list[dict] = [{"text": prompt}]
        for image in images or []:
            inline = _as_inline_data(image)
            if inline is not None:
                parts.append({"inlineData": inline})

        payload: dict = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": self._temperature,
                "maxOutputTokens": self._max_output_tokens,
            },
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        try:
            response = httpx.post(
                url,
                params={"key": api_key},
                json=payload,
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise LLMError(f"Gemini generation request failed: {exc}") from exc

        if response.status_code >= 400:
            raise LLMError(
                f"Gemini generation returned HTTP {response.status_code}: "
                f"{response.text[:300]}"
            )

        body = response.json()
        candidates = body.get("candidates") or []
        if not candidates:
            # A safety block arrives as a populated promptFeedback with no
            # candidates; surfacing the reason saves a lot of guesswork.
            reason = body.get("promptFeedback", {}).get("blockReason", "unknown")
            raise LLMError(f"Gemini returned no candidates (reason: {reason}).")

        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise LLMError("Gemini returned an empty completion.")
        return text

    async def agenerate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        """httpx here is blocking; keep the event loop free."""
        import asyncio

        return await asyncio.to_thread(
            self.generate, prompt, system=system, images=images
        )


# ---------------------------------------------------------------- #
# Offline provider                                                  #
# ---------------------------------------------------------------- #


class TemplateLLMProvider:
    """
    Deterministic, network-free text generator.

    Not a language model: it echoes a clearly-labelled structured draft built
    from the prompt's own facts. It exists so the Tailor agent can be exercised
    end-to-end in CI and in air-gapped sandboxes. Output is always marked as a
    draft so an un-reviewed template can never be mistaken for generated prose
    — and the Pitch Studio requires explicit operator approval regardless.
    """

    MARKER = "[OFFLINE DRAFT — generated without a language model]"

    def __init__(self) -> None:
        self.name = "template:offline"
        self.online = False

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        if not prompt or not prompt.strip():
            raise LLMError("Refusing to render an empty prompt.")
        return f"{self.MARKER}\n\n{prompt.strip()}"

    async def agenerate(self, prompt: str, *, system: str | None = None) -> str:
        return self.generate(prompt, system=system)


# ---------------------------------------------------------------- #
# Selection                                                         #
# ---------------------------------------------------------------- #


# Which model each agent gets. Blueprint Phase 4 assignment.
ROLE_MODELS: dict[str, str | None] = {
    "vision": AMD_MODEL_VISION,
    "analyst": AMD_MODEL_ANALYST,
    "tailor": AMD_MODEL_TAILOR,
    "curator": AMD_MODEL_CURATOR,
}

# A cover letter that overruns is worse than one that is tight, but a case
# study truncated mid-JSON is unusable — the curator needs real headroom.
ROLE_MAX_TOKENS: dict[str, int] = {
    "vision": 1024,
    "analyst": 1024,
    "tailor": 1024,
    "curator": 4096,
}

# Synthesis is a factual exercise constrained by the operator's brief, so it
# runs colder than cover-letter writing.
ROLE_TEMPERATURE: dict[str, float] = {"curator": 0.3}


def get_llm_provider(
    offline: bool = False,
    role: str = "tailor",
) -> LLMProvider:
    """
    Resolve the active provider for an agent role.

    Order of preference:
      1. AMD Radeon Cloud when `AMD_API_KEYS` is set — the rotating pool is
         the primary path, and each role gets its assigned model.
      2. Gemini when `GEMINI_API_KEY` is set.
      3. The offline template provider, loudly.

    `role` must be one of ROLE_MODELS; an unknown role falls back to the
    tailor model rather than silently picking nothing.
    """
    if offline:
        logger.warning("Using OFFLINE template generation — not a language model.")
        return TemplateLLMProvider()

    # Imported here: core.amd imports core.secrets, and a module-level import
    # would make the dependency cycle load-order sensitive.
    from .amd import AMDChatProvider, available as amd_available

    max_tokens = ROLE_MAX_TOKENS.get(role, 1024)
    temperature = ROLE_TEMPERATURE.get(role, 0.4)

    if amd_available():
        model = ROLE_MODELS.get(role) or AMD_MODEL_TAILOR or "DeepSeek-V4-Flash-0731"
        return AMDChatProvider(
            model, temperature=temperature, max_tokens=max_tokens
        )

    if get_secret("GEMINI_API_KEY") is not None:
        return GeminiLLMProvider(
            temperature=temperature, max_output_tokens=max_tokens
        )

    logger.warning(
        "No AMD or Gemini credentials configured; falling back to offline "
        "template generation. Cover letters will need manual rewriting."
    )
    return TemplateLLMProvider()


def get_vision_provider(offline: bool = False) -> LLMProvider | None:
    """
    Resolve a genuinely multimodal provider for Portfolio Studio asset
    inspection, or ``None`` when none is configured.

    This is deliberately NOT ``get_llm_provider(role="vision")``. That role is
    bound to ``AMD_MODEL_VISION``, which defaults to a text-only model used
    for DOM extraction; handing it renderings would either error or, worse,
    return a confident description of nothing.

    ``None`` is a valid answer. The caller treats missing observations as a
    degraded draft rather than a failure, which beats inventing a provider
    that cannot see.
    """
    if offline:
        return None

    if get_secret("GEMINI_API_KEY") is not None:
        return GeminiLLMProvider(
            model=CURATOR_VISION_MODEL, temperature=0.2, max_output_tokens=1536
        )

    from .amd import AMDChatProvider, available as amd_available

    explicit = get_secret("AMD_MODEL_CURATOR_VISION")
    if explicit and amd_available():
        return AMDChatProvider(explicit, temperature=0.2, max_tokens=1536)

    logger.warning(
        "No multimodal provider configured; uploaded assets will not be "
        "inspected. Set GEMINI_API_KEY or AMD_MODEL_CURATOR_VISION."
    )
    return None
