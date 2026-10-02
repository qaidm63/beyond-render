"""Embedding maths, portfolio loading, and the Semantic Gatekeeper."""

from __future__ import annotations

import math

import pytest

from backend.agents import analyst
from backend.core.embeddings import (
    EmbeddingError,
    HashingEmbeddingProvider,
    cosine_similarity,
    l2_normalise,
    similarity_to_fit_score,
)
from backend.core.portfolio import content_hash, load_portfolio
from backend.core.schemas import PipelineStage
from backend.tests.conftest import make_job


class TestVectorMaths:
    def test_normalise_gives_unit_length(self):
        v = l2_normalise([3.0, 4.0])
        assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0)

    def test_normalise_rejects_zero_vector(self):
        with pytest.raises(EmbeddingError):
            l2_normalise([0.0, 0.0, 0.0])

    def test_cosine_identical(self):
        assert math.isclose(cosine_similarity([1.0, 0.0], [1.0, 0.0]), 1.0)

    def test_cosine_orthogonal(self):
        assert math.isclose(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0)

    def test_cosine_opposite(self):
        assert math.isclose(cosine_similarity([1.0, 0.0], [-1.0, 0.0]), -1.0)

    def test_cosine_dimension_mismatch_raises(self):
        with pytest.raises(ValueError):
            cosine_similarity([1.0], [1.0, 2.0])

    def test_fit_score_clamps_negative_to_zero(self):
        # An opposing vector is "no match", never a negative score.
        assert similarity_to_fit_score(-0.5) == 0.0

    def test_fit_score_scales(self):
        assert similarity_to_fit_score(1.0) == 100.0
        assert similarity_to_fit_score(0.871) == 87.1


class TestHashingProvider:
    def test_deterministic(self, provider):
        assert provider.embed("Revit BIM architect") == provider.embed(
            "Revit BIM architect"
        )

    def test_dimensions_match_schema(self, provider):
        # Must equal the vector(768) column width in schema.sql.
        assert len(provider.embed("architecture")) == 768

    def test_unit_length(self, provider):
        v = provider.embed("urban planning masterplan")
        assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0, rel_tol=1e-9)

    def test_rejects_empty(self, provider):
        with pytest.raises(EmbeddingError):
            provider.embed("   ")

    def test_lexical_overlap_scores_higher(self, provider):
        base = provider.embed("architect revit bim working drawings")
        near = provider.embed("architect revit bim construction drawings")
        far = provider.embed("pastry chef bakery sourdough")
        assert cosine_similarity(base, near) > cosine_similarity(base, far)


class TestPortfolioSourceOfTruth:
    def test_loads(self):
        assert len(load_portfolio()) == 4

    def test_ids_unique(self):
        ids = [p.projectId for p in load_portfolio()]
        assert len(ids) == len(set(ids))

    def test_every_project_has_a_decision_log(self):
        # Decision logs dominate match quality; an empty one is a silent
        # quality regression.
        for project in load_portfolio():
            assert len(project.decisionLog.challenge) > 40
            assert len(project.decisionLog.decision) > 40
            assert len(project.decisionLog.outcome) > 40

    def test_embedding_document_includes_decision_log(self):
        doc = load_portfolio()[0].to_embedding_document()
        assert "Challenge:" in doc and "Decision:" in doc and "Outcome:" in doc

    def test_content_hash_is_model_sensitive(self):
        # Switching embedding models must invalidate stored vectors.
        assert content_hash("doc", "model-a") != content_hash("doc", "model-b")

    def test_content_hash_stable(self):
        assert content_hash("doc", "m") == content_hash("doc", "m")


@pytest.fixture
def portfolio_vectors(provider):
    return {
        p.projectId: provider.embed(p.to_embedding_document())
        for p in load_portfolio()
    }


class TestGatekeeper:
    def test_scores_and_identifies_best_project(self, provider, portfolio_vectors):
        job = make_job(
            title="BIM Coordinator",
            description="Revit working drawings, clash detection, commercial complex",
        )
        score, best = analyst.score_against(job, portfolio_vectors, provider)
        assert 0.0 <= score <= 100.0
        assert best in portfolio_vectors

    def test_requires_ingested_vectors(self, provider):
        with pytest.raises(ValueError, match="run ingestion"):
            analyst.score_against(make_job(), {}, provider)

    def test_verdict_accepts_above_threshold(self):
        job = make_job()
        assert analyst.apply_verdict(job, 90.0, "grad-2050", 85) is True
        assert job.stage == PipelineStage.HIGH_MATCH
        assert job.rejectionReason is None

    def test_verdict_rejects_below_threshold(self):
        job = make_job()
        assert analyst.apply_verdict(job, 40.0, "grad-2050", 85) is False
        assert job.stage == PipelineStage.DISCOVERED
        assert "below threshold" in job.rejectionReason

    def test_boundary_is_inclusive(self):
        # threshold=85 must accept exactly 85.00.
        assert analyst.apply_verdict(make_job(), 85.0, None, 85) is True

    def test_gatekeep_partitions(self, provider, portfolio_vectors, config):
        config.matchingThreshold = 50
        jobs = [
            make_job(fingerprint="a", title="Architect", description="revit bim"),
            make_job(fingerprint="b", title="Chef", description="pastry"),
        ]
        result = analyst.gatekeep(
            jobs, config, provider=provider, portfolio_vectors=portfolio_vectors
        )
        assert len(result.accepted) + len(result.rejected) == 2
        assert not result.errored

    def test_one_bad_job_does_not_abort_the_gate(
        self, provider, portfolio_vectors, config
    ):
        jobs = [
            make_job(fingerprint="ok", title="Architect", description="revit"),
            make_job(fingerprint="bad", title="", description=""),
        ]
        result = analyst.gatekeep(
            jobs, config, provider=provider, portfolio_vectors=portfolio_vectors
        )
        assert len(result.accepted) + len(result.rejected) + len(result.errored) == 2
