"""
Asynchronous key rotation, circuit breaking and failover.

Every test is offline: the AMD endpoint is replaced with an `httpx.MockTransport`
so we assert on our rotation logic, not on AMD's availability.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from backend.core import amd as amd_module
from backend.core.amd import AMDChatProvider, AMDError
from backend.core.keyring import (
    AllKeysUnavailableError,
    KeyRing,
    NoKeysConfiguredError,
    mask,
)

KEYS = ["rc-aaaaaaaaaaaaaaaaaaaa", "rc-bbbbbbbbbbbbbbbbbbbb", "rc-cccccccccccccccccccc"]


def ring(**kwargs) -> KeyRing:
    return KeyRing(list(KEYS), **kwargs)


def ok_body(text: str = "hello") -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": text}}]}


def provider(monkeypatch, handler, **kwargs) -> AMDChatProvider:
    """An AMD provider whose HTTP calls are served by `handler`."""
    transport = httpx.MockTransport(handler)
    original = amd_module.httpx.AsyncClient

    def factory(*args, **kw):
        kw["transport"] = transport
        return original(*args, **kw)

    monkeypatch.setattr(amd_module.httpx, "AsyncClient", factory)
    return AMDChatProvider("test-model", keyring=ring(), **kwargs)


def bearer(request: httpx.Request) -> str:
    return request.headers["Authorization"].removeprefix("Bearer ")


# ---------------------------------------------------------------- #
# Key ring basics                                                   #
# ---------------------------------------------------------------- #


def test_empty_pool_is_a_configuration_error():
    with pytest.raises(NoKeysConfiguredError):
        KeyRing([])


def test_blank_entries_are_discarded():
    assert len(KeyRing(["rc-aaaaaaaaaaaaaaaa", "  ", ""])) == 1


def test_duplicate_keys_are_collapsed():
    """Duplicates would share a rate limit while posing as extra capacity."""
    assert len(KeyRing([KEYS[0], KEYS[0], KEYS[1]])) == 2


def test_mask_never_reveals_the_whole_key():
    masked = mask(KEYS[0])
    assert KEYS[0] not in masked
    assert masked.startswith("rc-aaa")
    assert len(masked) < len(KEYS[0])


def test_short_keys_are_fully_masked():
    assert mask("abc") == "****"


def test_round_robin_cycles_in_order():
    pool = ring()

    async def scenario():
        return [(await pool.acquire()).key for _ in range(6)]

    assert asyncio.run(scenario()) == KEYS + KEYS


def test_acquire_skips_excluded_keys():
    pool = ring()

    async def scenario():
        first = await pool.acquire()
        second = await pool.acquire(exclude={first.key})
        return first.key, second.key

    first, second = asyncio.run(scenario())
    assert first != second


# ---------------------------------------------------------------- #
# Circuit breaker                                                   #
# ---------------------------------------------------------------- #


def test_tripped_key_is_skipped():
    pool = ring()

    async def scenario():
        victim = await pool.acquire()
        pool.trip(victim, "429")
        return [(await pool.acquire()).key for _ in range(4)], victim.key

    seen, victim = asyncio.run(scenario())
    assert victim not in seen


def test_breaker_reopens_after_the_cooldown():
    pool = ring(cooldown_seconds=0.05)

    async def scenario():
        victim = await pool.acquire()
        pool.trip(victim, "429")
        assert victim.is_open()
        await asyncio.sleep(0.08)
        return victim.is_open()

    assert asyncio.run(scenario()) is False


def test_all_keys_tripped_raises_with_retry_after():
    pool = ring(cooldown_seconds=30)

    async def scenario():
        for _ in range(3):
            pool.trip(await pool.acquire(), "429")
        with pytest.raises(AllKeysUnavailableError) as excinfo:
            await pool.acquire()
        return excinfo.value.retry_after

    retry_after = asyncio.run(scenario())
    assert 0 < retry_after <= 30


def test_success_closes_the_breaker_immediately():
    pool = ring(cooldown_seconds=60)

    async def scenario():
        state = await pool.acquire()
        pool.trip(state, "429")
        pool.record_success(state)
        return state.is_open()

    assert asyncio.run(scenario()) is False


def test_snapshot_reports_health_without_leaking_keys():
    pool = ring()

    async def scenario():
        pool.trip(await pool.acquire(), "429")
        return pool.snapshot()

    snap = asyncio.run(scenario())
    assert snap["total"] == 3
    assert snap["available"] == 2
    serialised = str(snap)
    for key in KEYS:
        assert key not in serialised


# ---------------------------------------------------------------- #
# Provider failover                                                 #
# ---------------------------------------------------------------- #


def test_successful_call_returns_content(monkeypatch):
    client = provider(monkeypatch, lambda r: httpx.Response(200, json=ok_body("hi")))
    assert asyncio.run(client.agenerate("prompt")) == "hi"


def test_consecutive_calls_rotate_keys(monkeypatch):
    used: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        used.append(bearer(request))
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)

    async def scenario():
        for _ in range(3):
            await client.agenerate("prompt")

    asyncio.run(scenario())
    assert used == KEYS


def test_429_fails_over_to_the_next_key(monkeypatch):
    used: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        used.append(bearer(request))
        if len(used) == 1:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(200, json=ok_body("recovered"))

    client = provider(monkeypatch, handler)
    assert asyncio.run(client.agenerate("prompt")) == "recovered"
    assert len(used) == 2
    assert used[0] != used[1]


def test_throttled_key_is_isolated_for_later_calls(monkeypatch):
    used: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        key = bearer(request)
        used.append(key)
        if key == KEYS[0]:
            return httpx.Response(429, json={})
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)

    async def scenario():
        for _ in range(3):
            await client.agenerate("prompt")

    asyncio.run(scenario())
    # The bad key is contacted once, then skipped for the whole cool-down.
    assert used.count(KEYS[0]) == 1


def test_server_errors_fail_over(monkeypatch):
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] <= 2:
            return httpx.Response(503, text="unavailable")
        return httpx.Response(200, json=ok_body("third time"))

    client = provider(monkeypatch, handler)
    assert asyncio.run(client.agenerate("prompt")) == "third time"
    assert attempts["n"] == 3


def test_transport_errors_fail_over(monkeypatch):
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise httpx.ConnectError("connection reset")
        return httpx.Response(200, json=ok_body("survived"))

    client = provider(monkeypatch, handler)
    assert asyncio.run(client.agenerate("prompt")) == "survived"


def test_each_key_is_tried_at_most_once_per_request(monkeypatch):
    """A failing pool must terminate, never spin."""
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        return httpx.Response(429, json={})

    client = provider(monkeypatch, handler)
    with pytest.raises(AMDError):
        asyncio.run(client.agenerate("prompt"))
    assert attempts["n"] == 3


def test_auth_failure_isolates_the_key_for_longer(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if bearer(request) == KEYS[0]:
            return httpx.Response(401, json={"error": "invalid key"})
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)
    asyncio.run(client.agenerate("prompt"))
    bad = next(s for s in client.keyring.states if s.key == KEYS[0])
    assert bad.is_open()
    assert bad.recovers_at > 0


def test_malformed_request_is_not_retried(monkeypatch):
    """Every key would reject a 422 identically — burning them is pointless."""
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        return httpx.Response(422, text="bad model id")

    client = provider(monkeypatch, handler)
    with pytest.raises(AMDError, match="422"):
        asyncio.run(client.agenerate("prompt"))
    assert attempts["n"] == 1


def test_retry_after_header_is_honoured(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if bearer(request) == KEYS[0]:
            return httpx.Response(429, headers={"Retry-After": "5"}, json={})
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)
    asyncio.run(client.agenerate("prompt"))
    bad = next(s for s in client.keyring.states if s.key == KEYS[0])
    assert bad.is_open()


def test_empty_completion_is_an_error(monkeypatch):
    client = provider(
        monkeypatch,
        lambda r: httpx.Response(200, json={"choices": [{"message": {"content": ""}}]}),
    )
    with pytest.raises(AMDError):
        asyncio.run(client.agenerate("prompt"))


def test_empty_prompt_is_rejected_before_any_request(monkeypatch):
    called = {"n": 0}

    def handler(request):
        called["n"] += 1
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)
    with pytest.raises(AMDError):
        asyncio.run(client.agenerate("   "))
    assert called["n"] == 0


# ---------------------------------------------------------------- #
# Concurrency                                                       #
# ---------------------------------------------------------------- #


def test_parallel_requests_spread_across_keys(monkeypatch):
    used: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        used.append(bearer(request))
        await asyncio.sleep(0.01)
        return httpx.Response(200, json=ok_body())

    transport = httpx.MockTransport(handler)
    original = amd_module.httpx.AsyncClient

    def factory(*args, **kw):
        kw["transport"] = transport
        return original(*args, **kw)

    monkeypatch.setattr(amd_module.httpx, "AsyncClient", factory)
    client = AMDChatProvider("test-model", keyring=ring())

    async def scenario():
        await asyncio.gather(*(client.agenerate("prompt") for _ in range(6)))

    asyncio.run(scenario())
    assert len(used) == 6
    # Round-robin under concurrency must still use the whole pool.
    assert set(used) == set(KEYS)


def test_payload_shape_is_openai_compatible(monkeypatch):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        captured.update(_json.loads(request.read()))
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)
    asyncio.run(client.agenerate("the prompt", system="be terse"))
    assert captured["model"] == "test-model"
    assert captured["messages"][0] == {"role": "system", "content": "be terse"}
    assert captured["messages"][1] == {"role": "user", "content": "the prompt"}


def test_images_use_the_multimodal_content_array(monkeypatch):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        captured.update(_json.loads(request.read()))
        return httpx.Response(200, json=ok_body())

    client = provider(monkeypatch, handler)
    asyncio.run(
        client.agenerate("describe", images=["https://example.com/a.png"])
    )
    content = captured["messages"][0]["content"]
    assert isinstance(content, list)
    assert content[1]["type"] == "image_url"


def test_sync_generate_refuses_inside_a_running_loop(monkeypatch):
    client = provider(monkeypatch, lambda r: httpx.Response(200, json=ok_body()))

    async def scenario():
        with pytest.raises(AMDError, match="event loop"):
            client.generate("prompt")

    asyncio.run(scenario())


# ---------------------------------------------------------------- #
# Role → model assignment                                           #
# ---------------------------------------------------------------- #


def test_each_agent_role_gets_its_assigned_model(monkeypatch):
    monkeypatch.setenv("AMD_API_KEYS", ",".join(KEYS))
    amd_module.reset_keyring()
    from backend.core.llm import get_llm_provider

    assert get_llm_provider(role="vision").model == "Qwen3.8-27B"
    assert get_llm_provider(role="analyst").model == "MiniCPM5-2B"
    assert get_llm_provider(role="tailor").model == "DeepSeek-V4-Flash-0731"
    amd_module.reset_keyring()


def test_unknown_role_falls_back_to_the_tailor_model(monkeypatch):
    monkeypatch.setenv("AMD_API_KEYS", ",".join(KEYS))
    amd_module.reset_keyring()
    from backend.core.llm import get_llm_provider

    assert get_llm_provider(role="nonsense").model == "DeepSeek-V4-Flash-0731"
    amd_module.reset_keyring()


def test_amd_takes_precedence_over_gemini(monkeypatch):
    monkeypatch.setenv("AMD_API_KEYS", ",".join(KEYS))
    monkeypatch.setenv("GEMINI_API_KEY", "gem")
    amd_module.reset_keyring()
    from backend.core.llm import get_llm_provider

    assert isinstance(get_llm_provider(), AMDChatProvider)
    amd_module.reset_keyring()


# ---------------------------------------------------------------- #
# Analyst pre-filter (MiniCPM5-2B)                                  #
# ---------------------------------------------------------------- #


class _Verdict:
    name = "fake"
    online = True

    def __init__(self, reply: str | Exception) -> None:
        self.reply = reply

    def generate(self, prompt: str, *, system: str | None = None) -> str:
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    async def agenerate(self, prompt: str, *, system: str | None = None) -> str:
        return self.generate(prompt, system=system)


def test_prefilter_accepts_relevant_roles():
    from backend.agents import analyst
    from backend.tests.conftest import make_job

    assert asyncio.run(analyst.prefilter(make_job(), llm=_Verdict("RELEVANT"))) is True


def test_prefilter_rejects_irrelevant_roles():
    from backend.agents import analyst
    from backend.tests.conftest import make_job

    assert (
        asyncio.run(analyst.prefilter(make_job(), llm=_Verdict("IRRELEVANT"))) is False
    )


def test_prefilter_fails_open_on_error():
    """A flaky pre-filter must never silently delete opportunities."""
    from backend.agents import analyst
    from backend.tests.conftest import make_job

    verdict = asyncio.run(
        analyst.prefilter(make_job(), llm=_Verdict(RuntimeError("down")))
    )
    assert verdict is True


def test_prefilter_fails_open_on_gibberish():
    from backend.agents import analyst
    from backend.tests.conftest import make_job

    assert asyncio.run(analyst.prefilter(make_job(), llm=_Verdict("¯\\_(ツ)_/¯"))) is True


# ---------------------------------------------------------------- #
# DOM engine model-assisted extraction (Qwen3.8-27B)                #
# ---------------------------------------------------------------- #


def test_model_extraction_parses_a_json_array(monkeypatch):
    from backend.agents.scout import dom_engine

    monkeypatch.setattr(
        dom_engine,
        "get_llm_provider",
        lambda **_k: _Verdict('[{"title": "Architect", "company": "Acme"}]'),
    )
    rows = asyncio.run(dom_engine.extract_with_model("page text", "https://x"))
    assert rows == [{"title": "Architect", "company": "Acme"}]


def test_model_extraction_strips_code_fences(monkeypatch):
    from backend.agents.scout import dom_engine

    monkeypatch.setattr(
        dom_engine,
        "get_llm_provider",
        lambda **_k: _Verdict('```json\n[{"title": "A"}]\n```'),
    )
    assert asyncio.run(dom_engine.extract_with_model("text", "https://x")) == [
        {"title": "A"}
    ]


def test_model_extraction_fails_closed_on_error(monkeypatch):
    from backend.agents.scout import dom_engine

    monkeypatch.setattr(
        dom_engine, "get_llm_provider", lambda **_k: _Verdict(RuntimeError("boom"))
    )
    assert asyncio.run(dom_engine.extract_with_model("text", "https://x")) == []


def test_model_extraction_fails_closed_on_prose(monkeypatch):
    from backend.agents.scout import dom_engine

    monkeypatch.setattr(
        dom_engine,
        "get_llm_provider",
        lambda **_k: _Verdict("I could not find any jobs on this page."),
    )
    assert asyncio.run(dom_engine.extract_with_model("text", "https://x")) == []


def test_model_extraction_skips_empty_pages(monkeypatch):
    from backend.agents.scout import dom_engine

    called = {"n": 0}

    def spy(**_k):
        called["n"] += 1
        return _Verdict("[]")

    monkeypatch.setattr(dom_engine, "get_llm_provider", spy)
    assert asyncio.run(dom_engine.extract_with_model("   ", "https://x")) == []
    assert called["n"] == 0
