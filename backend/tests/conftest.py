"""Shared fixtures. Everything here runs offline — no network, no database."""

from __future__ import annotations

import pytest

from backend.core.config import ContractType, SearchConfiguration, WorkModel
from backend.core.embeddings import HashingEmbeddingProvider
from backend.core.schemas import JobOpportunity, ScoutEngine


@pytest.fixture
def provider() -> HashingEmbeddingProvider:
    return HashingEmbeddingProvider()


@pytest.fixture
def config() -> SearchConfiguration:
    return SearchConfiguration(
        workModel=WorkModel(remoteWorldwide=True, onSite=True, hybrid=True),
        targetLocations=["United Arab Emirates", "Remote"],
        contractType=ContractType(fullTime=True, projectBased=True, freelance=False),
        matchingThreshold=85,
    )


def make_job(**overrides) -> JobOpportunity:
    base = dict(
        fingerprint="fp-" + overrides.get("title", "x"),
        title="Architect",
        company="Acme Architects",
        companyId="acme-architects",
        url="https://example.com/jobs/1",
        source="indeed",
        engine=ScoutEngine.XHR,
    )
    base.update(overrides)
    return JobOpportunity(**base)
