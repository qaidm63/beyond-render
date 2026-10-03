"""
Portfolio Studio intelligence layer — asset measurement, provenance,
coverage gaps, fitness scoring, A/B framing and interrogation.

Entirely offline: embeddings use the deterministic hashing provider and
every model call is a fake.
"""

from __future__ import annotations

import asyncio
import base64
import json

import pytest

from backend.agents import interrogator, provenance, strategist
from backend.core import assets as assets_module
from backend.core.embeddings import HashingEmbeddingProvider
from backend.core.schemas import ProjectEvidence

# --------------------------------------------------------------- #
# Fixtures and helpers                                             #
# --------------------------------------------------------------- #


def _project(**overrides) -> ProjectEvidence:
    base = {
        "projectId": "p1",
        "identity": {
            "title": "Riverside Spine",
            "category": "Urban Planning",
            "status": "Concept",
            "scope": ["Masterplanning"],
            "tagline": "A flood-tolerant civic corridor.",
        },
        "decisionLog": {
            "challenge": "A floodplain conflicted with continuous frontage.",
            "decision": "Raise the spine on a stepped plinth.",
            "outcome": "Pedestrian continuity survives inundation.",
        },
        "evidenceLayer": {},
        "softwareStack": ["Rhino"],
    }
    base.update(overrides)
    return ProjectEvidence(**base)


def _data_url(mime: str, payload: bytes) -> str:
    return f"data:{mime};base64," + base64.b64encode(payload).decode()


def _png(width: int, height: int) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x06\x00\x00\x00"
    )


def _pdf(width: float, height: float, pages: int = 1, extra: bytes = b"") -> bytes:
    return (
        b"%PDF-1.7\n"
        b"1 0 obj << /Type /Pages /Count " + str(pages).encode() + b" >> endobj\n"
        b"2 0 obj << /Type /Page /MediaBox [0 0 "
        + f"{width} {height}".encode()
        + b"] >> endobj\n" + extra
    )


def _jobs(n: int, base_score: float = 80.0) -> list[dict]:
    return [
        {
            "id": f"job-{i}",
            "fingerprint": f"fp-{i}",
            "title": f"Architect {i}",
            "company": f"Studio {i}",
            "description": "Parametric facade optimisation and Revit delivery.",
            "fit_score": base_score + i,
        }
        for i in range(n)
    ]


class FakeLLM:
    def __init__(self, reply: str) -> None:
        self.name = "fake:test"
        self.online = True
        self.reply = reply
        self.calls = 0

    async def agenerate(self, prompt: str, *, system: str | None = None, **_k) -> str:
        self.calls += 1
        self.last_prompt = prompt
        self.last_system = system
        return self.reply


# =============================================================== #
# 6. Asset fact extraction                                         #
# =============================================================== #


def test_png_dimensions_are_read_from_the_header():
    facts = assets_module.inspect_asset(_data_url("image/png", _png(1920, 1080)))
    assert facts.kind == "image"
    assert (facts.pixelWidth, facts.pixelHeight) == (1920, 1080)
    assert facts.orientation == "landscape"


def test_portrait_image_is_detected():
    facts = assets_module.inspect_asset(_data_url("image/png", _png(800, 1200)))
    assert facts.orientation == "portrait"


def test_gif_dimensions_use_little_endian():
    gif = b"GIF89a" + (640).to_bytes(2, "little") + (480).to_bytes(2, "little")
    facts = assets_module.inspect_asset(_data_url("image/gif", gif))
    assert (facts.pixelWidth, facts.pixelHeight) == (640, 480)


def test_a1_landscape_sheet_is_classified():
    facts = assets_module.inspect_asset(
        _data_url("application/pdf", _pdf(2384, 1684, pages=3))
    )
    assert facts.kind == "pdf"
    assert facts.sheetSize == "A1"
    assert facts.orientation == "landscape"
    assert facts.pageCount == 3


def test_a3_sheet_is_classified_within_tolerance():
    """CAD exporters round trim edges; a few points must not break it."""
    facts = assets_module.inspect_asset(
        _data_url("application/pdf", _pdf(843.2, 1190.1))
    )
    assert facts.sheetSize == "A3"


