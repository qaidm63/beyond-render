"""
Scout Router — platform-aware dispatch and sweep orchestration.
Blueprint § 2 (`scout/router.py`) and § 4.

Routes each target platform to the cheapest engine that can serve it:
Layer 1 (XHR) wherever the gateway is open, Layer 2 (DOM) only as a fallback
for anti-bot protected sources.

The tiering is the cost model of the whole system. Layer 2 is attempted only
when the operator has supplied a browser session; its absence degrades
coverage but never fails the sweep.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.agents.scout import dom_engine, xhr_engine
from backend.agents.scout.normalise import dedupe, matches_configuration
from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity, ScoutEngine

logger = logging.getLogger("shadow-matrix.scout.router")

ENGINE_BY_SOURCE: dict[str, ScoutEngine] = {
    **{s: ScoutEngine.XHR for s in xhr_engine.SUPPORTED_SOURCES},
    **{s: ScoutEngine.XHR for s in xhr_engine.GATEWAY_SOURCES},
    **{s: ScoutEngine.DOM for s in dom_engine.SUPPORTED_SOURCES},
}


def engine_for(source: str) -> ScoutEngine:
    """Select the engine tier for a given platform."""
    return ENGINE_BY_SOURCE.get(source.lower(), ScoutEngine.XHR)


@dataclass
class SweepResult:
    """Outcome of one full swarm sweep, before semantic gatekeeping."""

    jobs: list[JobOpportunity] = field(default_factory=list)
    raw_count: int = 0
    deduped_count: int = 0
    prefiltered_count: int = 0
    engine_counts: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"raw={self.raw_count} deduped={self.deduped_count} "
            f"prefiltered={self.prefiltered_count} kept={len(self.jobs)} "
            f"engines={self.engine_counts}"
        )


async def run(
    config: SearchConfiguration,
    search_terms: list[str],
    *,
    use_dom: bool = True,
) -> SweepResult:
    """
    Execute the full swarm sweep across both layers.

    Layer 3 (semantic gatekeeping) is deliberately NOT applied here — the
    Analyst owns that decision, and keeping the split lets us persist raw
    discoveries independently of scoring.
    """
    result = SweepResult()
    collected: list[JobOpportunity] = []

    # --- Layer 1: the primary path -------------------------------
    try:
        xhr_jobs = await xhr_engine.fetch(config, search_terms)
        collected.extend(xhr_jobs)
        result.engine_counts["xhr"] = len(xhr_jobs)
        logger.info("Layer 1 (XHR) returned %d jobs", len(xhr_jobs))
    except Exception as exc:  # noqa: BLE001 - a dead layer must not kill the sweep
        result.warnings.append(f"XHR layer failed: {exc}")
        result.engine_counts["xhr"] = 0
        logger.error("Layer 1 (XHR) failed: %s", exc)

    # --- Layer 2: the emergency path -----------------------------
    if not use_dom:
        result.warnings.append("DOM layer skipped by caller.")
        result.engine_counts["dom"] = 0
    elif not dom_engine.session_ready():
        result.warnings.append(
            "DOM layer skipped: no operator browser session at "
            "backend/cookies.json. Protected platforms are not covered."
        )
        result.engine_counts["dom"] = 0
        logger.warning("Layer 2 (DOM) skipped — no operator session supplied.")
    else:
        try:
            dom_jobs = await dom_engine.fetch(config, search_terms)
            collected.extend(dom_jobs)
            result.engine_counts["dom"] = len(dom_jobs)
            logger.info("Layer 2 (DOM) returned %d jobs", len(dom_jobs))
        except dom_engine.SessionExpiredError as exc:
            result.warnings.append(f"OPERATOR ACTION REQUIRED: {exc}")
            result.engine_counts["dom"] = 0
            logger.error("Layer 2 (DOM) session expired: %s", exc)
        except Exception as exc:  # noqa: BLE001
            result.warnings.append(f"DOM layer failed: {exc}")
            result.engine_counts["dom"] = 0
            logger.error("Layer 2 (DOM) failed: %s", exc)

    # --- Consolidation -------------------------------------------
    result.raw_count = len(collected)

    unique = dedupe(collected)
    result.deduped_count = len(unique)

    kept = [job for job in unique if matches_configuration(job, config)]
    result.prefiltered_count = len(unique) - len(kept)
    result.jobs = kept

    logger.info("Sweep complete: %s", result.summary())
    return result
