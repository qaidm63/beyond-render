"""
Shadow Matrix — FastAPI entrypoint.
Blueprint § 2 (`backend/main.py` — FastAPI contact points).

PHASE 1 SCOPE
-------------
Operational surface only:
  GET /api/health         liveness + dependency audit
  GET /api/config         the live SearchConfiguration (read-only for now)
  GET /api/admin/session  authorisation verdict for /matrix-admin

Everything else is declared in the agent modules and arrives in Phases 2–4.

Run with:
    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.agents import ops
from backend.agents.scout import dom_engine
from backend.core.config import (
    ALLOWED_ORIGINS,
    APP_NAME,
    APP_VERSION,
    DEFAULT_SEARCH_CONFIGURATION,
    SearchConfiguration,
)
from backend.core.database import database_status
from backend.core.schemas import HealthResponse
from backend.core.secrets import audit_secrets, missing_required_secrets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shadow-matrix")

app = FastAPI(title=APP_NAME, version=APP_VERSION, docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def validate_environment() -> None:
    """Fail loudly at boot when required secrets are missing."""
    missing = missing_required_secrets()
    if missing:
        logger.warning(
            "Missing required secrets: %s. "
            "The API will serve /api/health but data paths will refuse to run.",
            ", ".join(missing),
        )
    else:
        logger.info("Secret inventory complete.")


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    missing = missing_required_secrets()
    return HealthResponse(
        status="degraded" if missing else "ok",
        service=APP_NAME,
        version=APP_VERSION,
        database=database_status(),
    )


@app.get("/api/health/dependencies")
async def dependencies() -> dict[str, object]:
    """
    Operational audit. Reports only *presence* of secrets — never values.
    """
    return {
        "secrets": audit_secrets(),
        "missingRequired": missing_required_secrets(),
        "database": database_status(),
        "browserSession": dom_engine.session_ready(),
        "telegram": ops.configured(),
    }


@app.get("/api/config", response_model=SearchConfiguration)
async def read_config() -> SearchConfiguration:
    """
    The live Search Configuration matrix.

    Phase 1 serves the in-code default. Phase 2 moves ownership to the
    `agent_config` table, and Phase 3 lets the Swarm Configurator write to it.
    """
    return DEFAULT_SEARCH_CONFIGURATION


@app.get("/api/admin/session")
async def admin_session() -> dict[str, str]:
    """
    Authorisation verdict for the Command Center.

    Phase 1 denies unconditionally: no auth strategy has been selected, so the
    route stays sealed rather than open. Phase 3 replaces this body with the
    real check once the owner picks Supabase Auth or an operator credential.
    """
    raise HTTPException(
        status_code=401,
        detail="Operator authentication not configured (Phase 3).",
    )