def test_non_standard_sheet_reports_inches_not_a_wrong_label():
    facts = assets_module.inspect_asset(
        _data_url("application/pdf", _pdf(1000, 1000))
    )
    assert facts.sheetSize is None
    assert "in sheet" in facts.summary()


def test_pdf_producer_is_extracted():
    pdf = _pdf(595, 842, extra=b"3 0 obj << /Producer (Autodesk Revit 2024) >> endobj")
    facts = assets_module.inspect_asset(_data_url("application/pdf", pdf))
    assert facts.producer == "Autodesk Revit 2024"
    assert "Revit" in facts.summary()


def test_utf16_pdf_title_is_decoded():
    title = b"\xfe\xff" + "Plan".encode("utf-16-be")
    pdf = _pdf(595, 842, extra=b"3 0 obj << /Title (" + title + b") >> endobj")
    facts = assets_module.inspect_asset(_data_url("application/pdf", pdf))
    assert facts.title == "Plan"


def test_encrypted_pdf_is_flagged_rather_than_silently_partial():
    pdf = _pdf(595, 842, extra=b"trailer << /Encrypt 9 0 R >>")
    facts = assets_module.inspect_asset(_data_url("application/pdf", pdf))
    assert any("encrypted" in note for note in facts.notes)


def test_remote_urls_are_never_fetched_to_measure_them():
    """Server-side fetching of an operator URL is a forgery vector."""
    facts = assets_module.inspect_asset("https://example.com/plan.pdf")
    assert facts.kind == "unknown"
    assert facts.pageCount is None


def test_corrupt_payload_degrades_without_raising():
    facts = assets_module.inspect_asset(_data_url("image/png", b"\x89PNGbroken"))
    assert facts.notes


def test_describe_assets_caps_the_listing():
    many = [_data_url("image/png", _png(10, 10))] * 15
    described = assets_module.describe_assets(many, limit=5)
    assert described.count("- Asset") == 5
    assert "+10 further assets" in described


def test_describe_assets_is_empty_without_assets():
    assert assets_module.describe_assets([]) == ""


# =============================================================== #
# 5. Provenance guard                                              #
# =============================================================== #


def test_invented_certification_is_critical():
    project = _project(
        decisionLog={
            "challenge": "c",
            "decision": "The scheme achieved LEED Gold certification.",
            "outcome": "o",
        }
    )
    report = provenance.verify(project, {"title": "X"})
    assert not report.clean
    assert report.criticalCount == 1
    assert report.findings[0].kind == "certification"


def test_certification_the_operator_supplied_is_accepted():
    project = _project(
        decisionLog={
            "challenge": "c",
            "decision": "Targeted LEED Gold from concept stage.",
            "outcome": "o",
        }
    )
    report = provenance.verify(
        project, {"notes": "Client required LEED Gold certification."}
    )
    assert report.clean


def test_invented_award_is_critical():
    project = _project(recruiterPitch="Led an award-winning civic scheme.")
    report = provenance.verify(project, {"title": "X"})
    assert any(f.kind == "award" for f in report.findings)


def test_unsupported_area_is_a_warning_not_a_blocker():
    project = _project(
        decisionLog={"challenge": "A 4,200 m² site.", "decision": "d", "outcome": "o"}
    )
    report = provenance.verify(project, {"title": "X"})
    assert [f.severity for f in report.findings] == ["warning"]


def test_area_matches_across_unit_spellings():
    """'4,200 m²' in the draft must match '4200 sqm' in the brief."""
    project = _project(
        decisionLog={"challenge": "A 4,200 m² site.", "decision": "d", "outcome": "o"}
    )
    report = provenance.verify(project, {"area": "4200 sqm"})
    assert report.clean


def test_percentage_traced_to_the_brief_is_accepted():
    project = _project(
        decisionLog={
            "challenge": "c",
            "decision": "d",
            "outcome": "Cut cooling demand by 32 percent.",
        }
    )
    report = provenance.verify(project, {"notes": "Simulation showed a 32% cut."})
    assert report.clean


def test_storey_counts_are_not_flagged_as_fabrication():
    project = _project(
        decisionLog={"challenge": "A two storey annexe.", "decision": "d", "outcome": "o"}
    )
    report = provenance.verify(project, {"title": "X"})
    assert report.clean


