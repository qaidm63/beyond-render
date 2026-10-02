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
APP_VERSION = "1.0.0-phase1"

# Gemini models. Supplied by the operator; defaults match the project brief.
GEMINI_MODEL = get_secret("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_EMBEDDING_MODEL = get_secret("GEMINI_EMBEDDING_MODEL", "text-embedding-004")

# Dimensionality of `text-embedding-004`. The pgvector column created in
# Phase 2 must declare exactly this width.
EMBEDDING_DIMENSIONS = 768

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
