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

from .config import GEMINI_MODEL
from .secrets import get_secret, require_secret

logger = logging.getLogger("shadow-matrix.llm")

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


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
    ) -> None:
        self.model = model or GEMINI_MODEL or "gemini-3-flash-preview"
        self.name = f"gemini:{self.model}"
        self.online = True
        self._timeout = timeout
        self._temperature = temperature

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        if not prompt or not prompt.strip():
            raise LLMError("Refusing to send an empty prompt.")

        api_key = require_secret("GEMINI_API_KEY")
        url = f"{GEMINI_ENDPOINT}/{self.model}:generateContent"

        payload: dict = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self._temperature,
                # A cover letter that overruns is worse than one that is tight.
                "maxOutputTokens": 1024,
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


# ---------------------------------------------------------------- #
# Selection                                                         #
# ---------------------------------------------------------------- #


def get_llm_provider(offline: bool = False) -> LLMProvider:
    """
    Resolve the active provider.

    Falls back to the offline template provider only when explicitly requested
    or when no Gemini key is configured — and says so loudly in the logs.
    """
    if offline:
        logger.warning("Using OFFLINE template generation — not a language model.")
        return TemplateLLMProvider()

    if get_secret("GEMINI_API_KEY") is None:
        logger.warning(
            "GEMINI_API_KEY is not set; falling back to offline template "
            "generation. Cover letters will need manual rewriting."
        )
        return TemplateLLMProvider()

    return GeminiLLMProvider()
