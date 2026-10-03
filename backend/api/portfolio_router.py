"""
Portfolio Studio API — generative case-study management.

    GET  /api/portfolio/projects    canonical file + database reconciliation
    POST /api/portfolio/synthesize  draft a case study (no writes)
    POST /api/portfolio/save        write file + projects + project_embeddings
    POST /api/portfolio/reembed     re-embed one project without regenerating
    DELETE /api/portfolio/projects/{id}

    POST /api/portfolio/interrogate  questions that sharpen the brief
    POST /api/portfolio/fitness      score a draft against live postings
    POST /api/portfolio/variants     A/B two narrative framings, scored
    GET  /api/portfolio/coverage     which capability costs you near misses
    POST /api/portfolio/assets/facts measured properties of uploaded files

Separation of concerns: `synthesize` never touches disk or the database, and
`save` never calls a language model. An operator can therefore regenerate as
often as they like at zero risk to the source of truth, and can save a
hand-written project without involving an LLM at all.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.agents import curator, interrogator, provenance, strategist
from backend.core import portfolio as portfolio_module
from backend.core import repository
from backend.core.auth import Operator, current_operator
from backend.core.assets import inspect_asset
from backend.core.embeddings import get_embedding_provider
from backend.core.llm import get_llm_provider
from backend.core.portfolio import content_hash, load_portfolio
from backend.core.schemas import ProjectEvidence

logger = logging.getLogger("shadow-matrix.portfolio")

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# ---------------------------------------------------------------- #
# Request models                                                    #
# ---------------------------------------------------------------- #


class InterrogationAnswer(BaseModel):
    question: str = Field(max_length=1000)
    answer: str = Field(default="", max_length=4000)


class SynthesisRequest(BaseModel):
    """Partial metadata plus any uploaded assets."""

    title: str = Field(min_length=1, max_length=300)
    category: str | None = None
    status: str | None = None
    teamRole: str | None = None
    softwareStack: list[str] = Field(default_factory=list)
    location: str | None = None
    area: str | None = None
    constraints: str | None = None
    spatialNotes: str | None = None
    notes: str | None = None
    # Asset references: public URLs or data: URIs.
    images: list[str] = Field(default_factory=list)
    technicalDrawings: list[str] = Field(default_factory=list)
    # Supplied when refining an existing project; keeps the id stable.
    projectId: str | None = None
    inspectAssets: bool = True
    # Answers from the Evidence Interrogator, folded into the brief as
    # authoritative facts.
    interrogation: list[InterrogationAnswer] = Field(default_factory=list)
    # Reuse an earlier vision pass instead of paying for another.
    assetObservations: str | None = None


class FitnessRequest(BaseModel):
    """Score a draft, or an arbitrary document, against live postings."""

    project: ProjectEvidence | None = None
    document: str | None = None
    nearMissOnly: bool = False


class VariantRequest(SynthesisRequest):
    stances: list[str] = Field(default_factory=lambda: ["computational", "urban"])


class ProvenanceRequest(BaseModel):
    project: ProjectEvidence
    payload: dict[str, Any] = Field(default_factory=dict)
    observations: str = ""


class AssetFactsRequest(BaseModel):
    assets: list[str] = Field(default_factory=list, max_length=40)


class SaveRequest(BaseModel):
    """A validated case study to commit."""

    project: ProjectEvidence
    # Default True: a project saved but not embedded is invisible to matching,
    # which is a silent failure the operator would not notice.
    embed: bool = True


# ---------------------------------------------------------------- #
# Helpers                                                           #
# ---------------------------------------------------------------- #


def _embed_project(project: ProjectEvidence) -> dict[str, Any]:
    """
    Generate and store the 768-dim vector for one project.

    Returns a report rather than raising: a save that persisted the file and
    the row but failed to embed must tell the operator precisely that, not
    look like a total failure.
    """
    document = project.to_embedding_document()
    provider = get_embedding_provider()
    digest = content_hash(document, provider.name)

    try:
        vector = provider.embed(document)
    except Exception as exc:  # noqa: BLE001
        logger.error("Embedding failed for %s: %s", project.projectId, exc)
        return {"embedded": False, "reason": str(exc)}

    if len(vector) != provider.dimensions:
        return {
            "embedded": False,
            "reason": (
                f"Embedding width {len(vector)} does not match the "
                f"pgvector column ({provider.dimensions})."
            ),
        }

    try:
        repository.upsert_project_embedding(
            project_id=project.projectId,
            source_document=document,
            content_hash=digest,
            model=provider.name,
            embedding=vector,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Embedding upsert failed for %s: %s", project.projectId, exc)
        return {"embedded": False, "reason": str(exc)}

    return {
        "embedded": True,
        "model": provider.name,
        "dimensions": len(vector),
        "contentHash": digest,
    }


# ---------------------------------------------------------------- #
# Endpoints                                                         #
# ---------------------------------------------------------------- #


@router.get("/projects")
async def list_projects(
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Every project on file, annotated with its database/embedding state.

    The canonical file is authoritative for content; the database is reported
    alongside it so drift is visible rather than silent.
    """
    projects = load_portfolio()

    hashes: dict[str, str] = {}
    db_error: str | None = None
    try:
        hashes = repository.get_embedding_hashes()
    except Exception as exc:  # noqa: BLE001 - the file must still render
        db_error = str(exc)

    provider_name = get_embedding_provider().name
    items = []
    for project in projects:
        document = project.to_embedding_document()
        expected = content_hash(document, provider_name)
        stored = hashes.get(project.projectId)
        items.append(
            {
                "project": project.model_dump(mode="json"),
                "embedded": stored is not None,
                # Stale = the text changed since it was embedded, so matching
                # is running against an outdated vector.
                "stale": stored is not None and stored != expected,
            }
        )

    return {
        "projects": items,
        "total": len(items),
        "embeddingModel": provider_name,
        "databaseError": db_error,
    }


