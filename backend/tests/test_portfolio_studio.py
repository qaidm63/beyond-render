"""
Portfolio Studio — synthesis, parsing and canonical-file persistence.

Offline throughout. The canonical file is never touched: every persistence
test writes to a tmp_path copy.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from backend.agents import curator
from backend.agents.curator import SynthesisError
from backend.core import portfolio as portfolio_module
from backend.core.portfolio import (
    save_project,
    slugify_project_id,
    unique_project_id,
)
from backend.core.schemas import ProjectCategory, ProjectEvidence, ProjectStatus

VALID_REPLY = json.dumps(
    {
        "identity": {
            "title": "Riverside Civic Spine",
            "category": "Urban Planning",
            "status": "Concept",
            "tagline": "A flood-tolerant civic corridor built from the hydrology up.",
            "scope": ["Masterplanning", "Public realm", "Flood strategy"],
        },
        "decisionLog": {
            "challenge": "A seasonal floodplain conflicted with the demand for "
            "continuous pedestrian frontage.",
            "decision": "Raise the civic spine on a stepped plinth and let the "
            "lower terrace flood by design rather than defending it.",
            "outcome": "Pedestrian continuity survives inundation; the lower "
            "terrace returns to use once the water recedes.",
        },
        "spatialFramework": {
            "circulationStrategy": "Two-level separation of civic and service flow.",
            "materialityAndAtmosphere": "Board-formed concrete against planted terraces.",
            "sustainabilityFramework": "Passive flood accommodation before pumped defence.",
        },
        "softwareStack": ["Rhino", "Civil 3D"],
        "recruiterPitch": "Led the hydrological restructuring of a civic corridor. "
        "Converted a flood liability into the organising logic of the scheme.",
    }
)


class FakeLLM:
    def __init__(self, reply: str) -> None:
        self.name = "fake:test"
        self.online = True
        self.reply = reply
        self.prompts: list[str] = []
        self.systems: list[str | None] = []

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        self.prompts.append(prompt)
        self.systems.append(system)
        return self.reply

    async def agenerate(self, prompt: str, *, system: str | None = None, **_kw) -> str:
        return self.generate(prompt, system=system)


# ---------------------------------------------------------------- #
# Project ids                                                       #
# ---------------------------------------------------------------- #


def test_slug_is_url_safe():
    assert slugify_project_id("Riverside Civic Spine & Market") == (
        "riverside-civic-spine-market"
    )


def test_slug_falls_back_to_digest_for_non_latin_titles():
    """Percent-encoded Arabic in a primary key and a URL helps nobody."""
    slug = slugify_project_id("مشروع فيلا سكنية")
    assert slug.startswith("project-")
    assert slug.isascii()


def test_unique_id_avoids_collisions():
    assert unique_project_id("Villa", {"villa"}) == "villa-2"
    assert unique_project_id("Villa", {"villa", "villa-2"}) == "villa-3"


# ---------------------------------------------------------------- #
# Prompt construction                                               #
# ---------------------------------------------------------------- #


def test_brief_includes_supplied_metadata():
    brief = curator.build_brief(
        {"title": "Villa A", "softwareStack": ["Revit", "Lumion"], "area": "450 m2"}
    )
    assert "Villa A" in brief
    assert "Revit, Lumion" in brief
    assert "450 m2" in brief


def test_brief_omits_empty_fields():
    brief = curator.build_brief({"title": "Villa A", "notes": "   ", "area": None})
    assert "Additional notes" not in brief
    assert "Area" not in brief


def test_brief_handles_no_metadata():
    assert curator.build_brief({}) == "No metadata supplied."


def test_prompt_states_when_no_assets_were_supplied():
    prompt = curator.build_prompt({"title": "X"}, observations="")
    assert "None supplied" in prompt


def test_prompt_includes_asset_observations():
    prompt = curator.build_prompt({"title": "X"}, observations="A section drawing.")
    assert "A section drawing." in prompt


def test_system_prompt_bans_marketing_language():
    for banned in ("breathtaking", "amazing", "world-class"):
        assert banned in curator.SYNTHESIS_SYSTEM
    assert "BANNED" in curator.SYNTHESIS_SYSTEM


def test_system_prompt_forbids_fabrication():
    lowered = curator.SYNTHESIS_SYSTEM.lower()
    assert "may not invent" in lowered
    assert "certifications" in lowered


# ---------------------------------------------------------------- #
# Parsing                                                           #
# ---------------------------------------------------------------- #


def test_parse_accepts_plain_json():
    parsed = curator.parse_synthesis(VALID_REPLY)
    assert parsed["identity"]["title"] == "Riverside Civic Spine"


def test_parse_strips_code_fences():
    parsed = curator.parse_synthesis(f"```json\n{VALID_REPLY}\n```")
    assert parsed["identity"]["title"] == "Riverside Civic Spine"


def test_parse_rejects_prose():
    with pytest.raises(SynthesisError, match="did not return JSON"):
        curator.parse_synthesis("I cannot help with that.")


def test_parse_rejects_invalid_json():
    with pytest.raises(SynthesisError, match="invalid JSON"):
        curator.parse_synthesis('{"identity": }')


def test_parse_rejects_empty_reply():
    with pytest.raises(SynthesisError):
        curator.parse_synthesis("   ")


# ---------------------------------------------------------------- #
# Mapping to the schema                                             #
# ---------------------------------------------------------------- #


def test_to_project_populates_every_blueprint_field():
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    assert project.projectId == "riverside"
    assert project.identity.tagline
    assert project.identity.category == ProjectCategory.URBAN_PLANNING
    assert project.identity.status == ProjectStatus.CONCEPT
    assert project.spatialFramework.is_populated()
    assert project.recruiterPitch
    assert project.decisionLog.challenge


def test_operator_metadata_overrides_the_model():
    """The operator stated these facts; the model does not get to reinterpret."""
    project = curator.to_project(
        json.loads(VALID_REPLY),
        project_id="x",
        payload={"category": "Residential", "status": "Completed"},
    )
    assert project.identity.category == ProjectCategory.RESIDENTIAL
    assert project.identity.status == ProjectStatus.COMPLETED


def test_unknown_category_falls_back_without_raising():
    reply = json.loads(VALID_REPLY)
    reply["identity"]["category"] = "Interplanetary"
    project = curator.to_project(reply, project_id="x", payload={})
    assert project.identity.category == ProjectCategory.TECHNICAL


def test_software_stack_accepts_a_comma_string():
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="x", payload={"softwareStack": "Revit, Rhino"}
    )
    assert project.softwareStack == ["Revit", "Rhino"]


def test_assets_are_carried_into_the_evidence_layer():
    project = curator.to_project(
        json.loads(VALID_REPLY),
        project_id="x",
        payload={"images": ["a.jpg"], "technicalDrawings": ["plan.pdf"]},
    )
    assert project.evidenceLayer.images == ["a.jpg"]
    assert project.evidenceLayer.technicalDrawings == ["plan.pdf"]


# ---------------------------------------------------------------- #
# Embedding document                                                #
# ---------------------------------------------------------------- #


def test_new_fields_reach_the_embedding_document():
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="x", payload={}
    )
    document = project.to_embedding_document()
    assert "Tagline:" in document
    assert "Circulation:" in document
    assert "Positioning:" in document


def test_legacy_projects_still_embed():
    """The four pre-existing projects have none of the new fields."""
    legacy = ProjectEvidence(
        projectId="legacy",
        identity={"title": "T", "category": "Technical", "status": "Completed"},
        decisionLog={"challenge": "c", "decision": "d", "outcome": "o"},
        evidenceLayer={},
    )
    document = legacy.to_embedding_document()
    assert "Tagline:" not in document
    assert "Challenge: c" in document


def test_changing_spatial_text_changes_the_content_hash():
    """A changed document must force a re-embed, not be silently skipped."""
    from backend.core.portfolio import content_hash

    base = curator.to_project(json.loads(VALID_REPLY), project_id="x", payload={})
    first = content_hash(base.to_embedding_document(), "m")

    reply = json.loads(VALID_REPLY)
    reply["spatialFramework"]["circulationStrategy"] = "Single-level shared surface."
    changed = curator.to_project(reply, project_id="x", payload={})
    second = content_hash(changed.to_embedding_document(), "m")

    assert first != second


# ---------------------------------------------------------------- #
# Canonical file persistence                                        #
# ---------------------------------------------------------------- #


@pytest.fixture
def portfolio_file(tmp_path, monkeypatch):
    """An isolated copy of the canonical file."""
    source = json.loads(
        portfolio_module.PORTFOLIO_PATH.read_text(encoding="utf-8")
    )
    target = tmp_path / "portfolio_evidence.json"
    target.write_text(json.dumps(source, ensure_ascii=False, indent=2), "utf-8")
    monkeypatch.setattr(portfolio_module, "PORTFOLIO_PATH", target)
    portfolio_module.invalidate_cache()
    yield target
    portfolio_module.invalidate_cache()


def _read(path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_save_appends_a_new_project(portfolio_file):
    before = len(_read(portfolio_file)["projects"])
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    assert save_project(project, portfolio_file) is True
    assert len(_read(portfolio_file)["projects"]) == before + 1


def test_save_updates_an_existing_project_in_place(portfolio_file):
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    save_project(project, portfolio_file)
    before = len(_read(portfolio_file)["projects"])

    project.identity.title = "Renamed"
    assert save_project(project, portfolio_file) is False

    data = _read(portfolio_file)["projects"]
    assert len(data) == before
    match = next(p for p in data if p["projectId"] == "riverside")
    assert match["identity"]["title"] == "Renamed"


def test_saved_file_stays_valid_json_and_reparses(portfolio_file):
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    save_project(project, portfolio_file)

    # The whole file must still hydrate through the normal loader.
    reloaded = [
        ProjectEvidence(**{**entry, "evidenceLayer": entry.get("evidenceLayer", {})})
        for entry in _read(portfolio_file)["projects"]
    ]
    assert any(p.projectId == "riverside" for p in reloaded)


def test_save_preserves_file_metadata(portfolio_file):
    """`version` and `$comment` must survive a write."""
    original = _read(portfolio_file)
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    save_project(project, portfolio_file)
    after = _read(portfolio_file)
    assert after.get("version") == original.get("version")
    assert after.get("$comment") == original.get("$comment")


def test_save_preserves_arabic_text_unescaped(portfolio_file):
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="arabic-test", payload={}
    )
    project.identity.tagline = "مشروع سكني"
    save_project(project, portfolio_file)
    assert "مشروع سكني" in portfolio_file.read_text(encoding="utf-8")


def test_save_leaves_no_temp_file_behind(portfolio_file):
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    save_project(project, portfolio_file)
    assert list(portfolio_file.parent.glob("*.tmp")) == []


def test_delete_removes_only_the_target(portfolio_file):
    project = curator.to_project(
        json.loads(VALID_REPLY), project_id="riverside", payload={}
    )
    save_project(project, portfolio_file)
    before = len(_read(portfolio_file)["projects"])

    assert portfolio_module.delete_project("riverside", portfolio_file) is True
    after = _read(portfolio_file)["projects"]
    assert len(after) == before - 1
    assert all(p["projectId"] != "riverside" for p in after)


def test_delete_missing_project_is_a_no_op(portfolio_file):
    assert portfolio_module.delete_project("nope", portfolio_file) is False


# ---------------------------------------------------------------- #
# Orchestration                                                     #
# ---------------------------------------------------------------- #


def test_synthesise_returns_a_validated_project():
    llm = FakeLLM(VALID_REPLY)
    project, observations = asyncio.run(
        curator.synthesise({"title": "Riverside"}, project_id="riverside", llm=llm)
    )
    assert project.projectId == "riverside"
    assert observations == ""
    assert llm.systems[0] == curator.SYNTHESIS_SYSTEM


def test_synthesise_propagates_a_bad_reply():
    with pytest.raises(SynthesisError):
        asyncio.run(
            curator.synthesise(
                {"title": "X"}, project_id="x", llm=FakeLLM("not json at all")
            )
        )


def test_asset_inspection_is_skipped_without_assets():
    assert asyncio.run(curator.inspect_assets([], llm=FakeLLM("x"))) == ""


def test_asset_inspection_failure_does_not_block_synthesis():
    """Losing image analysis degrades the draft; it must not prevent one."""

    class Broken:
        name = "broken"
        online = True

        async def agenerate(self, *_a, **_k):
            raise RuntimeError("vision down")

    assert asyncio.run(curator.inspect_assets(["a.png"], llm=Broken())) == ""


# ---------------------------------------------------------------- #
# Model routing                                                     #
# ---------------------------------------------------------------- #


def test_curator_role_uses_the_largest_catalogue_model():
    """A case study is written once and read for years — not a job for 2B."""
    from backend.core.llm import ROLE_MODELS

    assert ROLE_MODELS["curator"] == "DeepSeek-V4-Flash-0731"
    assert ROLE_MODELS["curator"] != ROLE_MODELS["analyst"]


def test_curator_gets_enough_tokens_for_a_whole_case_study():
    """1024 tokens truncates the JSON mid-object and the parse fails."""
    from backend.core.llm import ROLE_MAX_TOKENS

    assert ROLE_MAX_TOKENS["curator"] >= 4096
    assert ROLE_MAX_TOKENS["curator"] > ROLE_MAX_TOKENS["tailor"]


def test_curator_runs_colder_than_the_tailor():
    from backend.core.llm import ROLE_TEMPERATURE

    assert ROLE_TEMPERATURE["curator"] < 0.4


def test_unknown_role_still_resolves(monkeypatch):
    from backend.core import llm as llm_module

    monkeypatch.setattr(llm_module, "get_secret", lambda *a, **k: None)
    monkeypatch.setattr("backend.core.amd.available", lambda: False)
    provider = llm_module.get_llm_provider(role="nonsense")
    assert provider.name == "template:offline"


def test_amd_curator_provider_carries_the_larger_budget(monkeypatch):
    from backend.core import llm as llm_module

    monkeypatch.setattr("backend.core.amd.available", lambda: True)
    provider = llm_module.get_llm_provider(role="curator")
    assert provider.model == "DeepSeek-V4-Flash-0731"
    assert provider._max_tokens >= 4096


def test_vision_provider_is_not_the_text_only_dom_model(monkeypatch):
    """
    AMD_MODEL_VISION is text-only and belongs to the DOM engine. Reusing it
    for renderings would return confident descriptions of nothing.
    """
    from backend.core import llm as llm_module

    monkeypatch.setattr(
        llm_module, "get_secret", lambda name, *a, **k: "key" if name == "GEMINI_API_KEY" else None
    )
    provider = llm_module.get_vision_provider()
    assert provider is not None
    assert "gemini" in provider.name
    assert "Qwen" not in provider.name


def test_vision_provider_returns_none_when_nothing_multimodal_exists(monkeypatch):
    from backend.core import llm as llm_module

    monkeypatch.setattr(llm_module, "get_secret", lambda *a, **k: None)
    monkeypatch.setattr("backend.core.amd.available", lambda: False)
    assert llm_module.get_vision_provider() is None


def test_offline_mode_has_no_vision_provider():
    from backend.core.llm import get_vision_provider

    assert get_vision_provider(offline=True) is None


def test_inspection_is_skipped_when_no_vision_provider(monkeypatch):
    """Missing vision must degrade the draft, never abort it."""
    monkeypatch.setattr(curator, "get_vision_provider", lambda: None)
    assert asyncio.run(curator.inspect_assets(["data:image/png;base64,AAA"])) == ""


# ---------------------------------------------------------------- #
# Multimodal payload construction                                   #
# ---------------------------------------------------------------- #


def test_data_urls_become_gemini_inline_parts():
    from backend.core.llm import _as_inline_data

    part = _as_inline_data("data:image/png;base64,QUJD")
    assert part == {"mimeType": "image/png", "data": "QUJD"}


def test_remote_urls_are_not_fetched_server_side():
    """Fetching an operator-supplied URL server-side is a forgery vector."""
    from backend.core.llm import _as_inline_data

    assert _as_inline_data("https://example.com/plan.png") is None


def test_non_base64_data_urls_are_rejected():
    from backend.core.llm import _as_inline_data

    assert _as_inline_data("data:text/plain,hello") is None
