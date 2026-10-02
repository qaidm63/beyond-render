"""
Shadow Matrix — FastAPI entrypoint.
Blueprint § 2 (`backend/main.py` — FastAPI contact points).

PHASE 4 SCOPE
-------------
Public:
  GET  /api/health              liveness + dependency audit
  GET  /api/health/dependencies secret/db/session audit (no values)
  GET  /api/pitch/{companyId}   recruiter-facing VIP payload (+ view tracking)

Operator only (Supabase Auth, allowlisted):
  GET   /api/admin/session      who am I
  GET   /api/config             live SearchConfiguration
  PATCH /api/config             Swarm Configurator writes
  GET   /api/jobs               the Radar pipeline
  PATCH /api/jobs/{id}/stage    Kanban moves
  GET   /api/telemetry          measurement centre
  GET   /api/pitches            Pitch Studio list
  POST  /api/pitches            mint / update a pitch
  PATCH /api/pitches/{id}/approval
  POST  /api/ingest             embed the portfolio
  POST  /api/scout/run          run one sweep
  POST  /api/pitches/draft      Tailor Agent drafts a cover letter
  GET   /api/scheduler          periodic sweep state
  POST  /api/scheduler/run      trigger a scheduled-style sweep now
  POST  /api/ops/test-alert     verify the Telegram gateway

Run with:
    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import ingest as ingest_module
from backend import pipeline as pipeline_module
from backend import scheduler as scheduler_module
from backend.agents import ops, tailor
from backend.agents.scout import dom_engine
from backend.core import repository
from backend.core.auth import Operator, auth_configured, current_operator
from backend.core.config import (
    ALLOWED_ORIGINS,
    APP_NAME,
    APP_VERSION,
    DEFAULT_SEARCH_CONFIGURATION,
    SearchConfiguration,
)
from backend.core.database import database_status
from backend.core.embeddings import get_embedding_provider
from backend.core.portfolio import load_portfolio
from backend.core.llm import get_llm_provider
from backend.core.schemas import HealthResponse, JobOpportunity, PipelineStage
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

    if not auth_configured():
        logger.warning(
            "Operator auth not configured — /matrix-admin stays sealed. "
            "Set SUPABASE_JWKS_URL and ADMIN_EMAILS."
        )

    if not ops.configured():
        logger.info("Telegram gateway not configured; alerts will be skipped.")

    # Opt-in: disabled unless SWEEP_INTERVAL_MINUTES is set (Phase 4).
    scheduler_module.start()


@app.on_event("shutdown")
async def stop_scheduler() -> None:
    """Unwind the sweep loop so reloads do not leak tasks."""
    await scheduler_module.stop()


# ---------------------------------------------------------------- #
# Health (public)                                                   #
# ---------------------------------------------------------------- #


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
    """Operational audit. Reports only *presence* of secrets, never values."""
    return {
        "secrets": audit_secrets(),
        "missingRequired": missing_required_secrets(),
        "database": database_status(),
        "browserSession": dom_engine.session_ready(),
        "telegram": ops.configured(),
        "operatorAuth": auth_configured(),
    }


# ---------------------------------------------------------------- #
# Operator session                                                  #
# ---------------------------------------------------------------- #


@app.get("/api/admin/session")
async def admin_session(operator: Operator = Depends(current_operator)) -> dict:
    """Authorisation verdict for the Command Center."""
    return {
        "authorised": True,
        "userId": operator.user_id,
        "email": operator.email,
        "role": operator.role,
    }


# ---------------------------------------------------------------- #
# Search configuration (§ 3.b, § 5.2)                               #
# ---------------------------------------------------------------- #


@app.get("/api/config", response_model=SearchConfiguration)
async def read_config(
    _operator: Operator = Depends(current_operator),
) -> SearchConfiguration:
    """
    The live Search Configuration matrix.

    The `agent_config` table is authoritative; the in-code default is served
    when it is unreachable so the console renders something truthful.
    """
    try:
        stored = repository.read_config()
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent_config unreadable (%s); serving defaults.", exc)
        return DEFAULT_SEARCH_CONFIGURATION
    return stored or DEFAULT_SEARCH_CONFIGURATION


@app.patch("/api/config", response_model=SearchConfiguration)
async def update_config(
    config: SearchConfiguration,
    _operator: Operator = Depends(current_operator),
) -> SearchConfiguration:
    """Swarm Configurator writes. Pydantic clamps the threshold to 0–100."""
    try:
        repository.write_config(config)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return config


# ---------------------------------------------------------------- #
# Radar (§ 5.1)                                                     #
# ---------------------------------------------------------------- #


@app.get("/api/jobs")
async def list_jobs(
    stage: PipelineStage | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    _operator: Operator = Depends(current_operator),
) -> list[dict[str, object]]:
    """Read the scout pipeline, newest first."""
    try:
        return repository.list_jobs(stage=stage, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class StageUpdate(BaseModel):
    stage: PipelineStage


@app.patch("/api/jobs/{job_id}/stage")
async def move_job(
    job_id: str,
    body: StageUpdate,
    _operator: Operator = Depends(current_operator),
) -> dict[str, str]:
    """Kanban column move."""
    try:
        repository.update_job_stage(job_id, body.stage)
        repository.record_event(
            "job_stage_change", job_id=job_id, metadata={"stage": body.stage.value}
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"id": job_id, "stage": body.stage.value}


# ---------------------------------------------------------------- #
# Telemetry (§ 5.4)                                                 #
# ---------------------------------------------------------------- #


@app.get("/api/telemetry")
async def telemetry(
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    try:
        return repository.telemetry_snapshot()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ---------------------------------------------------------------- #
# Pitch Studio (§ 5.3)                                              #
# ---------------------------------------------------------------- #


class PitchUpsert(BaseModel):
    companyId: str = Field(min_length=1, max_length=200)
    companyName: str = Field(min_length=1, max_length=300)
    jobId: str | None = None
    coverLetter: str = ""
    featuredProjectIds: list[str] = Field(default_factory=list)
    approved: bool = False


@app.get("/api/pitches")
async def list_pitches(
    _operator: Operator = Depends(current_operator),
) -> list[dict[str, object]]:
    try:
        return repository.list_pitches()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/pitches")
async def upsert_pitch(
    body: PitchUpsert,
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """Create or update a tailored pitch and its VIP link."""
    valid_ids = {p.projectId for p in load_portfolio()}
    unknown = [pid for pid in body.featuredProjectIds if pid not in valid_ids]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown project ids: {', '.join(unknown)}",
        )
    try:
        return repository.upsert_pitch(
            company_id=body.companyId,
            company_name=body.companyName,
            job_id=body.jobId,
            cover_letter=body.coverLetter,
            featured_project_ids=body.featuredProjectIds,
            approved=body.approved,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class ApprovalUpdate(BaseModel):
    approved: bool


@app.patch("/api/pitches/{company_id}/approval")
async def approve_pitch(
    company_id: str,
    body: ApprovalUpdate,
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    try:
        repository.set_pitch_approval(company_id, body.approved)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"companyId": company_id, "approved": body.approved}


@app.get("/api/pitch/{company_id}")
async def public_pitch(company_id: str) -> dict[str, object]:
    """
    Recruiter-facing VIP payload. PUBLIC — this link is the product.

    Unapproved pitches 404 rather than leaking a draft cover letter. Project
    bodies are served from the shared source of truth so the page never
    depends on the database being reachable for its content.
    """
    try:
        pitch = repository.get_pitch(company_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if pitch is None or not pitch.get("approved"):
        raise HTTPException(status_code=404, detail="Pitch not found.")

    featured_ids = pitch.get("featured_project_ids") or []
    by_id = {p.projectId: p for p in load_portfolio()}
    projects = [by_id[pid].model_dump() for pid in featured_ids if pid in by_id]

    # Fire-and-forget; never blocks or breaks the recruiter's page load.
    repository.record_event("pitch_view", company_id=company_id)
    repository.increment_pitch_view(company_id)

    return {
        "companyId": pitch["company_id"],
        "companyName": pitch["company_name"],
        "coverLetter": pitch.get("cover_letter", ""),
        "projects": projects,
    }


# ---------------------------------------------------------------- #
# Ingestion & sweeps                                                #
# ---------------------------------------------------------------- #


class IngestRequest(BaseModel):
    force: bool = False
    dryRun: bool = False


@app.post("/api/ingest")
async def run_ingest(
    body: IngestRequest | None = None,
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
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
    notify: bool = False


@app.post("/api/scout/run")
async def run_scout(
    body: SweepRequest | None = None,
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """
    Run one discovery sweep: Layers 1 and 2, then the Semantic Gatekeeper.

    Synchronous on purpose: the operator pressed the button and wants the
    report. The Phase 4 scheduler runs the same cycle unattended.
    """
    body = body or SweepRequest()
    try:
        report = await pipeline_module.run_sweep(
            use_dom=body.useDom,
            dry_run=body.dryRun,
            notify=body.notify,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return report.as_dict()


# ---------------------------------------------------------------- #
# Phase 4 — Tailor Agent                                            #
# ---------------------------------------------------------------- #


class DraftRequest(BaseModel):
    """Draft from a stored job id, or from an inline posting."""

    jobId: str | None = None
    job: JobOpportunity | None = None
    featuredCount: int = Field(default=3, ge=1, le=6)
    persist: bool = True
    notify: bool = False


@app.post("/api/pitches/draft")
async def draft_pitch(
    body: DraftRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """
    Run the Tailor Agent: pick the most relevant evidence, draft a cover
    letter, inject the VIP link.

    The result is always **unapproved** — `/api/pitch/{companyId}` keeps
    404ing until the operator approves it in the Pitch Studio. That keeps a
    machine-written letter from ever reaching a recruiter unreviewed.
    """
    job = body.job
    if job is None:
        if not body.jobId:
            raise HTTPException(
                status_code=422, detail="Provide either 'jobId' or 'job'."
            )
        try:
            rows = repository.list_jobs(limit=500)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        match = next((r for r in rows if str(r.get("id")) == body.jobId), None)
        if match is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        job = JobOpportunity(
            fingerprint=match.get("fingerprint", body.jobId),
            title=match.get("title", ""),
            company=match.get("company", ""),
            companyId=match.get("company_id", ""),
            url=match.get("url", ""),
            source=match.get("source", "unknown"),
            engine=match.get("engine", "xhr"),
            id=str(match.get("id")),
            location=match.get("location"),
            description=match.get("description"),
            contractType=match.get("contract_type"),
            fitScore=match.get("fit_score"),
            bestProjectId=match.get("best_project_id"),
        )

    try:
        pitch = await tailor.compose(job, featured_count=body.featuredCount)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Drafting failed: {exc}") from exc

    stored: dict[str, object] = {}
    if body.persist:
        try:
            stored = repository.upsert_pitch(
                company_id=pitch.companyId,
                company_name=pitch.companyName,
                job_id=job.id,
                cover_letter=pitch.coverLetter,
                featured_project_ids=pitch.featuredProjectIds,
                approved=False,
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    if body.notify:
        await ops.notify_pitch_ready(
            pitch.companyName, pitch.companyId, tailor.vip_url(pitch.companyId)
        )

    repository.record_event("pitch_drafted", company_id=pitch.companyId)

    return {
        "pitch": pitch.model_dump(mode="json"),
        "vipPath": tailor.vip_path(pitch.companyId),
        "vipUrl": tailor.vip_url(pitch.companyId),
        "generator": get_llm_provider().name,
        "persisted": bool(stored),
    }


# ---------------------------------------------------------------- #
# Phase 4 — Scheduler & ops gateway                                 #
# ---------------------------------------------------------------- #


@app.get("/api/scheduler")
async def scheduler_state(
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """Current state of the periodic sweep loop."""
    state = scheduler_module.STATE.as_dict()
    state["telegramConfigured"] = ops.configured()
    return state


@app.post("/api/scheduler/run")
async def scheduler_run_now(
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """
    Run one sweep through the scheduler path, alerts included.

    Unlike `/api/scout/run` this records into the scheduler's own state, so
    the dashboard shows manual and automatic runs on the same timeline.
    """
    return await scheduler_module.run_once(notify=True)


@app.post("/api/ops/test-alert")
async def test_alert(
    _operator: Operator = Depends(current_operator),
) -> dict[str, object]:
    """Send a probe message so the operator can verify the Telegram wiring."""
    if not ops.configured():
        raise HTTPException(
            status_code=503,
            detail="Telegram not configured: set TELEGRAM_BOT_TOKEN and "
            "TELEGRAM_CHAT_ID in .env.",
        )
    delivered = await ops.notify(
        "<b>Shadow Matrix</b>\nTelegram gateway verified."
    )
    return {"configured": True, "delivered": delivered}
