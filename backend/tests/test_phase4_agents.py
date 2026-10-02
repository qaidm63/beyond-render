"""
Phase 4 — Tailor Agent, Ops gateway, Scheduler.

Everything here is offline. Network-touching providers are replaced with fakes
or monkeypatched transports, so the suite asserts on *our* logic rather than on
Gemini's or Telegram's availability.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from backend import pipeline, scheduler
from backend.agents import analyst, ops, tailor
from backend.core import llm as llm_module
from backend.core.embeddings import HashingEmbeddingProvider
from backend.core.llm import (
    GeminiLLMProvider,
    LLMError,
    TemplateLLMProvider,
    get_llm_provider,
)
from backend.core.portfolio import load_portfolio
from backend.core.schemas import PipelineStage
from backend.tests.conftest import make_job


class FakeLLM:
    """Records what it was asked, returns a fixed letter."""

    def __init__(self, reply: str = "Dear hiring team, I am a good fit.") -> None:
        self.name = "fake:test"
        self.online = True
        self.reply = reply
        self.prompts: list[str] = []
        self.systems: list[str | None] = []

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        self.prompts.append(prompt)
        self.systems.append(system)
        return self.reply


class ExplodingLLM:
    name = "exploding:test"
    online = True

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        raise LLMError("upstream exploded")


@pytest.fixture
def portfolio_vectors(provider: HashingEmbeddingProvider) -> dict[str, list[float]]:
    return {
        p.projectId: provider.embed(p.to_embedding_document())
        for p in load_portfolio()
    }


# ---------------------------------------------------------------- #
# VIP link construction                                             #
# ---------------------------------------------------------------- #


def test_vip_path_matches_frontend_route():
    assert tailor.vip_path("acme") == "/vip/acme"


def test_vip_url_uses_public_base_url(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com/")
    assert tailor.vip_url("acme") == "https://example.com/vip/acme"


def test_vip_url_falls_back_to_relative_path_when_unset(monkeypatch):
    """A wrong absolute host is worse than an obviously relative path."""
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    assert tailor.vip_url("acme") == "/vip/acme"


def test_inject_vip_link_appends_our_link(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    out = tailor.inject_vip_link("Body text.", "acme")
    assert "https://example.com/vip/acme" in out
    assert out.startswith("Body text.")


def test_inject_vip_link_strips_hallucinated_urls(monkeypatch):
    """The only link allowed to leave the system is the one we mint."""
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    out = tailor.inject_vip_link(
        "See my site at https://evil.example.net/phish for more.", "acme"
    )
    assert "evil.example.net" not in out
    assert out.count("https://") == 1
    assert "https://example.com/vip/acme" in out


# ---------------------------------------------------------------- #
# Evidence selection                                                #
# ---------------------------------------------------------------- #


def test_select_featured_projects_is_vector_ranked(provider, portfolio_vectors):
    job = make_job(
        title="Urban Planner",
        description="Masterplanning, public realm and landscape strategy.",
    )
    selected = tailor.select_featured_projects(
        job, count=2, provider=provider, portfolio_vectors=portfolio_vectors
    )
    assert len(selected) == 2
    assert len({p.projectId for p in selected}) == 2


def test_select_featured_projects_respects_count(provider, portfolio_vectors):
    job = make_job()
    assert (
        len(
            tailor.select_featured_projects(
                job, count=1, provider=provider, portfolio_vectors=portfolio_vectors
            )
        )
        == 1
    )


def test_select_featured_projects_survives_ranking_failure(monkeypatch, provider):
    """Vector store down must still yield a draftable pitch."""

    def boom(*_a, **_k):
        raise RuntimeError("pgvector unreachable")

    monkeypatch.setattr(tailor.repository, "match_portfolio", boom)
    selected = tailor.select_featured_projects(make_job(), count=2, provider=provider)
    assert len(selected) == 2


def test_select_featured_projects_falls_back_to_best_project_id(monkeypatch, provider):
    monkeypatch.setattr(
        tailor.repository, "match_portfolio", lambda *a, **k: []
    )
    known = load_portfolio()[1].projectId
    job = make_job(bestProjectId=known)
    selected = tailor.select_featured_projects(job, count=3, provider=provider)
    assert selected[0].projectId == known


# ---------------------------------------------------------------- #
# Prompt construction                                               #
# ---------------------------------------------------------------- #


def test_prompt_contains_role_and_evidence():
    job = make_job(title="BIM Coordinator", company="Zaha Co", location="Dubai")
    prompt = tailor.build_prompt(job, load_portfolio()[:2])
    assert "BIM Coordinator" in prompt
    assert "Zaha Co" in prompt
    assert "Dubai" in prompt
    assert "Challenge:" in prompt


def test_prompt_truncates_enormous_descriptions():
    job = make_job(description="x" * 9000)
    prompt = tailor.build_prompt(job, load_portfolio()[:1])
    assert len(prompt) < 5000


def test_prompt_forbids_model_written_urls():
    prompt = tailor.build_prompt(make_job(), load_portfolio()[:1])
    assert "do not write the URL" in prompt


# ---------------------------------------------------------------- #
# compose()                                                         #
# ---------------------------------------------------------------- #


def test_compose_returns_unapproved_pitch(provider, portfolio_vectors, monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    fake = FakeLLM()
    pitch = asyncio.run(
        tailor.compose(
            make_job(company="Acme Architects", companyId="acme-architects"),
            llm=fake,
            provider=provider,
            portfolio_vectors=portfolio_vectors,
        )
    )
    assert pitch.approved is False
    assert pitch.companyId == "acme-architects"
    assert "https://example.com/vip/acme-architects" in pitch.coverLetter
    assert pitch.featuredProjectIds


def test_compose_sends_the_system_instruction(provider, portfolio_vectors):
    fake = FakeLLM()
    asyncio.run(
        tailor.compose(
            make_job(), llm=fake, provider=provider,
            portfolio_vectors=portfolio_vectors,
        )
    )
    assert fake.systems[0] == tailor.SYSTEM_INSTRUCTION
    assert "never invent" in fake.systems[0].lower()


def test_compose_propagates_llm_failure(provider, portfolio_vectors):
    with pytest.raises(LLMError):
        asyncio.run(
            tailor.compose(
                make_job(), llm=ExplodingLLM(), provider=provider,
                portfolio_vectors=portfolio_vectors,
            )
        )


def test_compose_featured_ids_are_all_real_projects(provider, portfolio_vectors):
    valid = {p.projectId for p in load_portfolio()}
    pitch = asyncio.run(
        tailor.compose(
            make_job(), llm=FakeLLM(), provider=provider,
            portfolio_vectors=portfolio_vectors,
        )
    )
    assert set(pitch.featuredProjectIds) <= valid


# ---------------------------------------------------------------- #
# LLM providers                                                     #
# ---------------------------------------------------------------- #


def test_offline_provider_marks_its_output():
    out = TemplateLLMProvider().generate("hello")
    assert TemplateLLMProvider.MARKER in out


def test_offline_provider_rejects_empty_prompt():
    with pytest.raises(LLMError):
        TemplateLLMProvider().generate("   ")


def test_get_llm_provider_falls_back_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert isinstance(get_llm_provider(), TemplateLLMProvider)


def test_get_llm_provider_uses_gemini_with_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    assert isinstance(get_llm_provider(), GeminiLLMProvider)


def test_gemini_parses_a_normal_completion(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    def fake_post(*_a, **_k):
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "A letter."}]}}]},
            request=httpx.Request("POST", "https://x"),
        )

    monkeypatch.setattr(llm_module.httpx, "post", fake_post)
    assert GeminiLLMProvider().generate("prompt") == "A letter."


def test_gemini_surfaces_safety_block_reason(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    def fake_post(*_a, **_k):
        return httpx.Response(
            200,
            json={"candidates": [], "promptFeedback": {"blockReason": "SAFETY"}},
            request=httpx.Request("POST", "https://x"),
        )

    monkeypatch.setattr(llm_module.httpx, "post", fake_post)
    with pytest.raises(LLMError, match="SAFETY"):
        GeminiLLMProvider().generate("prompt")


def test_gemini_raises_on_http_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    def fake_post(*_a, **_k):
        return httpx.Response(
            429, text="rate limited", request=httpx.Request("POST", "https://x")
        )

    monkeypatch.setattr(llm_module.httpx, "post", fake_post)
    with pytest.raises(LLMError, match="429"):
        GeminiLLMProvider().generate("prompt")


# ---------------------------------------------------------------- #
# Analyst rationale                                                 #
# ---------------------------------------------------------------- #


def test_explain_match_includes_score_and_evidence():
    fake = FakeLLM(reply="Strong fit.")
    job = make_job(fitScore=91.5, bestProjectId=load_portfolio()[0].projectId)
    assert analyst.explain_match(job, llm=fake) == "Strong fit."
    assert "91.5" in fake.prompts[0]
    assert "Challenge:" in fake.prompts[0]


def test_explain_match_handles_unmatched_job():
    fake = FakeLLM()
    analyst.explain_match(make_job(bestProjectId=None), llm=fake)
    assert "No specific project matched." in fake.prompts[0]


# ---------------------------------------------------------------- #
# Telegram gateway                                                  #
# ---------------------------------------------------------------- #


def test_configured_requires_both_values(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t")
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert ops.configured() is False
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "1")
    assert ops.configured() is True


def test_notify_is_a_no_op_when_unconfigured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert asyncio.run(ops.notify("hi")) is False


def _mock_telegram(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    original = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = transport
        return original(*args, **kwargs)

    monkeypatch.setattr(ops.httpx, "AsyncClient", factory)


def test_notify_posts_to_sendmessage(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = request.read().decode()
        return httpx.Response(200, json={"ok": True})

    _mock_telegram(monkeypatch, handler)
    assert asyncio.run(ops.notify("hello")) is True
    assert seen["url"].endswith("/bottok/sendMessage")
    assert '"chat_id": "42"' in seen["body"]


def test_notify_returns_false_on_http_error(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    _mock_telegram(
        monkeypatch, lambda r: httpx.Response(401, json={"description": "bad token"})
    )
    assert asyncio.run(ops.notify("hello")) is False


def test_notify_swallows_transport_errors(monkeypatch):
    """A dead network must never propagate out of the ops agent."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")

    def handler(request):
        raise httpx.ConnectError("no route to host")

    _mock_telegram(monkeypatch, handler)
    assert asyncio.run(ops.notify("hello")) is False


