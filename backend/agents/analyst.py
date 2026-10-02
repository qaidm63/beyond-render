"""
Analyst Agent — Semantic Gatekeeper (Scout Layer 3).
Blueprint § 4.3.

Every result from Layers 1 and 2 passes through here. The agent embeds each
posting and queries `pgvector` in Supabase to score it against the architect's
project embeddings. Anything scoring below
`SearchConfiguration.matchingThreshold` is discarded immediately and never
reaches the Command Center.

This is the cost valve of the whole system: it keeps LLM spend and operator
attention proportional to genuine matches.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.core import repository
from backend.core.config import SearchConfiguration
from backend.core.embeddings import (
    EmbeddingProvider,
    cosine_similarity,
    get_embedding_provider,
    similarity_to_fit_score,
)
from backend.core.schemas import JobOpportunity, PipelineStage

logger = logging.getLogger("shadow-matrix.analyst")


@dataclass
class GatekeepResult:
    """Outcome of semantic filtering."""

    accepted: list[JobOpportunity] = field(default_factory=list)
    rejected: list[JobOpportunity] = field(default_factory=list)
    errored: list[JobOpportunity] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"accepted={len(self.accepted)} rejected={len(self.rejected)} "
            f"errored={len(self.errored)}"
        )


def embed(text: str, provider: EmbeddingProvider | None = None) -> list[float]:
    """Produce an embedding vector for arbitrary text."""
    return (provider or get_embedding_provider()).embed(text)


def score_against(
    job: JobOpportunity,
    portfolio_vectors: dict[str, list[float]],
    provider: EmbeddingProvider | None = None,
) -> tuple[float, str | None]:
    """
    Score a job locally against in-memory portfolio vectors.

    Used by the offline test-suite and as a fallback when the pgvector RPC is
    unavailable. Returns (fit_score, best_project_id).
    """
    if not portfolio_vectors:
        raise ValueError("No portfolio vectors supplied — run ingestion first.")

    job_vector = embed(job.to_matching_document(), provider)

    best_id: str | None = None
    best_similarity = -1.0
    for project_id, vector in portfolio_vectors.items():
        similarity = cosine_similarity(job_vector, vector)
        if similarity > best_similarity:
            best_similarity = similarity
            best_id = project_id

    return similarity_to_fit_score(best_similarity), best_id


def score(
    job: JobOpportunity,
    provider: EmbeddingProvider | None = None,
) -> tuple[float, str | None]:
    """
    Score a job via the pgvector RPC. Returns (fit_score, best_project_id).
    """
    job_vector = embed(job.to_matching_document(), provider)
    matches = repository.match_portfolio(job_vector, match_count=1)
    if not matches:
        return 0.0, None
    top = matches[0]
    return float(top["fit_score"]), top.get("project_id")


def apply_verdict(
    job: JobOpportunity,
    fit_score: float,
    best_project_id: str | None,
    threshold: int,
) -> bool:
    """
    Stamp the scoring verdict onto a job. Returns True when it passes.

    Accepted jobs advance straight to `high_match`: the Radar's first column is
    for discoveries the gatekeeper has not yet judged, and anything surviving
    the threshold is by definition a high match.
    """
    job.fitScore = fit_score
    job.bestProjectId = best_project_id

    if fit_score >= threshold:
        job.stage = PipelineStage.HIGH_MATCH
        job.rejectionReason = None
        return True

    job.stage = PipelineStage.DISCOVERED
    job.rejectionReason = (
        f"Fit score {fit_score:.2f} below threshold {threshold}."
    )
    return False


def gatekeep(
    jobs: list[JobOpportunity],
    config: SearchConfiguration,
    *,
    provider: EmbeddingProvider | None = None,
    portfolio_vectors: dict[str, list[float]] | None = None,
) -> GatekeepResult:
    """
    Drop every job below the configured matching threshold.

    When `portfolio_vectors` is supplied, scoring happens locally (offline
    mode); otherwise the pgvector RPC is used.
    """
    provider = provider or get_embedding_provider()
    result = GatekeepResult()

    for job in jobs:
        try:
            if portfolio_vectors is not None:
                fit_score, best_id = score_against(job, portfolio_vectors, provider)
            else:
                fit_score, best_id = score(job, provider)
        except Exception as exc:  # noqa: BLE001 - one bad job must not stop the gate
            logger.error("Scoring failed for '%s': %s", job.title, exc)
            job.rejectionReason = f"Scoring error: {exc}"
            result.errored.append(job)
            continue

        if apply_verdict(job, fit_score, best_id, config.matchingThreshold):
            result.accepted.append(job)
        else:
            result.rejected.append(job)

    logger.info("Gatekeeper: %s", result.summary())
    return result
