"""
Portfolio Studio API — generative case-study management.

    GET  /api/portfolio/projects    canonical file + database reconciliation
    POST /api/portfolio/synthesize  draft a case study (no writes)
    POST /api/portfolio/save        write file + projects + project_embeddings
    POST /api/portfolio/reembed     re-embed one project without regenerating
    DELETE /api/portfolio/projects/{id}

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

from backend.agents import curator
from backend.core import portfolio as portfolio_module
from backend.core import repository
from backend.core.auth import Operator, current_operator
from backend.core.embeddings import get_embedding_provider
from backend.core.llm import get_llm_provider
from backend.core.portfolio import content_hash, load_portfolio
from backend.core.schemas import ProjectEvidence

logger = logging.getLogger("shadow-matrix.portfolio")

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# ---------------------------------------------------------------- #
# Request models                                                    #
# ---------------------------------------------------------------- #


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
        )
    except curator.SynthesisError as exc:
        # The model replied, but not usably. 502: an upstream content problem,
        # not the operator's mistake.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"Synthesis failed: {exc}"
        ) from exc

    return {
        "project": project.model_dump(mode="json"),
        "projectId": project_id,
        "isNew": project_id not in existing,
        "assetObservations": observations,
        "generator": get_llm_provider(role="tailor").name,
        "sourceDocument": project.to_embedding_document(),
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
