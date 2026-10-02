"""Scout normalisation — the most failure-prone surface in the backend."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.agents.scout.normalise import (
    clean_text,
    dedupe,
    detect_remote,
    fingerprint,
    from_jobspy_row,
    matches_configuration,
    slugify,
)
from backend.core.config import ContractType, SearchConfiguration, WorkModel
from backend.core.schemas import ScoutEngine
from backend.tests.conftest import make_job


class TestSlugify:
    def test_basic(self):
        assert slugify("Acme Architects") == "acme-architects"

    def test_punctuation_collapses(self):
        assert slugify("Foster + Partners, Ltd.") == "foster-partners-ltd"

    def test_unicode_folds_to_ascii(self):
        # Must collide deliberately: one company, one VIP page.
        assert slugify("Böhm Architekten") == slugify("Bohm Architekten")

    def test_arabic_falls_back_rather_than_emitting_empty(self):
        assert slugify("مكتب الحذيفي") == "unknown"

    def test_empty(self):
        assert slugify("") == "unknown"


class TestCleanText:
    def test_strips_html(self):
        assert clean_text("<p>Hello <b>world</b></p>") == "Hello world"

    def test_collapses_whitespace(self):
        assert clean_text("a\n\n  b\t c") == "a b c"

    def test_pandas_nan_string_is_none(self):
        # jobspy returns a DataFrame; missing cells stringify to 'nan'.
        assert clean_text("nan") is None

    def test_none(self):
        assert clean_text(None) is None

    def test_truncates(self):
        assert len(clean_text("x" * 100, limit=10)) == 10


class TestFingerprint:
    def test_stable_across_calls(self):
        a = fingerprint("indeed", "https://x.com/1", "Architect", "Acme")
        b = fingerprint("indeed", "https://x.com/1", "Architect", "Acme")
        assert a == b

    def test_url_case_insensitive(self):
        a = fingerprint("indeed", "https://X.com/1", "Architect", "Acme")
        b = fingerprint("indeed", "https://x.com/1", "Architect", "Acme")
        assert a == b

    def test_same_job_across_engines_collides(self):
        # The point of URL-based identity: LinkedIn via DOM and via an
        # aggregator must not create two rows.
        assert fingerprint("linkedin", "https://x.com/1", "A", "B") == fingerprint(
            "indeed", "https://x.com/1", "A", "B"
        )

    def test_distinct_urls_differ(self):
        assert fingerprint("indeed", "https://x.com/1", "A", "B") != fingerprint(
            "indeed", "https://x.com/2", "A", "B"
        )

    def test_missing_url_falls_back_without_collapsing(self):
        a = fingerprint("indeed", "", "Architect", "Acme")
        b = fingerprint("indeed", "", "Engineer", "Acme")
        assert a != b


class TestDetectRemote:
    @pytest.mark.parametrize("text", ["Remote", "Work from home", "Anywhere"])
    def test_positive(self, text):
        assert detect_remote(text, None) is True

    def test_negative(self):
        assert detect_remote("Dubai, UAE", "On-site role") is False

    def test_no_signal(self):
        assert detect_remote(None, None) is None


class TestDedupe:
    def test_keeps_richest_description(self):
        short = make_job(fingerprint="same", description="short")
        long = make_job(fingerprint="same", description="a much longer description")
        result = dedupe([short, long])
        assert len(result) == 1
        assert result[0].description == "a much longer description"

    def test_tie_breaks_to_xhr(self):
        dom = make_job(fingerprint="same", engine=ScoutEngine.DOM, description=None)
        xhr = make_job(fingerprint="same", engine=ScoutEngine.XHR, description=None)
        assert dedupe([dom, xhr])[0].engine == ScoutEngine.XHR

    def test_distinct_preserved(self):
        assert len(dedupe([make_job(fingerprint="a"), make_job(fingerprint="b")])) == 2

    def test_empty(self):
        assert dedupe([]) == []


class TestMatchesConfiguration:
    def test_permissive_by_default(self, config):
        assert matches_configuration(make_job(location=None), config) is True

    def test_missing_signal_is_kept(self, config):
        # Absence of evidence must not reject — the gatekeeper decides.
        job = make_job(location=None, contractType=None, isRemote=None)
        assert matches_configuration(job, config) is True

    def test_remote_only_drops_known_onsite(self):
        cfg = SearchConfiguration(
            workModel=WorkModel(remoteWorldwide=True, onSite=False, hybrid=False),
            targetLocations=["Remote"],
        )
        job = make_job(location="Tokyo, Japan", isRemote=False)
        assert matches_configuration(job, cfg) is False

    def test_remote_only_keeps_remote(self):
        cfg = SearchConfiguration(
            workModel=WorkModel(remoteWorldwide=True, onSite=False, hybrid=False),
            targetLocations=["Remote"],
        )
        assert matches_configuration(make_job(isRemote=True), cfg) is True

    def test_freelance_excluded_when_disabled(self, config):
        job = make_job(contractType="freelance")
        assert matches_configuration(job, config) is False

    def test_fulltime_allowed(self, config):
        assert matches_configuration(make_job(contractType="fulltime"), config) is True

    def test_all_work_models_off_rejects_everything(self):
        cfg = SearchConfiguration(
            workModel=WorkModel(remoteWorldwide=False, onSite=False, hybrid=False)
        )
        assert matches_configuration(make_job(), cfg) is False

    def test_location_whitelist_onsite(self):
        cfg = SearchConfiguration(
            workModel=WorkModel(remoteWorldwide=False, onSite=True, hybrid=False),
            targetLocations=["United Arab Emirates"],
        )
        assert matches_configuration(make_job(location="Dubai, Japan"), cfg) is False
        assert (
            matches_configuration(make_job(location="United Arab Emirates"), cfg)
            is True
        )


class TestFromJobspyRow:
    def _row(self, **over):
        row = {
            "title": "Senior Architect",
            "company": "Zaha Hadid Architects",
            "job_url": "https://example.com/jobs/42",
            "site": "indeed",
            "location": "Dubai, UAE",
            "description": "<p>Revit and BIM coordination</p>",
            "job_type": "fulltime",
            "is_remote": False,
            "date_posted": "2026-09-01",
        }
        row.update(over)
        return row

    def test_happy_path(self):
        job = from_jobspy_row(self._row())
        assert job is not None
        assert job.title == "Senior Architect"
        assert job.companyId == "zaha-hadid-architects"
        assert job.engine == ScoutEngine.XHR
        assert job.description == "Revit and BIM coordination"
        assert job.isRemote is False
        assert job.postedAt == datetime(2026, 9, 1, tzinfo=timezone.utc)

    @pytest.mark.parametrize("field", ["title", "company", "job_url"])
    def test_rejects_incomplete_rows(self, field):
        # A half-formed record must never enter the pipeline.
        assert from_jobspy_row(self._row(**{field: None})) is None

    def test_handles_nan_strings(self):
        job = from_jobspy_row(self._row(description="nan", location="nan"))
        assert job is not None
        assert job.description is None
        assert job.location is None

    def test_bad_date_does_not_crash(self):
        assert from_jobspy_row(self._row(date_posted="not-a-date")).postedAt is None
