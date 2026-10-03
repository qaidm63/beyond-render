"""
Shadow Matrix — Data access layer.
Blueprint § 6 Phase 2.

Every Supabase table touch goes through here. Keeping PostgREST calls in one
module means the agents stay pure logic and can be unit-tested against an
in-memory double.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .config import SearchConfiguration
from .database import get_supabase
from .schemas import JobOpportunity, PipelineStage, ProjectEvidence

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------- #
# Projects & embeddings                                             #
# ---------------------------------------------------------------- #


def upsert_project(project: ProjectEvidence) -> None:
    """Write a portfolio project record."""
    get_supabase().table("projects").upsert(
        {
            "project_id": project.projectId,
            "title": project.identity.title,
            "category": project.identity.category.value,
            "status": project.identity.status.value,
            "scope": project.identity.scope,
            "decision_log": project.decisionLog.model_dump(),
            "evidence_layer": project.evidenceLayer.model_dump(),
            "software_stack": project.softwareStack,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def upsert_project_embedding(
    project_id: str,
    source_document: str,
    content_hash: str,
    model: str,
    embedding: list[float],
) -> None:
    """Write a project embedding vector."""
    get_supabase().table("project_embeddings").upsert(
        {
            "project_id": project_id,
            "source_document": source_document,
            "content_hash": content_hash,
            "model": model,
            "embedding": embedding,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def get_embedding_hashes() -> dict[str, str]:
    """Map project_id -> stored content hash, for skip-if-unchanged logic."""
    res = (
        get_supabase()
        .table("project_embeddings")
        .select("project_id, content_hash")
        .execute()
    )
    return {row["project_id"]: row["content_hash"] for row in (res.data or [])}


def count_embeddings() -> int:
    res = (
        get_supabase()
        .table("project_embeddings")
        .select("project_id", count="exact")
        .execute()
    )
    return res.count or 0


def match_portfolio(embedding: list[float], match_count: int = 3) -> list[dict[str, Any]]:
    """
    Semantic Gatekeeper query (§ 4.3).

    Calls the `match_portfolio` SQL function, returning the best-matching
    projects with a 0–100 Fit Score.
    """
    res = get_supabase().rpc(
        "match_portfolio",
        {"query_embedding": embedding, "match_count": match_count},
    ).execute()
    return res.data or []


# ---------------------------------------------------------------- #
# Jobs                                                              #
# ---------------------------------------------------------------- #


def _job_row(job: JobOpportunity) -> dict[str, Any]:
    return {
        "fingerprint": job.fingerprint,
        "title": job.title,
        "company": job.company,
        "company_id": job.companyId,
        "location": job.location,
        "url": job.url,
        "source": job.source,
        "engine": job.engine.value,
        "description": job.description,
        "contract_type": job.contractType,
        "is_remote": job.isRemote,
        "fit_score": job.fitScore,
        "best_project_id": job.bestProjectId,
        "stage": job.stage.value,
        "posted_at": job.postedAt.isoformat() if job.postedAt else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def upsert_jobs(jobs: list[JobOpportunity]) -> int:
    """
    Persist scouted jobs, de-duplicated on `fingerprint`.

    Returns the number of rows written.
    """
    if not jobs:
        return 0
    rows = [_job_row(job) for job in jobs]
    res = (
        get_supabase()
        .table("jobs")
        .upsert(rows, on_conflict="fingerprint")
        .execute()
    )
    return len(res.data or rows)


def existing_fingerprints(fingerprints: list[str]) -> set[str]:
    """Which of these jobs have we already seen? Avoids re-scoring."""
    if not fingerprints:
        return set()
    res = (
        get_supabase()
        .table("jobs")
        .select("fingerprint")
        .in_("fingerprint", fingerprints)
        .execute()
    )
    return {row["fingerprint"] for row in (res.data or [])}


def list_jobs(
    stage: PipelineStage | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Read the pipeline, newest first."""
    query = get_supabase().table("jobs").select("*")
    if stage is not None:
        query = query.eq("stage", stage.value)
    res = query.order("discovered_at", desc=True).limit(limit).execute()
    return res.data or []


