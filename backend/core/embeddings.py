"""
Shadow Matrix — Embedding providers.
Blueprint § 6 Phase 2 (Ingestion pipeline) and § 4.3 (Semantic Gatekeeper).

The whole semantic layer depends on one operation: text -> vector. That is
expressed here as a narrow Protocol so the ingestion pipeline, the Analyst
agent and the test-suite can all share the same contract while differing in
backend.

Providers
---------
GeminiEmbeddingProvider : production. Calls the Gemini embedContent endpoint.
HashingEmbeddingProvider: offline/deterministic. For tests and air-gapped
                          environments ONLY — never for production data.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Protocol, runtime_checkable

import httpx

from .config import EMBEDDING_DIMENSIONS, GEMINI_EMBEDDING_MODEL
from .secrets import get_secret, require_secret

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


class EmbeddingError(RuntimeError):
    """Raised when an embedding could not be produced."""


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Minimal contract every embedding backend must satisfy."""

    name: str
    dimensions: int

    def embed(self, text: str) -> list[float]:
        """Return a unit-normalised embedding vector for ``text``."""
        ...


# ---------------------------------------------------------------- #
# Vector helpers                                                    #
# ---------------------------------------------------------------- #


def l2_normalise(vector: list[float]) -> list[float]:
    """
    Scale a vector to unit length.

    Cosine similarity on unit vectors reduces to a dot product, and pgvector's
    cosine operator behaves consistently when every stored vector shares the
    same magnitude.
    """
    magnitude = math.sqrt(sum(component * component for component in vector))
    if magnitude == 0:
        raise EmbeddingError("Cannot normalise a zero vector.")
    return [component / magnitude for component in vector]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity in [-1, 1]. Used for local scoring and tests."""
    if len(a) != len(b):
        raise ValueError(f"Dimension mismatch: {len(a)} vs {len(b)}")
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def similarity_to_fit_score(similarity: float) -> float:
    """
    Convert cosine similarity to the 0–100 Fit Score used by the blueprint.

    Negative similarity is clamped to zero: an opposing vector is simply "no
    match", not a negative one. Mirrors `match_portfolio()` in schema.sql.
    """
    return round(max(0.0, similarity) * 100, 2)


# ---------------------------------------------------------------- #
# Production provider                                               #
# ---------------------------------------------------------------- #


class GeminiEmbeddingProvider:
    """Embeddings via the Gemini API."""

    def __init__(self, model: str | None = None, timeout: float = 30.0) -> None:
        self.model = "gemini-embedding-001"
        self.name = f"gemini:{self.model}"
        self.dimensions = EMBEDDING_DIMENSIONS
        self._timeout = timeout

    def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise EmbeddingError("Refusing to embed empty text.")

        api_key = require_secret("GEMINI_API_KEY")
        url = f"{GEMINI_ENDPOINT}/{self.model}:embedContent"
        payload = {
            "model": f"models/{self.model}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self.dimensions,
        }

        try:
            response = httpx.post(
                url,
                params={"key": api_key},
                json=payload,
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise EmbeddingError(f"Gemini embedding request failed: {exc}") from exc

        if response.status_code >= 400:
            raise EmbeddingError(
                f"Gemini embedding returned HTTP {response.status_code}: "
                f"{response.text[:300]}"
            )

        values = response.json().get("embedding", {}).get("values")
        if not values:
            raise EmbeddingError("Gemini response contained no embedding values.")
        if len(values) != self.dimensions:
            raise EmbeddingError(
                f"Embedding width mismatch: model returned {len(values)} "
                f"dimensions but the pgvector column is {self.dimensions}. "
                "Update EMBEDDING_DIMENSIONS and schema.sql together, then "
                "re-embed the whole corpus."
            )
        return l2_normalise([float(v) for v in values])


# ---------------------------------------------------------------- #
# Offline provider                                                  #
# ---------------------------------------------------------------- #


_TOKEN_RE = re.compile(r"[a-z0-9]+")


class HashingEmbeddingProvider:
    """
    Deterministic bag-of-words hashing embedder. No network required.

    This exists so the ingestion pipeline, the gatekeeper and the scout can be
    exercised end-to-end in CI and in air-gapped sandboxes. It captures lexical
    overlap only — it has no semantic understanding — so it must never be used
    to populate production embeddings. `ingest.py` refuses to write
    hashing-provider vectors unless explicitly forced.
    """

    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.name = "hashing:offline"
        self.dimensions = dimensions

    def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise EmbeddingError("Refusing to embed empty text.")

        vector = [0.0] * self.dimensions
        tokens = _TOKEN_RE.findall(text.lower())
        if not tokens:
            raise EmbeddingError("Text produced no usable tokens.")

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            # Sign bit spreads tokens across the space instead of piling up.
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        return l2_normalise(vector)


# ---------------------------------------------------------------- #
# Selection                                                         #
# ---------------------------------------------------------------- #


def get_embedding_provider(offline: bool = False) -> EmbeddingProvider:
    """
    Resolve the active provider.

    Falls back to the offline provider only when explicitly requested or when
    no Gemini key is configured — and says so loudly in the logs.
    """
    if offline:
        logger.warning("Using OFFLINE hashing embeddings — not production grade.")
        return HashingEmbeddingProvider()

    if get_secret("GEMINI_API_KEY") is None:
        logger.warning(
            "GEMINI_API_KEY is not set; falling back to offline hashing "
            "embeddings. Semantic quality will be poor."
        )
        return HashingEmbeddingProvider()

    return GeminiEmbeddingProvider()
