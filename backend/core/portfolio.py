"""
Shadow Matrix — Portfolio loader.
Blueprint § 3.a.

Reads `shared/portfolio_evidence.json`, the single source of truth shared with
the frontend, and hydrates it into `ProjectEvidence` models.
"""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from .schemas import ProjectEvidence
from .secrets import REPO_ROOT

PORTFOLIO_PATH = REPO_ROOT / "shared" / "portfolio_evidence.json"


def _load_raw(path: Path | None = None) -> dict:
    target = path or PORTFOLIO_PATH
    if not target.exists():
        raise FileNotFoundError(
            f"Portfolio source of truth not found at {target}. "
            "This file is shared with the frontend and must not be removed."
        )
    return json.loads(target.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_portfolio() -> list[ProjectEvidence]:
    """Parse and validate every project record."""
    raw = _load_raw()
    projects = raw.get("projects", [])
    if not projects:
        raise ValueError("Portfolio source of truth contains no projects.")

    hydrated: list[ProjectEvidence] = []
    for entry in projects:
        evidence = dict(entry.get("evidenceLayer", {}))
        # The JSON stores logical asset keys; the Python side only needs the
        # text for embedding, so image keys map straight through.
        evidence.setdefault("images", evidence.pop("imageKeys", []))
        hydrated.append(
            ProjectEvidence(
                projectId=entry["projectId"],
                identity=entry["identity"],
                decisionLog=entry["decisionLog"],
                evidenceLayer=evidence,
                softwareStack=entry.get("softwareStack", []),
            )
        )
    return hydrated


def content_hash(document: str, model: str) -> str:
    """
    Stable fingerprint of (embedded text + model).

    Ingestion compares this against the stored hash so unchanged projects are
    skipped instead of burning API quota on every run.
    """
    return hashlib.sha256(f"{model}\x00{document}".encode("utf-8")).hexdigest()
