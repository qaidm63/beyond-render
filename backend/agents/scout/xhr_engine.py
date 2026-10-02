"""
Scout Layer 1 — XHR / GraphQL Engine.
Blueprint § 4.1: the primary path, ~80% of coverage.

Strategy: issue direct HTTP requests that intercept the JSON payloads behind
open hiring gateways (Greenhouse, Lever, SmartRecruiters) via `python-jobspy`,
skipping heavy HTML rendering entirely. Fast and nearly free to run.

PHASE 2 implements this. Phase 1 fixes the contract only.
"""

from __future__ import annotations

from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity

SUPPORTED_SOURCES: tuple[str, ...] = ("greenhouse", "lever", "smartrecruiters")


async def fetch(
    config: SearchConfiguration,
    search_terms: list[str],
) -> list[JobOpportunity]:
    """Fetch raw postings from open gateways. Implemented in Phase 2."""
    raise NotImplementedError("XHR engine lands in Phase 2.")