def test_notify_truncates_oversized_messages(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        captured["len"] = len(_json.loads(request.read())["text"])
        return httpx.Response(200, json={"ok": True})

    _mock_telegram(monkeypatch, handler)
    asyncio.run(ops.notify("x" * 9000))
    assert captured["len"] == ops.MAX_MESSAGE_LENGTH


def test_format_high_match_escapes_html():
    job = make_job(title="Architect <script>", company="A & B")
    rendered = ops.format_high_match(job)
    assert "&lt;script&gt;" in rendered
    assert "A &amp; B" in rendered


def test_notify_high_matches_digests_into_one_message(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.read().decode())
        return httpx.Response(200, json={"ok": True})

    _mock_telegram(monkeypatch, handler)
    jobs = [make_job(title=f"Role {i}", fitScore=90 + i) for i in range(8)]
    assert asyncio.run(ops.notify_high_matches(jobs)) is True
    assert len(calls) == 1
    assert "and 3 more" in calls[0]


def test_notify_high_matches_skips_empty_list():
    assert asyncio.run(ops.notify_high_matches([])) is False


# ---------------------------------------------------------------- #
# Pipeline integration                                              #
# ---------------------------------------------------------------- #


def test_sweep_does_not_notify_by_default(monkeypatch, config):
    called = {"n": 0}

    async def spy(_jobs, **_k):
        called["n"] += 1
        return True

    monkeypatch.setattr(ops, "notify_high_matches", spy)
    monkeypatch.setattr(pipeline.repository, "upsert_jobs", lambda jobs: len(jobs))

    async def fake_router(*_a, **_k):
        from backend.agents.scout.router import SweepResult

        return SweepResult(jobs=[])

    monkeypatch.setattr(pipeline.router, "run", fake_router)
    asyncio.run(pipeline.run_sweep(config=config, search_terms=["Architect"]))
    assert called["n"] == 0


def test_sweep_notifies_only_about_accepted_jobs(monkeypatch, config, provider):
    sent = {}

    async def spy(jobs, **_k):
        sent["jobs"] = jobs
        return True

    monkeypatch.setattr(ops, "notify_high_matches", spy)
    monkeypatch.setattr(pipeline.repository, "upsert_jobs", lambda jobs: len(jobs))

    accepted = make_job(title="Great", fingerprint="a")
    rejected = make_job(title="Poor", fingerprint="b")

    def fake_gatekeep(jobs, cfg, **_k):
        accepted.stage = PipelineStage.HIGH_MATCH
        return analyst.GatekeepResult(accepted=[accepted], rejected=[rejected])

    monkeypatch.setattr(pipeline.analyst, "gatekeep", fake_gatekeep)

    async def fake_router(*_a, **_k):
        from backend.agents.scout.router import SweepResult

        return SweepResult(jobs=[accepted, rejected])

    monkeypatch.setattr(pipeline.router, "run", fake_router)

    report = asyncio.run(
        pipeline.run_sweep(
            config=config, search_terms=["Architect"], notify=True, offline=True
        )
    )
    assert report.notified is True
    assert [j.title for j in sent["jobs"]] == ["Great"]


# ---------------------------------------------------------------- #
# Scheduler                                                         #
# ---------------------------------------------------------------- #


def test_scheduler_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SWEEP_INTERVAL_MINUTES", raising=False)
    assert scheduler.configured_interval() == 0


def test_scheduler_clamps_aggressive_intervals(monkeypatch):
    monkeypatch.setenv("SWEEP_INTERVAL_MINUTES", "1")
    assert scheduler.configured_interval() == scheduler.MIN_INTERVAL_MINUTES


def test_scheduler_rejects_non_numeric_interval(monkeypatch):
    monkeypatch.setenv("SWEEP_INTERVAL_MINUTES", "soon")
    assert scheduler.configured_interval() == 0


def test_scheduler_accepts_valid_interval(monkeypatch):
    monkeypatch.setenv("SWEEP_INTERVAL_MINUTES", "30")
    assert scheduler.configured_interval() == 30


def test_start_is_a_no_op_when_disabled(monkeypatch):
    monkeypatch.setenv("SWEEP_INTERVAL_MINUTES", "0")

    async def scenario():
        started = scheduler.start()
        await scheduler.stop()
        return started

    assert asyncio.run(scenario()) is False
    assert scheduler.STATE.enabled is False


def test_start_and_stop_lifecycle(monkeypatch):
    monkeypatch.setenv("SWEEP_INTERVAL_MINUTES", "30")

    async def scenario():
        started = scheduler.start()
        enabled = scheduler.STATE.enabled
        await scheduler.stop()
        return started, enabled

    started, enabled = asyncio.run(scenario())
    assert started is True and enabled is True
    assert scheduler.STATE.enabled is False


def test_run_once_records_a_successful_report(monkeypatch):
    class Report:
        def as_dict(self):
            return {"accepted_count": 2}

    async def fake_sweep(**_k):
        return Report()

    monkeypatch.setattr(pipeline, "run_sweep", fake_sweep)
    before = scheduler.STATE.run_count
    result = asyncio.run(scheduler.run_once(notify=False))
    assert result == {"accepted_count": 2}
    assert scheduler.STATE.run_count == before + 1
    assert scheduler.STATE.running is False


def test_run_once_survives_a_failing_sweep(monkeypatch):
    async def boom(**_k):
        raise RuntimeError("scout died")

    alerted = {"n": 0}

    async def spy(_reason):
        alerted["n"] += 1
        return True

    monkeypatch.setattr(pipeline, "run_sweep", boom)
    monkeypatch.setattr(scheduler.ops, "notify_sweep_failure", spy)

    before = scheduler.STATE.failure_count
    result = asyncio.run(scheduler.run_once(notify=True))
    assert "error" in result
    assert scheduler.STATE.failure_count == before + 1
    assert scheduler.STATE.running is False
    assert alerted["n"] == 1
