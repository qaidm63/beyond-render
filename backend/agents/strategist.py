"""
Shadow Matrix — Portfolio Strategist.

Closes the loop between the portfolio and the job market the Scout is
already sweeping. Three capabilities, all reading data the system
collects anyway:

1. ``coverage_gaps``  — which capability keeps costing you near-miss jobs.
2. ``score_project``  — what a draft would score against real postings,
                        measured before it is saved.
3. ``compare_variants`` — which of two narrative framings scores higher.

The premise
-----------
The Analyst already scores every posting against the portfolio and rejects
everything under ``matchingThreshold``. Those rejections are a free, honest
signal about what the portfolio cannot yet prove. A portfolio tool that
ignores them is guessing; this one does not.

Cost discipline
---------------
Job vectors are embedded on demand and cached per process. The sample is
bounded by ``MAX_JOBS_SAMPLED`` so a gap analysis costs a predictable
number of embedding calls, not one per row in the table.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from backend.core.embeddings import (
    EmbeddingProvider,
    cosine_similarity,
    get_embedding_provider,
    similarity_to_fit_score,
)
from backend.core.llm import LLMProvider, get_llm_provider
from backend.core.schemas import ProjectEvidence

logger = logging.getLogger("shadow-matrix.strategist")

# Bounds the embedding spend of a single analysis.
MAX_JOBS_SAMPLED = 40
# A "near miss" is a posting the portfolio almost answered. Far below the
# threshold usually means the wrong discipline, not a portfolio gap.
NEAR_MISS_BAND = 20.0

_JOB_VECTOR_CACHE: dict[str, list[float]] = {}


def clear_cache() -> None:
    """Drop cached job vectors (used by tests and after a re-embed)."""
    _JOB_VECTOR_CACHE.clear()


class StrategistError(RuntimeError):
    """Analysis could not be completed."""


# ---------------------------------------------------------------- #
# Job sampling                                                      #
# ---------------------------------------------------------------- #


def _job_text(row: dict[str, Any]) -> str:
    parts = [row.get("title") or "", row.get("company") or ""]
    if row.get("location"):
        parts.append(str(row["location"]))
    if row.get("description"):
        # Postings run long and the tail is usually boilerplate benefits.
        parts.append(str(row["description"])[:4000])
    return "\n".join(p for p in parts if p).strip()


def _vector_for(row: dict[str, Any], provider: EmbeddingProvider) -> list[float] | None:
    key = row.get("fingerprint") or row.get("id") or ""
    if key and key in _JOB_VECTOR_CACHE:
        return _JOB_VECTOR_CACHE[key]
    text = _job_text(row)
    if not text:
        return None
    try:
        vector = provider.embed(text)
    except Exception as exc:  # noqa: BLE001 - one bad row must not abort
        logger.warning("Could not embed job %s: %s", key or "<unknown>", exc)
        return None
    if key:
        _JOB_VECTOR_CACHE[key] = vector
    return vector


def sample_jobs(
    rows: list[dict[str, Any]],
    threshold: float,
    *,
    near_miss_only: bool = False,
    limit: int = MAX_JOBS_SAMPLED,
) -> list[dict[str, Any]]:
    """
    Choose the postings worth measuring against.

    ``near_miss_only`` keeps those scored within ``NEAR_MISS_BAND`` below
    the threshold: close enough that better evidence could have won them.
    Unscored rows are kept in the general sample because an unscored
    posting is not evidence of a bad fit.
    """
    selected: list[dict[str, Any]] = []
    for row in rows:
        score = row.get("fit_score")
        score = float(score) if score is not None else None

        if near_miss_only:
            if score is None or score >= threshold:
                continue
            if score < threshold - NEAR_MISS_BAND:
                continue
        selected.append(row)

    # Highest-scoring first: those are the most informative near misses.
    selected.sort(key=lambda r: float(r.get("fit_score") or 0.0), reverse=True)
    return selected[:limit]


# ---------------------------------------------------------------- #
# 2. Embedding fitness                                              #
# ---------------------------------------------------------------- #


@dataclass
class JobScore:
    jobId: str | None
    title: str
    company: str
    fitScore: float
    currentScore: float | None
    delta: float | None


@dataclass
class FitnessReport:
    """How a draft would perform against real postings."""

    medianScore: float = 0.0
    bestScore: float = 0.0
    wouldPassCount: int = 0
    sampleSize: int = 0
    threshold: float = 85.0
    model: str = ""
    topMatches: list[JobScore] = field(default_factory=list)
    biggestGains: list[JobScore] = field(default_factory=list)
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "medianScore": round(self.medianScore, 1),
            "bestScore": round(self.bestScore, 1),
            "wouldPassCount": self.wouldPassCount,
            "sampleSize": self.sampleSize,
            "threshold": self.threshold,
            "model": self.model,
            "topMatches": [vars(j) for j in self.topMatches],
            "biggestGains": [vars(j) for j in self.biggestGains],
            "note": self.note,
        }


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def score_document(
    document: str,
    jobs: list[dict[str, Any]],
    *,
    threshold: float = 85.0,
    provider: EmbeddingProvider | None = None,
) -> FitnessReport:
    """
    Score one flattened project document against a sample of postings.

    Operates on the document rather than the project so a draft can be
    measured before it exists as a saved entity, and so A/B variants are
    scored through exactly the same path.
    """
    provider = provider or get_embedding_provider()
    report = FitnessReport(threshold=threshold, model=getattr(provider, "name", "?"))

    if not document.strip():
        report.note = "Nothing to score: the document is empty."
        return report
    if not jobs:
        report.note = (
            "No postings available to score against. Run a sweep first; "
            "until then this number would be meaningless."
        )
        return report

    try:
        project_vector = provider.embed(document)
    except Exception as exc:  # noqa: BLE001
        raise StrategistError(f"Could not embed the draft: {exc}") from exc

    scored: list[JobScore] = []
    for row in jobs:
        vector = _vector_for(row, provider)
        if vector is None:
            continue
        fit = similarity_to_fit_score(cosine_similarity(project_vector, vector))
        current = row.get("fit_score")
        current = float(current) if current is not None else None
        scored.append(
            JobScore(
                jobId=str(row.get("id")) if row.get("id") else None,
                title=str(row.get("title") or "Untitled"),
                company=str(row.get("company") or "Unknown"),
                fitScore=round(fit, 1),
                currentScore=round(current, 1) if current is not None else None,
                delta=round(fit - current, 1) if current is not None else None,
            )
        )

    if not scored:
        report.note = "No posting in the sample could be embedded."
        return report

    values = [s.fitScore for s in scored]
    report.sampleSize = len(scored)
    report.medianScore = _median(values)
    report.bestScore = max(values)
    report.wouldPassCount = sum(1 for v in values if v >= threshold)
    report.topMatches = sorted(scored, key=lambda s: s.fitScore, reverse=True)[:5]
    report.biggestGains = sorted(
        (s for s in scored if s.delta is not None),
        key=lambda s: s.delta or 0.0,
        reverse=True,
    )[:5]
    return report


def score_project(
    project: ProjectEvidence,
    jobs: list[dict[str, Any]],
    *,
    threshold: float = 85.0,
    provider: EmbeddingProvider | None = None,
) -> FitnessReport:
    """Score a project exactly as the Analyst would see it once saved."""
    return score_document(
        project.to_embedding_document(),
        jobs,
        threshold=threshold,
        provider=provider,
    )


# ---------------------------------------------------------------- #
# 1. Coverage gap analysis                                          #
# ---------------------------------------------------------------- #

GAP_SYSTEM = (
    "You are a portfolio strategist for an architectural practice. You are "
    "given job postings that a candidate's portfolio ALMOST matched but "
    "failed to clear, each with its similarity score.\n\n"
    "Identify the recurring capabilities, project types, software or "
    "domain experience these postings demand that the portfolio evidently "
    "does not demonstrate. Work only from the supplied postings.\n\n"
    "Rules:\n"
    "- Name capabilities concretely, as an architect would ('parametric "
    "facade optimisation', 'hospital departmental planning'), never vaguely "
    "('more experience', 'better skills').\n"
    "- Rank by how many postings demand it.\n"
    "- Do not invent a demand that appears in only one posting unless that "
    "posting is unusually senior; say so if you do.\n"
    "- Never suggest the candidate fabricate experience. Every "
    "recommendation must be a project they could genuinely undertake or a "
    "capability they could genuinely document from past work.\n\n"
    "Return ONLY a JSON object:\n"
    "{\n"
    '  "gaps": [\n'
    "    {\n"
    '      "capability": "short name",\n'
    '      "demandCount": 0,\n'
    '      "evidence": "which postings demand it and in what terms",\n'
    '      "recommendedProject": "one concrete case study that would '
    'demonstrate it",\n'
    '      "priority": "high" | "medium" | "low"\n'
    "    }\n"
    "  ],\n"
    '  "summary": "two sentences on the single most costly gap"\n'
    "}"
)


@dataclass
class CoverageGap:
    capability: str
    demandCount: int
    evidence: str
    recommendedProject: str
    priority: str


@dataclass
class CoverageReport:
    gaps: list[CoverageGap] = field(default_factory=list)
    summary: str = ""
    sampleSize: int = 0
    threshold: float = 85.0
    scoreRange: tuple[float, float] | None = None
    note: str | None = None
    generator: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "gaps": [vars(g) for g in self.gaps],
            "summary": self.summary,
            "sampleSize": self.sampleSize,
            "threshold": self.threshold,
            "scoreRange": list(self.scoreRange) if self.scoreRange else None,
            "note": self.note,
            "generator": self.generator,
        }


def build_gap_prompt(rows: list[dict[str, Any]], threshold: float) -> str:
    lines = [
        f"Portfolio matching threshold: {threshold:.0f}/100.",
        f"Near-miss postings ({len(rows)}), highest score first:",
        "",
    ]
    for index, row in enumerate(rows, start=1):
        score = row.get("fit_score")
        score_text = f"{float(score):.0f}" if score is not None else "unscored"
        lines.append(
            f"[{index}] {row.get('title') or 'Untitled'} — "
            f"{row.get('company') or 'Unknown'} (scored {score_text})"
        )
        if row.get("rejection_reason"):
            lines.append(f"    Analyst note: {row['rejection_reason']}")
        description = (row.get("description") or "").strip()
        if description:
            lines.append(f"    Requirements: {description[:1200]}")
        lines.append("")
    return "\n".join(lines)


async def coverage_gaps(
    rows: list[dict[str, Any]],
    *,
    threshold: float = 85.0,
    llm: LLMProvider | None = None,
) -> CoverageReport:
    """
    Find the capabilities that keep costing near-miss postings.

    Returns an empty report with a ``note`` rather than raising when the
    sample is too small — a gap analysis over three postings would be
    noise presented as insight.
    """
    sample = sample_jobs(rows, threshold, near_miss_only=True)
    report = CoverageReport(threshold=threshold, sampleSize=len(sample))

    if len(sample) < 3:
        report.note = (
            f"Only {len(sample)} near-miss postings on record. At least 3 are "
            "needed before a pattern means anything. Run more sweeps."
        )
        return report

    scores = [float(r["fit_score"]) for r in sample if r.get("fit_score") is not None]
    if scores:
        report.scoreRange = (round(min(scores), 1), round(max(scores), 1))

    llm = llm or get_llm_provider(role="analyst")
    report.generator = getattr(llm, "name", "?")

    try:
        raw = await llm.agenerate(
            build_gap_prompt(sample, threshold), system=GAP_SYSTEM
        )
    except Exception as exc:  # noqa: BLE001
        raise StrategistError(f"Gap analysis failed: {exc}") from exc

    from backend.agents.curator import SynthesisError, parse_synthesis

    try:
        parsed = parse_synthesis(raw)
    except SynthesisError as exc:
        raise StrategistError(str(exc)) from exc

    for entry in parsed.get("gaps") or []:
        if not isinstance(entry, dict):
            continue
        capability = str(entry.get("capability") or "").strip()
        if not capability:
            continue
        priority = str(entry.get("priority") or "medium").lower()
        if priority not in {"high", "medium", "low"}:
            priority = "medium"
        try:
            demand = int(entry.get("demandCount") or 0)
        except (TypeError, ValueError):
            demand = 0
        report.gaps.append(
            CoverageGap(
                capability=capability,
                demandCount=demand,
                evidence=str(entry.get("evidence") or "").strip(),
                recommendedProject=str(entry.get("recommendedProject") or "").strip(),
                priority=priority,
            )
        )

    report.gaps.sort(key=lambda g: g.demandCount, reverse=True)
    report.summary = str(parsed.get("summary") or "").strip()
    return report


# ---------------------------------------------------------------- #
# 3. A/B narrative testing                                          #
# ---------------------------------------------------------------- #

# Two defensible framings of the same facts. Not tone presets: each
# foregrounds a different kind of competence, which genuinely changes
# which postings the vector lands near.
NARRATIVE_STANCES: dict[str, str] = {
    "computational": (
        "Foreground the computational and technical logic: parametric "
        "method, data-driven iteration, performance simulation, "
        "coordination and digital delivery. Lead with how the solution was "
        "derived."
    ),
    "urban": (
        "Foreground the urban, social and experiential logic: how the "
        "project sits in its context, who uses it, how public life and "
        "circulation are organised. Lead with what the solution does for "
        "people."
    ),
}


@dataclass
class VariantResult:
    stance: str
    project: ProjectEvidence
    fitness: FitnessReport

    def to_dict(self) -> dict[str, Any]:
        return {
            "stance": self.stance,
            "project": self.project.model_dump(mode="json"),
            "fitness": self.fitness.to_dict(),
        }


@dataclass
class VariantComparison:
    variants: list[VariantResult] = field(default_factory=list)
    winner: str | None = None
    margin: float = 0.0
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "variants": [v.to_dict() for v in self.variants],
            "winner": self.winner,
            "margin": round(self.margin, 1),
            "note": self.note,
        }


async def compare_variants(
    payload: dict[str, Any],
    *,
    project_id: str,
    jobs: list[dict[str, Any]],
    threshold: float = 85.0,
    observations: str = "",
    stances: list[str] | None = None,
    llm: LLMProvider | None = None,
    provider: EmbeddingProvider | None = None,
) -> VariantComparison:
    """
    Synthesise the same project under two framings and measure both.

    The variants are generated concurrently: they are independent, and
    serialising them would double the operator's wait for no reason.
    """
    from backend.agents import curator

    chosen = stances or ["computational", "urban"]
    unknown = [s for s in chosen if s not in NARRATIVE_STANCES]
    if unknown:
        raise StrategistError(f"Unknown narrative stance(s): {', '.join(unknown)}")

    async def build(stance: str) -> tuple[str, ProjectEvidence]:
        variant_payload = dict(payload)
        variant_payload["_stance"] = NARRATIVE_STANCES[stance]
        project, _ = await curator.synthesise(
            variant_payload,
            project_id=project_id,
            llm=llm,
            observations=observations,
        )
        return stance, project

    results = await asyncio.gather(
        *(build(stance) for stance in chosen), return_exceptions=True
    )

    comparison = VariantComparison()
    provider = provider or get_embedding_provider()

    for item in results:
        if isinstance(item, BaseException):
            logger.warning("Variant generation failed: %s", item)
            continue
        stance, project = item
        fitness = score_document(
            project.to_embedding_document(),
            jobs,
            threshold=threshold,
            provider=provider,
        )
        comparison.variants.append(VariantResult(stance, project, fitness))

    if not comparison.variants:
        raise StrategistError("Every variant failed to generate.")

    if len(comparison.variants) == 1:
        comparison.note = (
            "Only one variant generated; there is nothing to compare it to."
        )
        comparison.winner = comparison.variants[0].stance
        return comparison

    ranked = sorted(
        comparison.variants, key=lambda v: v.fitness.medianScore, reverse=True
    )
    comparison.winner = ranked[0].stance
    comparison.margin = ranked[0].fitness.medianScore - ranked[1].fitness.medianScore

    if comparison.margin < 1.0:
        comparison.note = (
            "The two framings score within a point of each other. The "
            "difference is not meaningful — choose on editorial grounds."
        )
    return comparison
