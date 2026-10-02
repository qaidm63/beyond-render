"""
Scout Layer 1 — XHR / GraphQL Engine.
Blueprint § 4.1: the primary path, ~80% of coverage.

Strategy: issue direct HTTP requests that intercept the JSON payloads behind
open hiring gateways, skipping heavy HTML rendering entirely. Fast and nearly
free to run.

`python-jobspy` already implements and maintains those gateway clients, so we
drive it rather than re-writing brittle per-board parsers — the blueprint names
it explicitly for this layer.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from backend.agents.scout.normalise import from_jobspy_row
from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity

logger = logging.getLogger("shadow-matrix.scout.xhr")

# Boards reachable without a browser. `google` is included because jobspy
# queries its JSON feed rather than scraping the SERP.
SUPPORTED_SOURCES: tuple[str, ...] = (
    "indeed",
    "glassdoor",
    "zip_recruiter",
    "google",
)

# Blueprint § 4.1 names these ATS gateways. jobspy reaches their postings
# through the aggregators above; direct ATS board ids can be added here as
# they are onboarded.
GATEWAY_SOURCES: tuple[str, ...] = ("greenhouse", "lever", "smartrecruiters")

DEFAULT_RESULTS_PER_TERM = 25


class XhrEngineError(RuntimeError):
    """Raised when the whole layer fails (not a single board)."""


def _primary_location(config: SearchConfiguration) -> str:
    """jobspy takes one location per call; prefer a concrete target."""
    for location in config.targetLocations:
        if location.lower() != "remote":
            return location
    return "Remote"


def _scrape_sync(
    sites: list[str],
    term: str,
    location: str,
    results_wanted: int,
    is_remote: bool,
) -> list[dict[str, Any]]:
    """Blocking jobspy call. Executed off the event loop by `fetch`."""
    from jobspy import scrape_jobs  # imported lazily: heavy pandas dependency

    frame = scrape_jobs(
        site_name=sites,
        search_term=term,
        location=location,
        results_wanted=results_wanted,
        is_remote=is_remote,
        description_format="markdown",
        verbose=0,
    )
    if frame is None or len(frame) == 0:
        return []
    return frame.to_dict("records")


async def fetch(
    config: SearchConfiguration,
    search_terms: list[str],
    *,
    sites: list[str] | None = None,
    results_per_term: int = DEFAULT_RESULTS_PER_TERM,
) -> list[JobOpportunity]:
    """
    Sweep the open gateways for every search term.

    A failure on one board or term is logged and skipped — one flaky provider
    must never abort the whole sweep.
    """
    target_sites = sites or list(SUPPORTED_SOURCES)
    location = _primary_location(config)
    is_remote = config.workModel.remoteWorldwide

    collected: list[JobOpportunity] = []

    for term in search_terms:
        try:
            rows = await asyncio.to_thread(
                _scrape_sync,
                target_sites,
                term,
                location,
                results_per_term,
                is_remote,
            )
        except Exception as exc:  # noqa: BLE001 - isolate per-term failures
            logger.warning("XHR sweep failed for '%s': %s", term, exc)
            continue

        parsed = [job for job in (from_jobspy_row(row) for row in rows) if job]
        logger.info("XHR '%s' -> %d rows, %d usable", term, len(rows), len(parsed))
        collected.extend(parsed)

    return collected