@router.post("/synthesize")
async def synthesize(
    body: SynthesisRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Draft a case study. Writes nothing — the operator reviews, then saves.
    """
    existing = {p.projectId for p in load_portfolio()}
    project_id = body.projectId or portfolio_module.unique_project_id(
        body.title, existing
    )

    payload = body.model_dump()
    assets = (body.images + body.technicalDrawings) if body.inspectAssets else []

    try:
        project, observations = await curator.synthesise(
            payload,
            project_id=project_id,
            assets=assets,
            observations=body.assetObservations,
        )
    except curator.SynthesisError as exc:
        # The model replied, but not usably. 502: an upstream content problem,
        # not the operator's mistake.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"Synthesis failed: {exc}"
        ) from exc

    # Verified on every draft rather than on demand: a guard the operator
    # has to remember to run is a guard that does not run.
    report = provenance.verify(project, payload, observations)

    return {
        "project": project.model_dump(mode="json"),
        "projectId": project_id,
        "isNew": project_id not in existing,
        "assetObservations": observations,
        "generator": get_llm_provider(role="curator").name,
        "sourceDocument": project.to_embedding_document(),
        "provenance": report.to_dict(),
    }


@router.post("/save")
async def save(
    body: SaveRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Commit a case study to the file, the database and the vector store.

    Order matters: the file is written first because it is the source of
    truth and the only store that survives a database reset. Database and
    embedding failures are reported without discarding that write.
    """
    project = body.project

    if not project.decisionLog.challenge.strip():
        raise HTTPException(
            status_code=422,
            detail="decisionLog.challenge is empty. This text is what gets "
            "embedded and what cover letters cite — refusing to save it blank.",
        )

    try:
        created = await asyncio.to_thread(portfolio_module.save_project, project)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Could not write the portfolio file: {exc}"
        ) from exc

    warnings: list[str] = []

    try:
        await asyncio.to_thread(repository.upsert_project, project)
        persisted = True
    except Exception as exc:  # noqa: BLE001
        persisted = False
        warnings.append(f"Database upsert failed: {exc}")

    embedding: dict[str, Any] = {"embedded": False, "reason": "skipped"}
    if body.embed:
        if persisted:
            embedding = await asyncio.to_thread(_embed_project, project)
            if not embedding.get("embedded"):
                warnings.append(f"Embedding failed: {embedding.get('reason')}")
        else:
            # project_embeddings has a FK onto projects; embedding first would
            # fail anyway and the error would be confusing.
            embedding = {
                "embedded": False,
                "reason": "skipped because the project row was not persisted",
            }

    repository.record_event(
        "portfolio_saved",
        metadata={"projectId": project.projectId, "created": created},
    )

    return {
        "ok": True,
        "created": created,
        "projectId": project.projectId,
        "fileWritten": True,
        "databasePersisted": persisted,
        "embedding": embedding,
        "warnings": warnings,
        "totalProjects": len(load_portfolio()),
    }