def test_asset_observations_count_as_operator_evidence():
    """A figure read off a drawing is evidence, not an invention."""
    project = _project(
        decisionLog={"challenge": "An 850 m2 floorplate.", "decision": "d", "outcome": "o"}
    )
    report = provenance.verify(
        project, {"title": "X"}, observations="Plan annotated 850 m2 per floor."
    )
    assert report.clean


def test_the_same_claim_is_reported_once():
    project = _project(
        identity={
            "title": "T",
            "category": "Technical",
            "status": "Concept",
            "scope": [],
            "tagline": "LEED Platinum scheme.",
        },
        recruiterPitch="Delivered a LEED Platinum scheme.",
    )
    report = provenance.verify(project, {})
    assert len([f for f in report.findings if f.kind == "certification"]) == 1


def test_base64_assets_cannot_accidentally_support_a_figure():
    project = _project(
        decisionLog={"challenge": "A 4,200 m² site.", "decision": "d", "outcome": "o"}
    )
    report = provenance.verify(project, {"images": ["data:image/png;base64,NDIwMA=="]})
    assert not report.clean


def test_clean_project_reports_which_fields_were_checked():
    report = provenance.verify(_project(), {"title": "X"})
    assert report.clean
    assert "decisionLog.challenge" in report.checkedFields


def test_report_serialises_for_the_api():
    payload = provenance.verify(_project(recruiterPitch="Won the RIBA Award."), {}).to_dict()
    assert payload["criticalCount"] >= 1
    assert isinstance(payload["findings"], list)


# =============================================================== #
# 2. Fitness scoring                                               #
# =============================================================== #


@pytest.fixture(autouse=True)
def _clear_strategist_cache():
    strategist.clear_cache()
    yield
    strategist.clear_cache()


def test_fitness_scores_a_document_against_postings():
    report = strategist.score_document(
        "Parametric facade optimisation in Revit and Grasshopper.",
        _jobs(5),
        provider=HashingEmbeddingProvider(),
    )
    assert report.sampleSize == 5
    assert 0.0 <= report.medianScore <= 100.0
    assert report.bestScore >= report.medianScore


def test_fitness_reports_honestly_when_there_are_no_postings():
    """A score against zero jobs would be a fabricated number."""
    report = strategist.score_document("text", [], provider=HashingEmbeddingProvider())
    assert report.sampleSize == 0
    assert report.note and "sweep" in report.note.lower()


def test_fitness_refuses_an_empty_document():
    report = strategist.score_document("", _jobs(3), provider=HashingEmbeddingProvider())
    assert report.sampleSize == 0
    assert report.note


def test_fitness_reports_delta_against_the_current_score():
    report = strategist.score_document(
        "Revit delivery", _jobs(3), provider=HashingEmbeddingProvider()
    )
    assert all(match.delta is not None for match in report.biggestGains)


def test_unscored_jobs_do_not_produce_a_fake_delta():
    rows = [{"id": "a", "fingerprint": "a", "title": "T", "company": "C", "fit_score": None}]
    report = strategist.score_document("x", rows, provider=HashingEmbeddingProvider())
    assert report.topMatches[0].delta is None


def test_job_vectors_are_cached_between_calls():
    """Re-scoring a draft must not re-embed the whole corpus."""
    calls = {"n": 0}
    inner = HashingEmbeddingProvider()

    class Counting:
        name = "counting"
        dimensions = inner.dimensions

        def embed(self, text: str) -> list[float]:
            calls["n"] += 1
            return inner.embed(text)

    provider = Counting()
    jobs = _jobs(4)
    strategist.score_document("a", jobs, provider=provider)
    first = calls["n"]
    strategist.score_document("b", jobs, provider=provider)
    # Second pass embeds the document only, not the four postings again.
    assert calls["n"] == first + 1


def test_a_single_unembeddable_posting_does_not_abort_the_run():
    inner = HashingEmbeddingProvider()

    class Flaky:
        name = "flaky"

        def embed(self, text: str) -> list[float]:
            if "Studio 1" in text:
                raise RuntimeError("upstream down")
            return inner.embed(text)

    report = strategist.score_document("x", _jobs(3), provider=Flaky())
    assert report.sampleSize == 2


