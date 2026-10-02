"""
Scout Router — platform-aware dispatch.
Blueprint § 2 (`scout/router.py`) and § 4.

Routes each target platform to the cheapest engine that can serve it:
Layer 1 (XHR) wherever the gateway is open, Layer 2 (DOM) only as a fallback
for anti-bot protected sources.

PHASE 2 implements the orchestration. Phase 1 fixes the contract.
"""

from __future__ import annotations

from backend.agents.scout import dom_engine, xhr_engine
from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity, ScoutEngine

ENGINE_BY_SOURCE: dict[str, ScoutEngine] = {
    **{s: ScoutEngine.XHR for s in xhr_engine.SUPPORTED_SOURCES},
    **{s: ScoutEngine.DOM for s in dom_engine.SUPPORTED_SOURCES},
}


def engine_for(source: str) -> ScoutEngine:
    """Select the engine tier for a given platform."""
    return ENGINE_BY_SOURCE.get(source.lower(), ScoutEngine.XHR)


async def run(
    config: SearchConfiguration,
    search_terms: list[str],
) -> list[JobOpportunity]:
    """Execute the full swarm sweep across both layers. Phase 2."""
    raise NotImplementedError("Scout orchestration lands in Phase 2.")
