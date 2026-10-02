"""
Shadow Matrix — Scout normalisation helpers.
Blueprint § 4.

Both engines emit wildly different payload shapes. Everything funnels through
here so the Analyst sees one consistent record type, and so de-duplication
works across engines (the same LinkedIn job may also surface via Greenhouse).

Pure functions only — no I/O — which makes this the most heavily tested module
in the backend.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from backend.core.config import SearchConfiguration
from backend.core.schemas import JobOpportunity, ScoutEngine

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")
_HTML_TAG = re.compile(r"<[^>]+>")

REMOTE_HINTS = ("remote", "anywhere", "work from home", "wfh", "distributed")


def slugify(value: str) -> str:
    """
    Stable, URL-safe company identifier used for the `/vip/:companyId` route.

    Unicode is folded to ASCII so 'Böhm Architekten' and 'Bohm Architekten'
    resolve to the same pitch page rather than creating two.
    """
    if not value:
        return "unknown"
    folded = unicodedata.normalize("NFKD", value)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
    slug = _NON_ALNUM.sub("-", ascii_only).strip("-")
    return slug or "unknown"


def clean_text(value: Any, limit: int = 8000) -> str | None:
    """Strip HTML and collapse whitespace; cap length to bound embedding cost."""
    if value is None:
        return None
    text = str(value)
    if not text or text.lower() == "nan":
        return None
    text = _HTML_TAG.sub(" ", text)
    text = _WHITESPACE.sub(" ", text).strip()
    if not text:
        return None
    return text[:limit]


def fingerprint(source: str, url: str, title: str, company: str) -> str:
    """
    Cross-run identity for a posting.

    Prefers the URL (stable per posting). Falls back to source+title+company so
    a missing URL cannot collapse unrelated jobs into one row.
    """
    basis = url.strip().lower() if url else f"{source}|{title}|{company}".lower()
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def detect_remote(location: str | None, description: str | None) -> bool | None:
    """Best-effort remote detection from free text."""
    haystack = " ".join(filter(None, [location, description])).lower()
    if not haystack:
        return None
    return any(hint in haystack for hint in REMOTE_HINTS)


def dedupe(jobs: list[JobOpportunity]) -> list[JobOpportunity]:
    """
    Collapse duplicates by fingerprint, keeping the richest record.

    "Richest" = longest description, because the Analyst's Fit Score is only as
    good as the text it embeds. Engine tier breaks ties in favour of XHR, whose
    payloads are structured rather than scraped.
    """
    best: dict[str, JobOpportunity] = {}
    for job in jobs:
        incumbent = best.get(job.fingerprint)
        if incumbent is None:
            best[job.fingerprint] = job
            continue
        challenger_len = len(job.description or "")
        incumbent_len = len(incumbent.description or "")
        if challenger_len > incumbent_len:
            best[job.fingerprint] = job
        elif challenger_len == incumbent_len and job.engine == ScoutEngine.XHR:
            best[job.fingerprint] = job
    return list(best.values())


def matches_configuration(job: JobOpportunity, config: SearchConfiguration) -> bool:
    """
    Cheap structural pre-filter applied BEFORE any embedding call.

    This is a deliberate cost control: discarding an obviously unsuitable job
    here saves a Gemini round-trip in the Analyst. It is intentionally
    permissive — when a signal is missing we keep the job and let the semantic
    gatekeeper decide. Silence is not evidence of a mismatch.
    """
    work = config.workModel
    if not (work.remoteWorldwide or work.onSite or work.hybrid):
        return False  # every work model disabled: nothing qualifies

    # Remote-only operator: drop jobs we positively know are on-site.
    if work.remoteWorldwide and not work.onSite and not work.hybrid:
        if job.isRemote is False and not _location_allowed(job.location, config):
            return False

    # On-site operator with a location whitelist: a known location must match.
    if not work.remoteWorldwide and config.targetLocations:
        if job.location and not _location_allowed(job.location, config):
            return False

    contract = config.contractType
    if job.contractType:
        kind = job.contractType.lower()
        if "full" in kind and not contract.fullTime:
            return False
        if ("contract" in kind or "project" in kind) and not contract.projectBased:
            return False
        if "freelance" in kind and not contract.freelance:
            return False

    return True


def _location_allowed(location: str | None, config: SearchConfiguration) -> bool:
    if not location:
        return True
    haystack = location.lower()
    for target in config.targetLocations:
        needle = target.lower()
        if needle == "remote":
            if any(hint in haystack for hint in REMOTE_HINTS):
                return True
            continue
        if needle in haystack or haystack in needle:
            return True
    return False


def from_jobspy_row(row: dict[str, Any]) -> JobOpportunity | None:
    """
    Convert one `python-jobspy` record into a JobOpportunity.

    Returns None when the row lacks the minimum viable fields rather than
    emitting a half-formed record into the pipeline.
    """
    title = clean_text(row.get("title"), 300)
    company = clean_text(row.get("company"), 300)
    url = clean_text(row.get("job_url") or row.get("url"), 1000)
    if not title or not company or not url:
        return None

    source = clean_text(row.get("site"), 100) or "unknown"
    location = clean_text(row.get("location"), 300)
    description = clean_text(row.get("description"))
    contract = clean_text(row.get("job_type"), 100)

    remote_flag = row.get("is_remote")
    is_remote = bool(remote_flag) if isinstance(remote_flag, bool) else detect_remote(
        location, description
    )

    return JobOpportunity(
        fingerprint=fingerprint(source, url, title, company),
        title=title,
        company=company,
        companyId=slugify(company),
        location=location,
        url=url,
        source=source,
        engine=ScoutEngine.XHR,
        description=description,
        contractType=contract,
        isRemote=is_remote,
        postedAt=_parse_date(row.get("date_posted")),
        discoveredAt=datetime.now(timezone.utc),
    )


def _parse_date(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None