def update_job_stage(job_id: str, stage: PipelineStage) -> None:
    get_supabase().table("jobs").update(
        {"stage": stage.value, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", job_id).execute()


# ---------------------------------------------------------------- #
# Agent configuration (§ 3.b)                                       #
# ---------------------------------------------------------------- #


def read_config() -> SearchConfiguration | None:
    """Load the singleton control matrix. None when the row is absent."""
    res = get_supabase().table("agent_config").select("*").eq("id", 1).execute()
    rows = res.data or []
    if not rows:
        return None
    row = rows[0]
    return SearchConfiguration(
        workModel=row["work_model"],
        targetLocations=row["target_locations"],
        contractType=row["contract_type"],
        matchingThreshold=row["matching_threshold"],
    )


def read_search_terms() -> list[str]:
    res = (
        get_supabase()
        .table("agent_config")
        .select("search_terms")
        .eq("id", 1)
        .execute()
    )
    rows = res.data or []
    return rows[0]["search_terms"] if rows else []


def write_config(config: SearchConfiguration) -> None:
    get_supabase().table("agent_config").upsert(
        {
            "id": 1,
            "work_model": config.workModel.model_dump(),
            "target_locations": config.targetLocations,
            "contract_type": config.contractType.model_dump(),
            "matching_threshold": config.matchingThreshold,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


# ---------------------------------------------------------------- #
# Pitches (§ 5.3)                                                   #
# ---------------------------------------------------------------- #


def upsert_pitch(
    company_id: str,
    company_name: str,
    job_id: str | None,
    cover_letter: str,
    featured_project_ids: list[str],
    approved: bool = False,
) -> dict[str, Any]:
    res = (
        get_supabase()
        .table("pitches")
        .upsert(
            {
                "company_id": company_id,
                "company_name": company_name,
                "job_id": job_id,
                "cover_letter": cover_letter,
                "featured_project_ids": featured_project_ids,
                "approved": approved,
            }
        )
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else {}


def get_pitch(company_id: str) -> dict[str, Any] | None:
    res = (
        get_supabase()
        .table("pitches")
        .select("*")
        .eq("company_id", company_id)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def list_pitches(limit: int = 100) -> list[dict[str, Any]]:
    res = (
        get_supabase()
        .table("pitches")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def set_pitch_approval(company_id: str, approved: bool) -> None:
    get_supabase().table("pitches").update({"approved": approved}).eq(
        "company_id", company_id
    ).execute()


def increment_pitch_view(company_id: str) -> None:
    """
    Record a recruiter visit.

    Read-then-write is racy under concurrent views; for a handful of recruiter
    visits that is an acceptable trade against adding a SQL function. The
    telemetry event log below is the authoritative count.
    """
    pitch = get_pitch(company_id)
    if pitch is None:
        return
    get_supabase().table("pitches").update(
        {"view_count": int(pitch.get("view_count", 0)) + 1}
    ).eq("company_id", company_id).execute()


# ---------------------------------------------------------------- #
# Telemetry (§ 5.4)                                                 #
# ---------------------------------------------------------------- #


def record_event(
    event_type: str,
    company_id: str | None = None,
    job_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Append-only event log. Never raises into the request path."""
    try:
        get_supabase().table("telemetry_events").insert(
            {
                "event_type": event_type,
                "company_id": company_id,
                "job_id": job_id,
                "metadata": metadata or {},
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 - telemetry must never break UX
        logger.warning("Telemetry write failed (%s): %s", event_type, exc)


def telemetry_snapshot() -> dict[str, Any]:
    """Aggregate counters for the Command Center's measurement module."""
    client = get_supabase()

    def _count(table: str, **filters: Any) -> int:
        query = client.table(table).select("*", count="exact")
        for column, value in filters.items():
            query = query.eq(column, value)
        return query.execute().count or 0

    scored = (
        client.table("jobs").select("fit_score").not_.is_("fit_score", "null").execute()
    )
    scores = [float(r["fit_score"]) for r in (scored.data or []) if r.get("fit_score")]

    return {
        "totalDiscovered": _count("jobs"),
        "totalHighMatch": _count("jobs", stage="high_match"),
        "totalReadyToApply": _count("jobs", stage="ready_to_apply"),
        "totalApplied": _count("jobs", stage="applied"),
        "averageFitScore": round(sum(scores) / len(scores), 2) if scores else 0.0,
        "recruiterClicks": _count("telemetry_events", event_type="pitch_view"),
        "totalPitches": _count("pitches"),
    }


def delete_project_row(project_id: str) -> None:
    """
    Remove a project row. `project_embeddings` cascades via its foreign key,
    so the vector disappears with it.
    """
    get_supabase().table("projects").delete().eq("project_id", project_id).execute()
