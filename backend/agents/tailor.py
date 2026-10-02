"""
Tailor Agent — Dynamic Pitch composer.
Blueprint § 2 (`agents/tailor.py`) and § 5.3.

Drafts the cover letter for a high-match opportunity and injects the VIP route
(`/vip/{companyId}`) into it, so the recruiter lands on a page assembled from
the project evidence most relevant to their posting.

PHASE 4 implements this.
"""

from __future__ import annotations

from backend.core.schemas import JobOpportunity, Pitch


async def compose(job: JobOpportunity) -> Pitch:
    """Draft a tailored cover letter and mint the VIP link. Phase 4."""
    raise NotImplementedError("Tailor agent lands in Phase 4.")
