"""
Analyst Agent — Semantic Gatekeeper (Scout Layer 3).
Blueprint § 4.3.

Every result from Layers 1 and 2 passes through here. The agent queries
`pgvector` in Supabase to score a posting against the architect's project
embeddings. Anything scoring below `SearchConfiguration.matchingThreshold` is
discarded immediately and never reaches the Command Center.

This is the cost valve of the whole system: it keeps LLM spend and operator
attention proportional to genuine matches.

PHASE 2 (vector search) and PHASE 4 (LLM reasoning) implement this.
"""

from __future__ import annotations

from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity


async def embed(text: str) -> list[float]:
    """Produce an embedding vector for arbitrary text. Phase 2."""
    raise NotImplementedError("Embedding pipeline lands in Phase 2.")


async def score(job: JobOpportunity) -> float:
    """Return a 0–100 Fit Score via pgvector similarity. Phase 2."""
    raise NotImplementedError("Vector matching lands in Phase 2.")


async def gatekeep(
    jobs: list[JobOpportunity],
    config: SearchConfiguration,
) -> list[JobOpportunity]:
    """Drop every job below the configured matching threshold. Phase 2."""
    raise NotImplementedError("Semantic gatekeeping lands in Phase 2.")
