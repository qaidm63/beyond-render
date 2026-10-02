"""
Shadow Matrix — Ingestion pipeline.
Blueprint § 6 Phase 2: "turn the portfolio into Embeddings".

Reads the shared portfolio source of truth, flattens each project into its
embedding document, and upserts both the project row and its vector.

Idempotent: a project whose (document + model) hash is unchanged is skipped,
so re-running costs nothing in API quota.

Usage
-----
    .venv/bin/python -m backend.ingest              # embed changed projects
    .venv/bin/python -m backend.ingest --force      # re-embed everything
    .venv/bin/python -m backend.ingest --dry-run    # no writes, show plan
    .venv/bin/python -m backend.ingest --offline    # hashing embedder (tests)
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass, field

from backend.core import repository
from backend.core.embeddings import (
    EmbeddingProvider,
    HashingEmbeddingProvider,
    get_embedding_provider,
)
from backend.core.portfolio import content_hash, load_portfolio

logger = logging.getLogger("shadow-matrix.ingest")


@dataclass
class IngestionReport:
    embedded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    failed: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.failed

    def summary(self) -> str:
        return (
            f"embedded={len(self.embedded)} "
            f"skipped={len(self.skipped)} "
            f"failed={len(self.failed)}"
        )


def run_ingestion(
    provider: EmbeddingProvider | None = None,
    *,
    force: bool = False,
    dry_run: bool = False,
    allow_offline_writes: bool = False,
) -> IngestionReport:
    """Embed every portfolio project into pgvector."""
    provider = provider or get_embedding_provider()
    report = IngestionReport()

    if (
        isinstance(provider, HashingEmbeddingProvider)
        and not dry_run
        and not allow_offline_writes
    ):
        raise RuntimeError(
            "Refusing to write offline hashing embeddings to the database. "
            "These vectors carry no semantic meaning and would silently "
            "degrade every Fit Score. Configure GEMINI_API_KEY, or pass "
            "--offline --allow-offline-writes if you are seeding a scratch "
            "environment on purpose."
        )

    projects = load_portfolio()
    logger.info("Loaded %d projects from the source of truth.", len(projects))

    stored_hashes: dict[str, str] = {}
    if not force and not dry_run:
        try:
            stored_hashes = repository.get_embedding_hashes()
        except Exception as exc:  # noqa: BLE001 - first run has no table data
            logger.warning("Could not read existing hashes (%s); embedding all.", exc)

    for project in projects:
        document = project.to_embedding_document()
        digest = content_hash(document, provider.name)

        if not force and stored_hashes.get(project.projectId) == digest:
            report.skipped.append(project.projectId)
            logger.info("· %s unchanged — skipped", project.projectId)
            continue

        if dry_run:
            report.embedded.append(project.projectId)
            logger.info(
                "· %s would embed (%d chars) with %s",
                project.projectId,
                len(document),
                provider.name,
            )
            continue

        try:
            vector = provider.embed(document)
            repository.upsert_project(project)
            repository.upsert_project_embedding(
                project_id=project.projectId,
                source_document=document,
                content_hash=digest,
                model=provider.name,
                embedding=vector,
            )
            report.embedded.append(project.projectId)
            logger.info("· %s embedded (%d dims)", project.projectId, len(vector))
        except Exception as exc:  # noqa: BLE001 - report per-project, keep going
            report.failed[project.projectId] = str(exc)
            logger.error("· %s FAILED: %s", project.projectId, exc)

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Embed the portfolio into pgvector.")
    parser.add_argument("--force", action="store_true", help="re-embed everything")
    parser.add_argument("--dry-run", action="store_true", help="no writes")
    parser.add_argument("--offline", action="store_true", help="hashing embedder")
    parser.add_argument(
        "--allow-offline-writes",
        action="store_true",
        help="permit writing non-semantic offline vectors (scratch only)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    try:
        report = run_ingestion(
            provider=get_embedding_provider(offline=args.offline),
            force=args.force,
            dry_run=args.dry_run,
            allow_offline_writes=args.allow_offline_writes,
        )
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        logger.error("Ingestion aborted: %s", exc)
        return 1

    logger.info("Ingestion complete: %s", report.summary())
    if report.failed:
        for project_id, error in report.failed.items():
            logger.error("  %s: %s", project_id, error)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
