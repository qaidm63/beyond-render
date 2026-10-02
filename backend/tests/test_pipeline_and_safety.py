"""
Sweep orchestration, resilience, and the blueprint's hard safety rules.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from backend.agents.scout import dom_engine, router
from backend.core.embeddings import HashingEmbeddingProvider
from backend.core.schemas import ScoutEngine
from backend.core.secrets import MissingSecretError, load_browser_cookies
from backend.ingest import run_ingestion
from backend.tests.conftest import make_job


class TestEngineRouting:
    def test_open_gateways_use_layer_one(self):
        for source in ("indeed", "glassdoor", "greenhouse", "lever"):
            assert router.engine_for(source) == ScoutEngine.XHR

    def test_protected_platform_uses_layer_two(self):
        assert router.engine_for("linkedin") == ScoutEngine.DOM

    def test_unknown_source_defaults_to_cheapest_layer(self):
        assert router.engine_for("some-new-board") == ScoutEngine.XHR

    def test_case_insensitive(self):
        assert router.engine_for("LinkedIn") == ScoutEngine.DOM


class TestSweepResilience:
    """A dead layer must degrade coverage, never abort the sweep."""

    def test_xhr_failure_is_contained(self, monkeypatch, config):
        async def boom(*_a, **_k):
            raise RuntimeError("gateway down")

        monkeypatch.setattr(router.xhr_engine, "fetch", boom)
        monkeypatch.setattr(router.dom_engine, "session_ready", lambda: False)

        result = asyncio.run(router.run(config, ["Architect"]))
        assert result.jobs == []
        assert any("XHR layer failed" in w for w in result.warnings)

    def test_missing_operator_session_skips_layer_two_gracefully(
        self, monkeypatch, config
    ):
        async def ok(*_a, **_k):
            return [make_job(fingerprint="a")]

        monkeypatch.setattr(router.xhr_engine, "fetch", ok)
        monkeypatch.setattr(router.dom_engine, "session_ready", lambda: False)

        result = asyncio.run(router.run(config, ["Architect"]))
        assert len(result.jobs) == 1
        assert result.engine_counts["dom"] == 0
        assert any("no operator browser session" in w for w in result.warnings)

    def test_expired_session_surfaces_operator_action(self, monkeypatch, config):
        async def ok(*_a, **_k):
            return []

        async def expired(*_a, **_k):
            raise dom_engine.SessionExpiredError("cookies expired")

        monkeypatch.setattr(router.xhr_engine, "fetch", ok)
        monkeypatch.setattr(router.dom_engine, "session_ready", lambda: True)
        monkeypatch.setattr(router.dom_engine, "fetch", expired)

        result = asyncio.run(router.run(config, ["Architect"]))
        assert any("OPERATOR ACTION REQUIRED" in w for w in result.warnings)

    def test_sweep_dedupes_and_prefilters(self, monkeypatch, config):
        async def noisy(*_a, **_k):
            return [
                make_job(fingerprint="dup", description="short"),
                make_job(fingerprint="dup", description="a longer description here"),
                make_job(fingerprint="freelance-job", contractType="freelance"),
            ]

        monkeypatch.setattr(router.xhr_engine, "fetch", noisy)
        monkeypatch.setattr(router.dom_engine, "session_ready", lambda: False)

        result = asyncio.run(router.run(config, ["Architect"]))
        assert result.raw_count == 3
        assert result.deduped_count == 2
        # freelance is disabled in the fixture config
        assert result.prefiltered_count == 1
        assert len(result.jobs) == 1


class TestIngestionSafety:
    def test_refuses_to_persist_offline_vectors(self):
        """
        Offline hashing vectors carry no semantic meaning. Writing them would
        silently corrupt every future Fit Score, so ingestion must refuse.
        """
        with pytest.raises(RuntimeError, match="Refusing to write offline"):
            run_ingestion(provider=HashingEmbeddingProvider(), dry_run=False)

    def test_dry_run_is_allowed_offline(self):
        report = run_ingestion(provider=HashingEmbeddingProvider(), dry_run=True)
        assert len(report.embedded) == 4
        assert report.ok

    def test_explicit_override_is_possible(self, monkeypatch):
        # Escape hatch exists, but must be opt-in.
        written = []
        monkeypatch.setattr(
            "backend.ingest.repository.upsert_project", lambda p: written.append(p)
        )
        monkeypatch.setattr(
            "backend.ingest.repository.upsert_project_embedding",
            lambda **_k: None,
        )
        monkeypatch.setattr(
            "backend.ingest.repository.get_embedding_hashes", dict
        )
        report = run_ingestion(
            provider=HashingEmbeddingProvider(), allow_offline_writes=True
        )
        assert report.ok
        assert len(written) == 4


class TestCredentialPolicy:
    """
    Blueprint closing note: no 2FA bypass, no fabricated keys, sessions are
    supplied manually. These tests pin that policy in place.
    """

    def test_missing_cookie_file_fails_loudly(self, tmp_path):
        with pytest.raises(MissingSecretError, match="Export cookies manually"):
            load_browser_cookies(tmp_path / "absent.json")

    def test_malformed_cookie_file_fails_loudly(self, tmp_path):
        path = tmp_path / "cookies.json"
        path.write_text("{not json", encoding="utf-8")
        with pytest.raises(MissingSecretError, match="not valid JSON"):
            load_browser_cookies(path)

    def test_accepts_plain_cookie_array(self, tmp_path):
        path = tmp_path / "cookies.json"
        path.write_text(json.dumps([{"name": "li_at", "value": "x"}]), encoding="utf-8")
        assert load_browser_cookies(path)[0]["name"] == "li_at"

    def test_accepts_playwright_storage_state(self, tmp_path):
        path = tmp_path / "cookies.json"
        path.write_text(
            json.dumps({"cookies": [{"name": "li_at", "value": "x"}], "origins": []}),
            encoding="utf-8",
        )
        assert load_browser_cookies(path)[0]["name"] == "li_at"

    def test_dom_engine_never_exposes_a_login_helper(self):
        """There must be no automated authentication path, by design."""
        forbidden = {"login", "authenticate", "sign_in", "solve_2fa", "bypass"}
        assert forbidden.isdisjoint(dir(dom_engine))

    def test_cookie_normalisation_handles_extension_exports(self):
        raw = [
            {
                "name": "li_at",
                "value": "v",
                "domain": ".linkedin.com",
                "sameSite": "no_restriction",
                "expirationDate": 1800000000.5,
            },
            {"name": None, "value": "dropped"},
        ]
        cleaned = dom_engine._normalise_cookies(raw)
        assert len(cleaned) == 1
        assert cleaned[0]["sameSite"] == "None"
        assert cleaned[0]["expires"] == 1800000000.5
