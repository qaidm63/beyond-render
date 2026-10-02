"""
Shadow Matrix — Periodic sweep scheduler.
Blueprint § 6 Phase 4 ("الجدولة الدورية").

A single asyncio task that re-runs `pipeline.run_sweep()` on an interval, so
the operator stops triggering discovery by hand.

Deliberate choices:

* **Opt-in.** `SWEEP_INTERVAL_MINUTES` defaults to 0, which means disabled.
  An API process that silently starts burning Gemini quota on a timer is a
  bad default.
* **No new dependency.** The blueprint pins the dependency list; APScheduler
  and Celery are not on it, and one `asyncio.sleep` loop is all this needs.
* **Never dies.** A failing sweep logs, alerts, and waits for the next tick.
  An unhandled exception would silently kill scheduling for the whole process
  lifetime.
* **Single-process.** This runs in-process; with multiple API workers each
  would schedule its own sweep. Run exactly one scheduler-enabled process.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from backend.agents import ops
from backend.core.secrets import get_secret

logger = logging.getLogger("shadow-matrix.scheduler")

# Guard rail: a 1-minute sweep loop would hammer the job boards and the
# embedding quota. Anything lower than this is clamped up.
MIN_INTERVAL_MINUTES = 5


@dataclass
class SchedulerState:
    """Observable state, surfaced by `GET /api/scheduler`."""

    enabled: bool = False
    interval_minutes: int = 0
    running: bool = False
    run_count: int = 0
    failure_count: int = 0
    last_started_at: datetime | None = None
    last_finished_at: datetime | None = None
    last_report: dict = field(default_factory=dict)
    last_error: str | None = None

    def as_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "intervalMinutes": self.interval_minutes,
            "running": self.running,
            "runCount": self.run_count,
            "failureCount": self.failure_count,
            "lastStartedAt": (
                self.last_started_at.isoformat() if self.last_started_at else None
            ),
            "lastFinishedAt": (
                self.last_finished_at.isoformat() if self.last_finished_at else None
            ),
            "lastReport": self.last_report,
            "lastError": self.last_error,
        }


STATE = SchedulerState()
_task: asyncio.Task | None = None


def configured_interval() -> int:
    """
    Resolve the sweep interval in minutes. 0 (or unset/invalid) = disabled.
    """
    raw = get_secret("SWEEP_INTERVAL_MINUTES", "0") or "0"
    try:
        minutes = int(raw)
    except ValueError:
        logger.warning("SWEEP_INTERVAL_MINUTES=%r is not an integer; disabling.", raw)
        return 0

    if minutes <= 0:
        return 0
    if minutes < MIN_INTERVAL_MINUTES:
        logger.warning(
            "SWEEP_INTERVAL_MINUTES=%s is below the %s-minute floor; clamping.",
            minutes,
            MIN_INTERVAL_MINUTES,
        )
        return MIN_INTERVAL_MINUTES
    return minutes


async def run_once(*, notify: bool = True) -> dict:
    """
    Execute one scheduled sweep and record the outcome.

    Imported lazily so importing the scheduler never drags in the whole
    pipeline (and its optional scraping dependencies).
    """
    from backend import pipeline as pipeline_module

    STATE.running = True
    STATE.last_started_at = datetime.now(timezone.utc)
    STATE.last_error = None

    try:
        report = await pipeline_module.run_sweep(notify=notify)
        STATE.last_report = report.as_dict()
        STATE.run_count += 1
        return STATE.last_report
    except Exception as exc:  # noqa: BLE001 - the loop must survive
        STATE.failure_count += 1
        STATE.last_error = str(exc)
        logger.exception("Scheduled sweep failed.")
        if notify:
            await ops.notify_sweep_failure(str(exc))
        return {"error": str(exc)}
    finally:
        STATE.running = False
        STATE.last_finished_at = datetime.now(timezone.utc)


async def _loop(interval_minutes: int) -> None:
    """Sleep-first loop: never sweeps during application startup."""
    delay = interval_minutes * 60
    logger.info("Sweep scheduler active — every %s minute(s).", interval_minutes)
    while True:
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.info("Sweep scheduler stopped.")
            raise
        await run_once()


def start() -> bool:
    """Start the background loop. Returns True when it was actually started."""
    global _task

    interval = configured_interval()
    STATE.interval_minutes = interval

    if interval == 0:
        STATE.enabled = False
        logger.info("Sweep scheduler disabled (SWEEP_INTERVAL_MINUTES=0).")
        return False

    if _task is not None and not _task.done():
        logger.warning("Sweep scheduler already running.")
        return False

    _task = asyncio.create_task(_loop(interval), name="shadow-matrix-sweep")
    STATE.enabled = True
    return True


async def stop() -> None:
    """Cancel the background loop and wait for it to unwind."""
    global _task

    if _task is None or _task.done():
        _task = None
        STATE.enabled = False
        return

    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    finally:
        _task = None
        STATE.enabled = False
