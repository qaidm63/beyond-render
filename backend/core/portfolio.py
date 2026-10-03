"""
Shadow Matrix — Portfolio loader.
Blueprint § 3.a.

Reads `shared/portfolio_evidence.json`, the single source of truth shared with
the frontend, and hydrates it into `ProjectEvidence` models.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
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


# ---------------------------------------------------------------- #
# Mutation (Portfolio Studio)                                       #
# ---------------------------------------------------------------- #


def invalidate_cache() -> None:
    """Drop the memoised portfolio so the next read sees what is on disk."""
    load_portfolio.cache_clear()


def slugify_project_id(title: str) -> str:
    """
    Derive a stable, URL-safe project id from a title.

    ASCII-only: these ids appear in `featuredProjectIds`, in Postgres primary
    keys and in log lines, so a transliterated-or-hashed fallback beats
    percent-encoded Arabic in all three places.
    """
    ascii_slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    ascii_slug = re.sub(r"-{2,}", "-", ascii_slug)[:48].strip("-")
    if ascii_slug:
        return ascii_slug
    # Non-Latin titles produce an empty slug; fall back to a content digest
    # rather than inventing a meaningless name.
    return "project-" + hashlib.sha256(title.encode("utf-8")).hexdigest()[:10]


def unique_project_id(title: str, existing: set[str]) -> str:
    """A slug that does not collide with an id already on file."""
    base = slugify_project_id(title)
    if base not in existing:
        return base
    for suffix in range(2, 100):
        candidate = f"{base}-{suffix}"
        if candidate not in existing:
            return candidate
    raise ValueError(f"Could not derive a unique id for '{title}'.")


def _atomic_write(target: Path, payload: str) -> None:
    """
    Replace a file without ever leaving it truncated.

    The portfolio file is the single source of truth read by both the backend
    and the frontend build. A crash midway through a plain `write_text` would
    destroy it; writing a sibling temp file and renaming makes the swap atomic
    on POSIX.
    """
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, target)


def save_project(project: ProjectEvidence, path: Path | None = None) -> bool:
    """
    Insert or update one project in the canonical JSON file.

    Returns True when the project was newly created, False when it replaced an
    existing record. Raises before touching disk if the payload is invalid.
    """
    target = path or PORTFOLIO_PATH
    raw = _load_raw(target)
    projects: list[dict] = raw.get("projects", [])

    # model_dump drops nothing: unset optional fields serialise as null, which
    # keeps the file's shape uniform and diffable.
    record = json.loads(project.model_dump_json(exclude_none=True))

    created = True
    for index, entry in enumerate(projects):
        if entry.get("projectId") == project.projectId:
            projects[index] = record
            created = False
            break
    if created:
        projects.append(record)

    raw["projects"] = projects
    _atomic_write(target, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
    invalidate_cache()
    return created


def delete_project(project_id: str, path: Path | None = None) -> bool:
    """Remove a project from the canonical file. True when something went."""
    target = path or PORTFOLIO_PATH
    raw = _load_raw(target)
    before = raw.get("projects", [])
    after = [p for p in before if p.get("projectId") != project_id]
    if len(after) == len(before):
        return False
    raw["projects"] = after
    _atomic_write(target, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
    invalidate_cache()
    return True
