"""
Shadow Matrix — Evidence Interrogator.

Generates the questions an experienced design director would ask after
looking at the drawings, before any case study is written.

The problem it solves
---------------------
Synthesis quality is capped by input quality, and the weakest input is
always the free-text "critical constraints" box. Most architects write one
flat line there ("tight site, limited budget"), and no model can turn that
into a defensible decision log. The result is confident, generic prose.

Asking first inverts this. A specific question ("the core is split across
two cores rather than centralised — was that egress distance or
lettable-floorplate division?") retrieves knowledge the operator has but
would not have thought to volunteer. The answers then enter the brief as
authoritative facts, which also shrinks what the Provenance Guard has to
flag.

Fails soft throughout: if questions cannot be generated, the operator
simply fills the form as before.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from backend.core.assets import describe_assets
from backend.core.llm import LLMProvider, get_llm_provider, get_vision_provider

logger = logging.getLogger("shadow-matrix.interrogator")

MAX_QUESTIONS = 5
MIN_QUESTIONS = 3

INTERROGATION_SYSTEM = f"""\
You are a Principal Design Director at Beyond Render reviewing a colleague's \
project before it becomes a portfolio case study. You have their brief and \
whatever can be read from their drawings.

Your task is to ask the {MIN_QUESTIONS}-{MAX_QUESTIONS} questions whose answers \
would most improve the case study. You are not interviewing them for a job; you \
are extracting the reasoning they have in their head but did not write down.

What makes a good question here:
- It targets a DECISION and its rationale, not a description. "Why is the \
circulation doubled back on itself?" beats "Describe the circulation."
- It is specific to THIS project, quoting something from the brief or the \
assets. A question that could be asked of any building is worthless.
- Its answer would be a fact only this architect knows: a constraint they \
negotiated, a trade-off they accepted, a client or code pressure they absorbed.
- It probes where the brief is thinnest or most generic.

Hard rules:
- Never ask for information already stated in the brief.
- Never ask a question that invites the architect to invent a metric, an \
award or a certification. Ask what they decided and why, not what the \
project achieved numerically.
- Never ask more than one thing per question.
- No compliments, no preamble.

Each question carries a `rationale` explaining, in one short sentence, what \
the answer will let the case study establish.

Return ONLY a JSON object:
{{
  "questions": [
    {{
      "id": "q1",
      "question": "the question",
      "rationale": "what this unlocks",
      "targets": "challenge" | "decision" | "outcome" | "circulation" | \
"materiality" | "sustainability" | "role"
    }}
  ]
}}
"""

_VALID_TARGETS = {
    "challenge",
    "decision",
    "outcome",
    "circulation",
    "materiality",
    "sustainability",
    "role",
}


@dataclass
class Question:
    id: str
    question: str
    rationale: str
    targets: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "question": self.question,
            "rationale": self.rationale,
            "targets": self.targets,
        }


def build_interrogation_prompt(
    payload: dict[str, Any],
    observations: str = "",
    measured: str = "",
) -> str:
    """Assemble the interrogation prompt. Pure, so it is testable."""
    from backend.agents.curator import build_brief

    sections = [
        "Review the project below and ask your questions.",
        "",
        "## What the architect has told us",
        build_brief(payload),
    ]

    if measured.strip():
        sections += ["", "## Measured file properties", measured.strip()[:4000]]

    if observations.strip():
        sections += [
            "",
            "## What can be seen in the assets",
            observations.strip()[:4000],
        ]
    else:
        sections += [
            "",
            "## Assets",
            "No readable assets. Base your questions on the brief, and "
            "concentrate on where it is thinnest.",
        ]

    sections += ["", "Return the JSON object now. No other text."]
    return "\n".join(sections)


def parse_questions(raw: str) -> list[Question]:
    """Extract and sanitise the question list from a model reply."""
    from backend.agents.curator import parse_synthesis

    parsed = parse_synthesis(raw)
    questions: list[Question] = []

    for index, entry in enumerate(parsed.get("questions") or [], start=1):
        if not isinstance(entry, dict):
            continue
        text = str(entry.get("question") or "").strip()
        if not text:
            continue
        targets = str(entry.get("targets") or "decision").strip().lower()
        if targets not in _VALID_TARGETS:
            targets = "decision"
        questions.append(
            Question(
                id=str(entry.get("id") or f"q{index}").strip(),
                question=text,
                rationale=str(entry.get("rationale") or "").strip(),
                targets=targets,
            )
        )
        if len(questions) >= MAX_QUESTIONS:
            break

    # De-duplicate: models occasionally restate a question in two forms.
    seen: set[str] = set()
    unique: list[Question] = []
    for question in questions:
        key = question.question.lower().rstrip("?").strip()
        if key in seen:
            continue
        seen.add(key)
        unique.append(question)
    return unique


async def interrogate(
    payload: dict[str, Any],
    *,
    assets: list[str] | None = None,
    observations: str | None = None,
    llm: LLMProvider | None = None,
    vision: LLMProvider | None = None,
) -> tuple[list[Question], str]:
    """
    Produce the questions. Returns (questions, asset observations).

    The observations are returned so the caller can hand them straight to
    synthesis instead of paying for a second vision pass.
    """
    from backend.agents.curator import inspect_assets

    if observations is None:
        observations = await inspect_assets(assets or [], llm=vision)
    measured = describe_assets(assets or [])

    llm = llm or get_llm_provider(role="curator")
    prompt = build_interrogation_prompt(payload, observations, measured)

    try:
        raw = await llm.agenerate(prompt, system=INTERROGATION_SYSTEM)
    except Exception as exc:  # noqa: BLE001 - never block the form
        logger.warning("Interrogation failed: %s", exc)
        return [], observations

    try:
        return parse_questions(raw), observations
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not parse interrogation reply: %s", exc)
        return [], observations


__all__ = [
    "INTERROGATION_SYSTEM",
    "Question",
    "build_interrogation_prompt",
    "get_vision_provider",
    "interrogate",
    "parse_questions",
]