def test_scoring_a_project_uses_the_same_document_as_ingestion():
    project = _project()
    report = strategist.score_project(
        project, _jobs(3), provider=HashingEmbeddingProvider()
    )
    direct = strategist.score_document(
        project.to_embedding_document(), _jobs(3), provider=HashingEmbeddingProvider()
    )
    assert report.medianScore == direct.medianScore


# =============================================================== #
# Job sampling                                                     #
# =============================================================== #


def test_near_miss_sampling_excludes_passing_jobs():
    rows = _jobs(3, base_score=90.0) + _jobs(3, base_score=75.0)
    sample = strategist.sample_jobs(rows, 85.0, near_miss_only=True)
    assert all(float(r["fit_score"]) < 85.0 for r in sample)


def test_near_miss_sampling_excludes_distant_rejections():
    """A score of 20 means the wrong discipline, not a portfolio gap."""
    rows = [{"id": "a", "fingerprint": "a", "title": "T", "company": "C", "fit_score": 20.0}]
    assert strategist.sample_jobs(rows, 85.0, near_miss_only=True) == []


def test_unscored_jobs_survive_the_general_sample():
    rows = [{"id": "a", "fingerprint": "a", "title": "T", "company": "C", "fit_score": None}]
    assert len(strategist.sample_jobs(rows, 85.0)) == 1


def test_unscored_jobs_are_excluded_from_near_miss_analysis():
    rows = [{"id": "a", "fingerprint": "a", "title": "T", "company": "C", "fit_score": None}]
    assert strategist.sample_jobs(rows, 85.0, near_miss_only=True) == []


def test_sampling_is_bounded():
    sample = strategist.sample_jobs(_jobs(200, base_score=10.0), 85.0)
    assert len(sample) == strategist.MAX_JOBS_SAMPLED


def test_sampling_prefers_the_closest_misses():
    rows = _jobs(10, base_score=70.0)
    sample = strategist.sample_jobs(rows, 85.0, near_miss_only=True, limit=3)
    assert [r["fit_score"] for r in sample] == [79.0, 78.0, 77.0]


# =============================================================== #
# 1. Coverage gaps                                                 #
# =============================================================== #

GAP_REPLY = json.dumps(
    {
        "gaps": [
            {
                "capability": "Parametric facade optimisation",
                "demandCount": 9,
                "evidence": "Seven postings ask for Grasshopper facade studies.",
                "recommendedProject": "A facade study driven by solar gain.",
                "priority": "high",
            },
            {
                "capability": "Hospital departmental planning",
                "demandCount": 3,
                "evidence": "Three healthcare briefs.",
                "recommendedProject": "A day-surgery unit layout.",
                "priority": "medium",
            },
        ],
        "summary": "Facade computation is the costliest gap.",
    }
)


def test_coverage_requires_enough_near_misses_to_be_a_pattern():
    report = asyncio.run(
        strategist.coverage_gaps(_jobs(2, base_score=80.0), llm=FakeLLM(GAP_REPLY))
    )
    assert report.gaps == []
    assert report.note and "3" in report.note


def test_coverage_ranks_gaps_by_demand():
    report = asyncio.run(
        strategist.coverage_gaps(_jobs(8, base_score=70.0), llm=FakeLLM(GAP_REPLY))
    )
    assert [g.demandCount for g in report.gaps] == [9, 3]
    assert report.gaps[0].capability.startswith("Parametric")
    assert report.summary


def test_coverage_reports_the_score_range_it_analysed():
    report = asyncio.run(
        strategist.coverage_gaps(_jobs(8, base_score=70.0), llm=FakeLLM(GAP_REPLY))
    )
    assert report.scoreRange is not None
    assert report.scoreRange[0] <= report.scoreRange[1]


def test_coverage_prompt_carries_scores_and_rejection_notes():
    rows = _jobs(4, base_score=70.0)
    rows[0]["rejection_reason"] = "No facade computation evidence."
    prompt = strategist.build_gap_prompt(rows, 85.0)
    assert "Analyst note: No facade computation evidence." in prompt
    assert "scored 70" in prompt


def test_coverage_prompt_forbids_fabricated_experience():
    assert "fabricate" in strategist.GAP_SYSTEM.lower()


