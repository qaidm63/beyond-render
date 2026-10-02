"""
Tailor Agent — Dynamic Pitch composer.
Blueprint § 2 (`agents/tailor.py`) and § 5.3.

Drafts the cover letter for a high-match opportunity and injects the VIP route
(`/vip/{companyId}`) into it, so the recruiter lands on a page assembled from
the project evidence most relevant to their posting.

Two decisions shape this module:

1. **Evidence is selected by the same vectors that scored the job.** The
   featured projects are not hand-picked or guessed — they are the nearest
   neighbours of the posting's own embedding, so the VIP page argues the case
   the gatekeeper already made.
2. **Nothing it writes is ever published.** `compose()` always returns an
   unapproved pitch. The operator approves it in the Pitch Studio, and
   `/api/pitch/{companyId}` 404s until then.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone

from backend.core import repository
from backend.core.embeddings import EmbeddingProvider, get_embedding_provider
from backend.core.llm import LLMProvider, get_llm_provider
from backend.core.portfolio import load_portfolio
from backend.core.schemas import JobOpportunity, Pitch, ProjectEvidence
from backend.core.secrets import get_secret

logger = logging.getLogger("shadow-matrix.tailor")

DEFAULT_FEATURED_COUNT = 3

SYSTEM_INSTRUCTION = (
    "You are writing on behalf of Mohammed Al-Hothaifi, a consultant architect. "
    "Write a concise, confident cover letter in professional English. "
    "Ground every claim in the supplied project evidence — never invent "
    "projects, employers, dates, certifications or metrics that are not given. "
    "Three to four short paragraphs, no bullet lists, no subject line, no "
    "placeholder brackets. Do not sign off with a name."
)


def vip_path(company_id: str) -> str:
    """The VIP route for a company. Mirrors the frontend router exactly."""
    return f"/vip/{company_id}"


def vip_url(company_id: str) -> str:
    """
    Absolute VIP link to embed in outbound letters.

    `PUBLIC_BASE_URL` is where recruiters actually reach the site. When it is
    unset we still return the relative path rather than guessing a hostname —
    a wrong absolute link is worse than an obviously relative one.
    """
    base = (get_secret("PUBLIC_BASE_URL") or "").rstrip("/")
    return f"{base}{vip_path(company_id)}" if base else vip_path(company_id)


def select_featured_projects(
    job: JobOpportunity,
    *,
    count: int = DEFAULT_FEATURED_COUNT,
    provider: EmbeddingProvider | None = None,
    portfolio_vectors: dict[str, list[float]] | None = None,
) -> list[ProjectEvidence]:
    """
    Pick the project evidence that best answers this posting.

    Uses the pgvector RPC by default; `portfolio_vectors` switches to local
    scoring for offline runs and tests. Falls back to the job's single
    `bestProjectId`, then to the first projects on file, so a pitch can always
    be drafted even when the vector store is unreachable.
    """
    by_id = {p.projectId: p for p in load_portfolio()}
    ordered_ids: list[str] = []

    try:
        if portfolio_vectors is not None:
            from backend.core.embeddings import cosine_similarity

            provider = provider or get_embedding_provider()
            job_vector = provider.embed(job.to_matching_document())
            ranked = sorted(
                portfolio_vectors.items(),
                key=lambda item: cosine_similarity(job_vector, item[1]),
                reverse=True,
            )
            ordered_ids = [project_id for project_id, _ in ranked]
        else:
            provider = provider or get_embedding_provider()
            job_vector = provider.embed(job.to_matching_document())
            matches = repository.match_portfolio(job_vector, match_count=count)
            ordered_ids = [m["project_id"] for m in matches if m.get("project_id")]
    except Exception as exc:  # noqa: BLE001 - a draft is better than no draft
        logger.warning("Evidence ranking failed (%s); falling back.", exc)

    if not ordered_ids and job.bestProjectId:
        ordered_ids = [job.bestProjectId]

    selected = [by_id[pid] for pid in ordered_ids if pid in by_id][:count]
    if not selected:
        selected = list(by_id.values())[:count]
    return selected


def _evidence_block(projects: list[ProjectEvidence]) -> str:
    """Render the project evidence the letter is allowed to draw on."""
    blocks = []
    for project in projects:
        blocks.append(
            "\n".join(
                [
                    f"- Project: {project.identity.title} "
                    f"({project.identity.category.value}, "
                    f"{project.identity.status.value})",
                    f"  Challenge: {project.decisionLog.challenge}",
                    f"  Decision: {project.decisionLog.decision}",
                    f"  Outcome: {project.decisionLog.outcome}",
                    f"  Tools: {', '.join(project.softwareStack) or 'n/a'}",
                ]
            )
        )
    return "\n".join(blocks)


def build_prompt(job: JobOpportunity, projects: list[ProjectEvidence]) -> str:
    """Assemble the grounded prompt. Pure function — easy to assert on."""
    lines = [
        "Write a cover letter applying for the role below.",
        "",
        "## The role",
        f"Title: {job.title}",
        f"Company: {job.company}",
    ]
    if job.location:
        lines.append(f"Location: {job.location}")
    if job.contractType:
        lines.append(f"Contract: {job.contractType}")
    if job.description:
        # Long postings add noise and cost without improving the letter.
        lines.append(f"Description: {job.description[:2000]}")

    lines += [
        "",
        "## Project evidence you may cite (and nothing else)",
        _evidence_block(projects),
        "",
        "## Requirements",
        "Open by naming the role and the company. Connect the evidence above "
        "to what the role needs. Close by inviting the reader to the portfolio "
        "link, which will be appended automatically — do not write the URL "
        "yourself.",
    ]
    return "\n".join(lines)


_URL_RE = re.compile(r"https?://\S+")


def inject_vip_link(letter: str, company_id: str) -> str:
    """
    Append the VIP call-to-action.

    Any URL the model hallucinated is stripped first: the only link that may
    leave this system is the one we mint.
    """
    cleaned = _URL_RE.sub("", letter).rstrip()
    link = vip_url(company_id)
    return (
        f"{cleaned}\n\n"
        f"A portfolio tailored to this role is here: {link}"
    )


async def compose(
    job: JobOpportunity,
    *,
    llm: LLMProvider | None = None,
    provider: EmbeddingProvider | None = None,
    portfolio_vectors: dict[str, list[float]] | None = None,
    featured_count: int = DEFAULT_FEATURED_COUNT,
) -> Pitch:
    """
    Draft a tailored cover letter and mint the VIP link.

    Returns an **unapproved** pitch. Persisting and publishing are separate,
    operator-driven steps.
    """
    llm = llm or get_llm_provider(role="tailor")

    projects = await asyncio.to_thread(
        select_featured_projects,
        job,
        count=featured_count,
        provider=provider,
        portfolio_vectors=portfolio_vectors,
    )
    prompt = build_prompt(job, projects)

    # Async-native providers (AMD) rotate keys internally; blocking ones
    # implement agenerate() on a worker thread. Either way the loop is free.
    letter = await llm.agenerate(prompt, system=SYSTEM_INSTRUCTION)

    return Pitch(
        companyId=job.companyId,
        companyName=job.company,
        jobId=job.id or job.fingerprint,
        coverLetter=inject_vip_link(letter, job.companyId),
        featuredProjectIds=[p.projectId for p in projects],
        approved=False,
        viewCount=0,
        createdAt=datetime.now(timezone.utc),
    )