@router.post("/reembed/{project_id}")
async def reembed(
    project_id: str,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """Re-embed one project without regenerating its text."""
    project = next(
        (p for p in load_portfolio() if p.projectId == project_id), None
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    try:
        await asyncio.to_thread(repository.upsert_project, project)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    result = await asyncio.to_thread(_embed_project, project)
    if not result.get("embedded"):
        raise HTTPException(status_code=502, detail=result.get("reason", "failed"))
    return {"ok": True, "projectId": project_id, **result}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Remove a project from the canonical file and the database.

    The embedding row disappears with it: `project_embeddings` cascades on the
    `projects` foreign key.
    """
    removed = await asyncio.to_thread(portfolio_module.delete_project, project_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Project not found.")

    warnings: list[str] = []
    try:
        await asyncio.to_thread(repository.delete_project_row, project_id)
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"Database delete failed: {exc}")

    return {"ok": True, "projectId": project_id, "warnings": warnings}


# ---------------------------------------------------------------- #
# Strategy layer                                                    #
# ---------------------------------------------------------------- #


def _threshold() -> float:
    """The live matching threshold, falling back to the Blueprint default."""
    try:
        config = repository.read_config()
    except Exception as exc:  # noqa: BLE001 - never fail an analysis on this
        logger.warning("Could not read the matching threshold: %s", exc)
        return 85.0
    return float(getattr(config, "matchingThreshold", 85) or 85) if config else 85.0


def _jobs(limit: int = 300) -> tuple[list[dict[str, Any]], str | None]:
    """Read the posting corpus. Returns (rows, error) — never raises."""
    try:
        return repository.list_jobs(limit=limit), None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read jobs: %s", exc)
        return [], str(exc)


@router.post("/interrogate")
async def interrogate(
    body: SynthesisRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Ask the operator the questions that would most improve the case study.

    Returns an empty list rather than an error when questions cannot be
    produced: the form must stay usable without this step.
    """
    assets = (body.images + body.technicalDrawings) if body.inspectAssets else []
    payload = body.model_dump()

    questions, observations = await interrogator.interrogate(
        payload, assets=assets, observations=body.assetObservations
    )

    return {
        "questions": [q.to_dict() for q in questions],
        "assetObservations": observations,
        "measuredFacts": [
            inspect_asset(asset).summary() for asset in assets[:12]
        ],
        "generator": get_llm_provider(role="curator").name,
    }


@router.post("/fitness")
async def fitness(
    body: FitnessRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Score a draft against real postings before it is saved.

    This is the number that matters: not whether the prose reads well, but
    whether the vector lands near the work the operator actually wants.
    """
    if body.project is None and not (body.document or "").strip():
        raise HTTPException(
            status_code=422,
            detail="Supply either a project or a document to score.",
        )

    document = (
        body.project.to_embedding_document()
        if body.project is not None
        else (body.document or "")
    )

    threshold = _threshold()
    rows, error = _jobs()
    sample = strategist.sample_jobs(
        rows, threshold, near_miss_only=body.nearMissOnly
    )

    try:
        report = await asyncio.to_thread(
            strategist.score_document,
            document,
            sample,
            threshold=threshold,
            provider=get_embedding_provider(),
        )
    except strategist.StrategistError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payload = report.to_dict()
    payload["databaseError"] = error
    return payload


@router.get("/coverage")
async def coverage(
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Which capability keeps costing near-miss postings.

    Reads the Analyst's own rejections, so the answer is grounded in the
    market the Scout is actually sweeping rather than in intuition.
    """
    threshold = _threshold()
    rows, error = _jobs()

    try:
        report = await strategist.coverage_gaps(rows, threshold=threshold)
    except strategist.StrategistError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payload = report.to_dict()
    payload["databaseError"] = error
    return payload


@router.post("/variants")
async def variants(
    body: VariantRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Synthesise the same facts under two framings and score both.

    Both variants share one asset inspection so the comparison measures
    framing, not vision noise.
    """
    existing = {p.projectId for p in load_portfolio()}
    project_id = body.projectId or portfolio_module.unique_project_id(
        body.title, existing
    )
    assets = (body.images + body.technicalDrawings) if body.inspectAssets else []
    payload = body.model_dump(exclude={"stances"})

    observations = body.assetObservations
    if observations is None:
        observations = await curator.inspect_assets(assets)

    threshold = _threshold()
    rows, error = _jobs()
    sample = strategist.sample_jobs(rows, threshold)

    try:
        comparison = await strategist.compare_variants(
            payload,
            project_id=project_id,
            jobs=sample,
            threshold=threshold,
            observations=observations,
            stances=body.stances,
        )
    except strategist.StrategistError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = comparison.to_dict()
    result["projectId"] = project_id
    result["assetObservations"] = observations
    result["databaseError"] = error
    return result


@router.post("/provenance")
async def check_provenance(
    body: ProvenanceRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Re-verify a project after the operator has edited it by hand.

    Advisory by design: it never blocks a save. A guard that produced false
    refusals would simply be switched off.
    """
    report = provenance.verify(body.project, body.payload, body.observations)
    return report.to_dict()


@router.post("/assets/facts")
async def asset_facts(
    body: AssetFactsRequest,
    _operator: Operator = Depends(current_operator),
) -> dict[str, Any]:
    """
    Measured properties of uploaded files: page counts, sheet sizes,
    producing application, image geometry.

    These are measurements, not interpretations, so they are safe to treat
    as fact during synthesis.
    """
    facts = [vars(inspect_asset(asset)) for asset in body.assets]
    return {"facts": facts, "count": len(facts)}