def test_coverage_drops_malformed_gap_entries():
    reply = json.dumps({"gaps": [{"capability": ""}, "junk", {"capability": "Real"}]})
    report = asyncio.run(
        strategist.coverage_gaps(_jobs(8, base_score=70.0), llm=FakeLLM(reply))
    )
    assert [g.capability for g in report.gaps] == ["Real"]


def test_coverage_normalises_an_invalid_priority():
    reply = json.dumps({"gaps": [{"capability": "X", "priority": "urgent"}]})
    report = asyncio.run(
        strategist.coverage_gaps(_jobs(8, base_score=70.0), llm=FakeLLM(reply))
    )
    assert report.gaps[0].priority == "medium"


def test_coverage_surfaces_an_unparseable_reply():
    with pytest.raises(strategist.StrategistError):
        asyncio.run(
            strategist.coverage_gaps(
                _jobs(8, base_score=70.0), llm=FakeLLM("no json here")
            )
        )


# =============================================================== #
# 3. A/B narrative framing                                         #
# =============================================================== #

VARIANT_REPLY = json.dumps(
    {
        "identity": {
            "title": "Riverside Spine",
            "category": "Urban Planning",
            "status": "Concept",
            "tagline": "A flood-tolerant corridor.",
            "scope": ["Masterplanning"],
        },
        "decisionLog": {
            "challenge": "A floodplain conflicted with frontage.",
            "decision": "Raise the spine on a plinth.",
            "outcome": "Continuity survives inundation.",
        },
        "spatialFramework": {
            "circulationStrategy": "Two-level separation.",
            "materialityAndAtmosphere": "Board-formed concrete.",
            "sustainabilityFramework": "Passive flood accommodation.",
        },
        "softwareStack": ["Rhino"],
        "recruiterPitch": "Restructured a civic corridor around hydrology.",
    }
)


def test_variants_are_scored_and_a_winner_is_named():
    comparison = asyncio.run(
        strategist.compare_variants(
            {"title": "Riverside"},
            project_id="riverside",
            jobs=_jobs(5),
            llm=FakeLLM(VARIANT_REPLY),
            provider=HashingEmbeddingProvider(),
        )
    )
    assert len(comparison.variants) == 2
    assert comparison.winner in {"computational", "urban"}
    assert {v.stance for v in comparison.variants} == {"computational", "urban"}


def test_identical_variants_are_reported_as_a_tie_not_a_winner():
    """A fake model returns the same text twice; claiming a winner would lie."""
    comparison = asyncio.run(
        strategist.compare_variants(
            {"title": "Riverside"},
            project_id="riverside",
            jobs=_jobs(5),
            llm=FakeLLM(VARIANT_REPLY),
            provider=HashingEmbeddingProvider(),
        )
    )
    assert comparison.margin == pytest.approx(0.0)
    assert comparison.note and "not meaningful" in comparison.note


def test_unknown_stance_is_rejected_before_any_model_call():
    llm = FakeLLM(VARIANT_REPLY)
    with pytest.raises(strategist.StrategistError, match="Unknown narrative stance"):
        asyncio.run(
            strategist.compare_variants(
                {"title": "X"},
                project_id="x",
                jobs=[],
                stances=["sarcastic"],
                llm=llm,
            )
        )
    assert llm.calls == 0


def test_stance_reaches_the_prompt_without_licensing_new_facts():
    from backend.agents.curator import build_prompt

    prompt = build_prompt(
        {"title": "X", "_stance": strategist.NARRATIVE_STANCES["computational"]}
    )
    assert "Narrative emphasis" in prompt
    assert "parametric method" in prompt
    assert "does not licence" in prompt


def test_both_variants_share_one_asset_reading():
    """Otherwise the comparison measures vision noise, not framing."""
    import backend.agents.curator as curator_module

    calls = {"n": 0}

    async def counting(*_a, **_k):
        calls["n"] += 1
        return "observed"

    original = curator_module.inspect_assets
    curator_module.inspect_assets = counting  # type: ignore[assignment]
    try:
        asyncio.run(
            strategist.compare_variants(
                {"title": "X"},
                project_id="x",
                jobs=_jobs(3),
                observations="a shared reading",
                llm=FakeLLM(VARIANT_REPLY),
                provider=HashingEmbeddingProvider(),
            )
        )
    finally:
        curator_module.inspect_assets = original  # type: ignore[assignment]
    assert calls["n"] == 0


