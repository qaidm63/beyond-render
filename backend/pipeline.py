"""
Shadow Matrix — Sweep orchestration.
Blueprint § 4: binds the three layers into one runnable cycle.

    Layer 1/2 (router.run)  ->  Layer 3 (analyst.gatekeep)  ->  persistence

Kept separate from `main.py` so the same cycle can be driven by the API, a
CLI, or the Phase 4 scheduler without duplication.

Usage
-----
    .venv/bin/python -m backend.pipeline --dry-run
    .venv/bin/python -m backend.pipeline
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from dataclasses import asdict, dataclass, field

from backend.agents import analyst, ops
from backend.agents.scout import router
from backend.core import repository
from backend.core.config import DEFAULT_SEARCH_TERMS, SearchConfiguration
from backend.core.embeddings import get_embedding_provider

logger = logging.getLogger("shadow-matrix.pipeline")


@dataclass
class SweepReport:
    raw_count: int = 0
    deduped_count: int = 0
    prefiltered_count: int = 0
    scored_count: int = 0
    accepted_count: int = 0
    rejected_count: int = 0
    errored_count: int = 0
    persisted_count: int = 0
    notified: bool = False
    engine_counts: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def _load_config() -> tuple[SearchConfiguration, list[str]]:
    """
    Read the live control matrix, falling back to in-code defaults.

    The database is authoritative once Phase 3 lets the operator edit it; the
    fallback keeps the sweep runnable before that table is populated.
    """
    try:
        config = repository.read_config()
        terms = repository.read_search_terms()
        if config is not None:
            return config, (terms or DEFAULT_SEARCH_TERMS)
        logger.warning("agent_config is empty; using in-code defaults.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read agent_config (%s); using defaults.", exc)
    return SearchConfiguration(), DEFAULT_SEARCH_TERMS


async def run_sweep(
    *,
    config: SearchConfiguration | None = None,
    search_terms: list[str] | None = None,
    use_dom: bool = True,
    dry_run: bool = False,
    offline: bool = False,
    notify: bool = False,
) -> SweepReport:
    """Run one complete discovery cycle."""
    report = SweepReport()

    if config is None or search_terms is None:
        loaded_config, loaded_terms = _load_config()
        config = config or loaded_config
        search_terms = search_terms or loaded_terms

    # --- Layers 1 & 2 --------------------------------------------
    sweep = await router.run(config, search_terms, use_dom=use_dom)
    report.raw_count = sweep.raw_count
    report.deduped_count = sweep.deduped_count
    report.prefiltered_count = sweep.prefiltered_count
    report.engine_counts = sweep.engine_counts
    report.warnings = list(sweep.warnings)

    if not sweep.jobs:
        logger.info("Sweep produced no candidates; nothing to score.")
        return report

    # --- Layer 3: Semantic Gatekeeper ----------------------------
    provider = get_embedding_provider(offline=offline)
    verdict = analyst.gatekeep(sweep.jobs, config, provider=provider)
    report.scored_count = len(sweep.jobs)
    report.accepted_count = len(verdict.accepted)
    report.rejected_count = len(verdict.rejected)
    report.errored_count = len(verdict.errored)

    # --- Persistence ---------------------------------------------
    # Rejected jobs are stored too: the Radar's telemetry needs the denominator,
    # and keeping their fingerprints stops us re-scoring them every cycle.
    # They simply never leave the `discovered` stage.
    if dry_run:
        logger.info("Dry run — skipping persistence.")
        return report

    to_persist = verdict.accepted + verdict.rejected
    try:
        report.persisted_count = repository.upsert_jobs(to_persist)
    except Exception as exc:  # noqa: BLE001
        report.warnings.append(f"Persistence failed: {exc}")
        logger.error("Persistence failed: %s", exc)

    # --- Operator alert (Phase 4) --------------------------------
    # Only after persistence: an alert about jobs the Radar cannot show the
    # operator is worse than no alert. Never raises — see agents/ops.py.
    if notify and verdict.accepted:
        report.notified = await ops.notify_high_matches(verdict.accepted)

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one Shadow Matrix sweep.")
    parser.add_argument("--dry-run", action="store_true", help="do not persist")
    parser.add_argument("--no-dom", action="store_true", help="skip Layer 2")
    parser.add_argument("--offline", action="store_true", help="hashing embedder")
    parser.add_argument("--notify", action="store_true", help="send Telegram alert")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    report = asyncio.run(
        run_sweep(
            use_dom=not args.no_dom,
            dry_run=args.dry_run,
            offline=args.offline,
            notify=args.notify,
        )
    )

    logger.info("=" * 60)
    for key, value in report.as_dict().items():
        logger.info("%-18s %s", key, value)
    return 0


if __name__ == "__main__":
    sys.exit(main())
