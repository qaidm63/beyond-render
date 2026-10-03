"""
Shadow Matrix — Application & Search configuration.
===================================================
Blueprint § 2 (`core/config.py` — Search Configs) and § 3.b
(`SearchConfiguration` matrix, table `agent_config`).

These Pydantic models mirror `frontend/src/types.ts` exactly. Keep them in sync.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .secrets import get_secret

# ---------------------------------------------------------------- #
# Runtime settings                                                  #
# ---------------------------------------------------------------- #

APP_NAME = "Shadow Matrix Backend"
APP_VERSION = "1.0.0-phase4"

# Gemini models. Supplied by the operator; defaults match the project brief.
GEMINI_MODEL = get_secret("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_EMBEDDING_MODEL = get_secret("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")

# Dimensionality of `gemini-embedding-001`. CONFIRMED BY THE OPERATOR.
#
# This number is load-bearing in three places that must change together:
#   1. here,
#   2. `vector(768)` in backend/db/schema.sql (column + match function),
#   3. the stored vectors themselves.
# Changing the embedding model without re-embedding the whole corpus produces
# silently meaningless similarity scores rather than an error, so
# GeminiEmbeddingProvider refuses any response whose width differs from this.
EMBEDDING_DIMENSIONS = 768

# ---------------------------------------------------------------- #
# AMD Radeon Cloud — per-agent model assignment                     #
# ---------------------------------------------------------------- #
# OpenAI-compatible Token Factory endpoint. Keys rotate through
# `core/keyring.py`; see `core/amd.py`.
#
# The catalogue is a live beta and model ids rotate, so each is an override-
# able env var rather than a constant: a renamed model must be fixable in
# .env, not in a release.

# Vision / complex page extraction — scout/dom_engine.py
AMD_MODEL_VISION = get_secret("AMD_MODEL_VISION", "Qwen3.8-27B")

# Fast relevance pre-filter — agents/analyst.py
AMD_MODEL_ANALYST = get_secret("AMD_MODEL_ANALYST", "MiniCPM5-2B")

# Cover letters and VIP content — agents/tailor.py
AMD_MODEL_TAILOR = get_secret("AMD_MODEL_TAILOR", "DeepSeek-V4-Flash-0731")

# Origins allowed to call this API. The frontend normally reaches the backend
# through a same-origin proxy, so this stays narrow.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in (get_secret("ALLOWED_ORIGINS", "http://localhost:5173") or "").split(",")
    if origin.strip()
]

# ---------------------------------------------------------------- #
# § 3.b — Search Configuration Matrix                               #
# ---------------------------------------------------------------- #


class WorkModel(BaseModel):
    remoteWorldwide: bool = True
    onSite: bool = True
    hybrid: bool = True


class ContractType(BaseModel):
    fullTime: bool = True
    projectBased: bool = True
    freelance: bool = False


class SearchConfiguration(BaseModel):
    """Live control matrix, owned by the Swarm Configurator in /matrix-admin."""

    workModel: WorkModel = Field(default_factory=WorkModel)
    targetLocations: list[str] = Field(
        default_factory=lambda: [
            "United Arab Emirates",
            "Saudi Arabia",
            "Qatar",
            "Oman",
            "Remote",
        ]
    )
    contractType: ContractType = Field(default_factory=ContractType)
    matchingThreshold: int = Field(
        default=85,
        ge=0,
        le=100,
        description="Fit Score gate enforced by the Semantic Gatekeeper.",
    )


DEFAULT_SEARCH_CONFIGURATION = SearchConfiguration()

# Search terms the Scout feeds into each engine.
DEFAULT_SEARCH_TERMS: list[str] = [
    "Architect",
    "Architectural Designer",
    "Interior Designer",
    "BIM Coordinator",
    "Revit Architect",
    "Urban Planner",
    "Site Supervisor Architecture",
]