def test_one_failing_variant_still_yields_a_result():
    class HalfBroken(FakeLLM):
        async def agenerate(self, prompt, *, system=None, **_k):
            self.calls += 1
            if "urban" in prompt or "public life" in prompt:
                raise RuntimeError("model down")
            return self.reply

    comparison = asyncio.run(
        strategist.compare_variants(
            {"title": "X"},
            project_id="x",
            jobs=_jobs(3),
            llm=HalfBroken(VARIANT_REPLY),
            provider=HashingEmbeddingProvider(),
        )
    )
    assert len(comparison.variants) == 1
    assert comparison.note and "nothing to compare" in comparison.note


# =============================================================== #
# 4. Evidence interrogator                                         #
# =============================================================== #

QUESTION_REPLY = json.dumps(
    {
        "questions": [
            {
                "id": "q1",
                "question": "Why is the core split across two shafts?",
                "rationale": "Establishes the structural trade-off.",
                "targets": "decision",
            },
            {
                "id": "q2",
                "question": "What drove the double-height threshold?",
                "rationale": "Explains the entry sequence.",
                "targets": "circulation",
            },
        ]
    }
)


def test_interrogator_returns_parsed_questions():
    questions, observations = asyncio.run(
        interrogator.interrogate({"title": "X"}, llm=FakeLLM(QUESTION_REPLY))
    )
    assert len(questions) == 2
    assert questions[0].targets == "decision"
    assert observations == ""


def test_interrogator_caps_the_question_count():
    reply = json.dumps(
        {"questions": [{"question": f"Q{i}?"} for i in range(20)]}
    )
    questions = interrogator.parse_questions(reply)
    assert len(questions) <= interrogator.MAX_QUESTIONS


def test_restated_questions_are_deduplicated():
    reply = json.dumps(
        {"questions": [{"question": "Why split the core?"}, {"question": "why split the core"}]}
    )
    assert len(interrogator.parse_questions(reply)) == 1


def test_invalid_target_falls_back_rather_than_dropping_the_question():
    reply = json.dumps({"questions": [{"question": "Why?", "targets": "vibes"}]})
    assert interrogator.parse_questions(reply)[0].targets == "decision"


def test_interrogator_failure_never_blocks_the_form():
    class Broken:
        name = "broken"

        async def agenerate(self, *_a, **_k):
            raise RuntimeError("down")

    questions, _ = asyncio.run(interrogator.interrogate({"title": "X"}, llm=Broken()))
    assert questions == []


def test_unparseable_interrogation_reply_returns_no_questions():
    questions, _ = asyncio.run(
        interrogator.interrogate({"title": "X"}, llm=FakeLLM("sorry, I cannot"))
    )
    assert questions == []


def test_interrogation_prompt_flags_a_thin_brief():
    prompt = interrogator.build_interrogation_prompt({"title": "X"})
    assert "thinnest" in prompt


def test_interrogation_prompt_includes_measured_facts():
    prompt = interrogator.build_interrogation_prompt(
        {"title": "X"}, measured="- Asset 1: 2-page PDF, A1 sheet"
    )
    assert "A1 sheet" in prompt


def test_interrogation_system_forbids_inviting_invented_metrics():
    lowered = interrogator.INTERROGATION_SYSTEM.lower()
    assert "invent a metric" in lowered
    assert "award" in lowered


def test_answers_are_folded_into_the_synthesis_brief():
    from backend.agents.curator import build_brief

    brief = build_brief(
        {
            "title": "X",
            "interrogation": [
                {"question": "Why split the core?", "answer": "Egress distance."}
            ],
        }
    )
    assert "Why split the core?" in brief
    assert "Egress distance." in brief


def test_unanswered_questions_do_not_pollute_the_brief():
    from backend.agents.curator import build_brief

    brief = build_brief(
        {"title": "X", "interrogation": [{"question": "Why?", "answer": "   "}]}
    )
    assert "Why?" not in brief


def test_measured_facts_reach_the_synthesis_prompt():
    from backend.agents.curator import build_prompt

    prompt = build_prompt({"title": "X"}, measured="- Asset 1: 3-page PDF, A1 sheet")
    assert "treat as fact" in prompt
    assert "A1 sheet" in prompt
