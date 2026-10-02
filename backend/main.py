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

import asyncio
import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import ingest as ingest_module
from backend import pipeline as pipeline_module
from backend.agents import ops
from backend.agents.scout import dom_engine
from backend.core import repository
from backend.core.config import (
    ALLOWED_ORIGINS,
    APP_NAME,
    APP_VERSION,
    DEFAULT_SEARCH_CONFIGURATION,
    SearchConfiguration,
)
from backend.core.database import database_status
from backend.core.embeddings import get_embedding_provider
from backend.core.schemas import HealthResponse, PipelineStage
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

    The `agent_config` table is authoritative. We fall back to the in-code
    default when it is unreachable so the console still renders something
    truthful rather than erroring.
    """
    try:
        stored = repository.read_config()
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent_config unreadable (%s); serving defaults.", exc)
        return DEFAULT_SEARCH_CONFIGURATION
    return stored or DEFAULT_SEARCH_CONFIGURATION


# ---------------------------------------------------------------- #
# Phase 2 — ingestion, sweep, pipeline read                         #
# ---------------------------------------------------------------- #


class IngestRequest(BaseModel):
    force: bool = False
    dryRun: bool = False


@app.post("/api/ingest")
async def run_ingest(body: IngestRequest | None = None) -> dict[str, object]:
    """Embed the portfolio source of truth into pgvector."""
    body = body or IngestRequest()
    try:
        report = await asyncio.to_thread(
            ingest_module.run_ingestion,
            get_embedding_provider(),
            force=body.force,
            dry_run=body.dryRun,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "embedded": report.embedded,
        "skipped": report.skipped,
        "failed": report.failed,
        "ok": report.ok,
    }


class SweepRequest(BaseModel):
    useDom: bool = True
    dryRun: bool = False


@app.post("/api/scout/run")
async def run_scout(body: SweepRequest | None = None) -> dict[str, object]:
    """
    Run one discovery sweep: Layers 1 and 2, then the Semantic Gatekeeper.

    Synchronous for now. Phase 4 moves this behind the scheduler so the
    operator never waits on a long sweep.
    """
    body = body or SweepRequest()
    try:
        report = await pipeline_module.run_sweep(
            use_dom=body.useDom,
            dry_run=body.dryRun,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return report.as_dict()


@app.get("/api/jobs")
async def list_jobs(
    stage: PipelineStage | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, object]]:
    """Read the scout pipeline, newest first. Backs the Radar in Phase 3."""
    try:
        return repository.list_jobs(stage=stage, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


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
