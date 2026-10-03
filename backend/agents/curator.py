"""
Curator Agent — Generative Portfolio Studio.

Synthesises a rigorous architectural case study from partial operator input,
then hands it to the existing ingestion path so the new evidence is embedded
and matchable in the same action.

Division of labour
------------------
    Vision model  -> reads uploaded plans/renderings, returns observations
    Narrative LLM -> turns metadata + observations into the case study
    Embeddings    -> unchanged; GeminiEmbeddingProvider at 768 dims

Honesty constraints (enforced in the prompt and re-checked after parsing):
  * The model may not invent clients, dates, awards, certifications or
    quantities that the operator did not supply. A portfolio that fabricates
    metrics is worse than a thin one — it fails the first interview question.
  * Output is a draft. Nothing reaches the public site until the operator
    saves it, and the save path validates before writing.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from backend.core.assets import describe_assets
from backend.core.llm import LLMProvider, get_llm_provider, get_vision_provider
from backend.core.schemas import (
    ProjectCategory,
    ProjectEvidence,
    ProjectStatus,
    SpatialFramework,
)

logger = logging.getLogger("shadow-matrix.curator")

MAX_ASSETS_INSPECTED = 4
MAX_NOTE_CHARS = 4000


# ---------------------------------------------------------------- #
# Master Architectural System Prompt                                #
# ---------------------------------------------------------------- #

SYNTHESIS_SYSTEM = """\
You are Principal Design Director and Computational Narrative Architect at \
Beyond Render.

VOICE
Deeply architectural, systems-oriented, metric-driven, authoritative. You \
write the way a design critic defends a scheme: claim, mechanism, \
consequence. Every sentence must carry technical content.

BANNED
Marketing adjectives and empty intensifiers: breathtaking, amazing, unique, \
stunning, cutting-edge, state-of-the-art, world-class, innovative (as a bare \
label), seamless, elevate, transform (as filler). If a sentence survives \
deleting its adjectives, it was a good sentence.

HONESTY — THIS OVERRIDES EVERYTHING
Use ONLY the facts the operator supplied plus what is visible in the asset \
observations. You may reason about spatial and environmental logic from those \
facts. You may NOT invent: client names, firm names, dates, budgets, awards, \
certifications (LEED, BREEAM, Estidama…), published metrics, or areas that \
were not given. When a dimension is unknown, write the design logic without \
the number. A missing figure is acceptable; a fabricated one is not.

OUTPUT
Return ONLY a single JSON object. No prose, no markdown fence, no commentary.

{
  "identity": {
    "title": string,
    "category": "Residential" | "Commercial" | "Urban Planning" | "Technical",
    "status": "Completed" | "In Progress" | "Concept",
    "tagline": string,
    "scope": [string]
  },
  "decisionLog": {
    "challenge": string,
    "decision": string,
    "outcome": string
  },
  "spatialFramework": {
    "circulationStrategy": string,
    "materialityAndAtmosphere": string,
    "sustainabilityFramework": string
  },
  "softwareStack": [string],
  "recruiterPitch": string
}

FIELD RULES
- tagline: one line, under 120 characters, states the systemic position of \
the project — not a slogan.
- scope: 3 to 6 entries, each a concrete deliverable or responsibility.
- decisionLog.challenge: the real constraint conflict, stated as a tension \
between forces, not as a task description.
- decisionLog.decision: the specific architectural move, and why that move \
rather than the obvious alternative.
- decisionLog.outcome: what the move produced. Qualitative if no figure was \
supplied — never a made-up percentage.
- spatialFramework: three distinct positions. Circulation = how bodies and \
goods move and why. Materiality = tectonic and atmospheric consequence. \
Sustainability = passive logic first, systems second.
- recruiterPitch: exactly two sentences proving systemic design leadership, \
written for a hiring principal who will interrogate it.
"""

VISION_SYSTEM = """\
You are an architectural reviewer examining project assets (renderings, \
photographs, floor plans, sections, PDFs).

Report ONLY what is visually verifiable. For each asset note: drawing or \
image type; programme and spatial organisation; circulation structure; \
structural or envelope system; materials and finishes; environmental devices \
(shading, courtyards, orientation); and any legible labels or dimensions.

If something is ambiguous, say it is unclear. Never guess a dimension, a \
location, or a date. Plain prose, max 200 words per asset.\
"""


# ---------------------------------------------------------------- #
# Inputs                                                            #
# ---------------------------------------------------------------- #


def build_brief(payload: dict[str, Any]) -> str:
    """
    Render the operator's partial metadata into a prompt section.

    Pure function: the prompt is assertable in tests without a model.
    """
    lines: list[str] = []

    def add(label: str, value: Any) -> None:
        if value is None:
            return
        if isinstance(value, (list, tuple)):
            value = ", ".join(str(v).strip() for v in value if str(v).strip())
        text = str(value).strip()
        if text:
            lines.append(f"{label}: {text}")

    add("Working title", payload.get("title"))
    add("Category", payload.get("category"))
    add("Status / timeline", payload.get("status"))
    add("Role on the project", payload.get("teamRole"))
    add("Software used", payload.get("softwareStack"))
    add("Location", payload.get("location"))
    add("Area / scale", payload.get("area"))
    add("Critical constraints", payload.get("constraints"))
    add("Spatial notes", payload.get("spatialNotes"))
    add("Additional notes", payload.get("notes"))

    # Answers to the Evidence Interrogator carry more signal than any other
    # field: they are the operator explaining their own reasoning.
    for answer in payload.get("interrogation") or []:
        if not isinstance(answer, dict):
            continue
        question = str(answer.get("question") or "").strip()
        response = str(answer.get("answer") or "").strip()
        if question and response:
            lines.append(f"Q: {question}\n   A: {response}")

    if not lines:
        return "No metadata supplied."
    return "\n".join(lines)[:MAX_NOTE_CHARS]


def build_prompt(
    payload: dict[str, Any],
    observations: str | None = None,
    measured: str | None = None,
) -> str:
    """Assemble the full synthesis prompt."""
    sections = [
        "Synthesise a case study for the project below.",
        "",
        "## Operator brief (authoritative facts)",
        build_brief(payload),
    ]

    if measured and measured.strip():
        # Measured file properties cannot be wrong, unlike a visual reading.
        sections += [
            "",
            "## Measured asset properties (read from the files; treat as fact)",
            measured.strip()[:MAX_NOTE_CHARS],
        ]

    if observations and observations.strip():
        sections += [
            "",
            "## Asset observations (visually verified)",
            observations.strip()[:MAX_NOTE_CHARS],
        ]
    else:
        sections += [
            "",
            "## Asset observations",
            "None supplied. Reason only from the brief above.",
        ]

    stance = str(payload.get("_stance") or "").strip()
    if stance:
        sections += [
            "",
            "## Narrative emphasis",
            stance,
            "This changes which facts you lead with. It does not licence "
            "new facts, and every truthfulness rule above still applies.",
        ]

    sections += [
        "",
        "Return the JSON object now. No other text.",
    ]
    return "\n".join(sections)


async def inspect_assets(
    assets: list[str],
    *,
    llm: LLMProvider | None = None,
) -> str:
    """
    Run the vision model over uploaded assets.

    Returns prose observations, or "" when there is nothing to inspect or the
    inspection fails. **Fails soft**: losing image analysis degrades the case
    study, but blocking synthesis entirely would be worse.
    """
    if not assets:
        return ""

    llm = llm or get_vision_provider()
    if llm is None:
        # No multimodal provider configured. Returning "" keeps the draft
        # text-only instead of asking a blind model to describe drawings.
        return ""
    subset = assets[:MAX_ASSETS_INSPECTED]

    try:
        # Both the Gemini and AMD providers accept an `images` kwarg; any
        # third-party provider that does not is handled by the TypeError
        # branch below.
        if hasattr(llm, "agenerate"):
            try:
                return await llm.agenerate(  # type: ignore[call-arg]
                    "Describe each supplied asset for an architectural case study.",
                    system=VISION_SYSTEM,
                    images=subset,
                )
            except TypeError:
                # Provider does not support the images kwarg.
                return ""
    except Exception as exc:  # noqa: BLE001 - never block synthesis
        logger.warning("Asset inspection failed: %s", exc)
    return ""


# ---------------------------------------------------------------- #
# Parsing                                                           #
# ---------------------------------------------------------------- #

_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


class SynthesisError(RuntimeError):
    """The model did not return a usable case study."""


def parse_synthesis(raw: str) -> dict[str, Any]:
    """Extract the JSON object from a model reply, tolerating fences."""
    if not raw or not raw.strip():
        raise SynthesisError("The model returned an empty response.")

    match = _JSON_OBJECT_RE.search(raw)
    if not match:
        raise SynthesisError(
            "The model did not return JSON. First 200 characters: "
            f"{raw.strip()[:200]}"
        )
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise SynthesisError(f"The model returned invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise SynthesisError("The model returned JSON that was not an object.")
    return parsed


def _coerce_enum(value: Any, enum_cls, fallback):
    """Map a model's free text onto an enum, case-insensitively."""
    text = str(value or "").strip().lower()
    for member in enum_cls:
        if member.value.lower() == text:
            return member
    return fallback


def to_project(
    synthesised: dict[str, Any],
    *,
    project_id: str,
    payload: dict[str, Any] | None = None,
) -> ProjectEvidence:
    """
    Build a validated `ProjectEvidence` from a model reply.

    The operator's own metadata wins over the model's for category, status and
    software: those are facts the operator stated, not things to re-interpret.
    """
    payload = payload or {}
    identity = synthesised.get("identity") or {}
    decision = synthesised.get("decisionLog") or {}
    spatial = synthesised.get("spatialFramework") or {}

    title = (
        str(identity.get("title") or payload.get("title") or "").strip()
        or "Untitled project"
    )

    category = _coerce_enum(
        payload.get("category") or identity.get("category"),
        ProjectCategory,
        ProjectCategory.TECHNICAL,
    )
    status = _coerce_enum(
        payload.get("status") or identity.get("status"),
        ProjectStatus,
        ProjectStatus.CONCEPT,
    )

    scope = identity.get("scope") or []
    if not isinstance(scope, list):
        scope = [str(scope)]

    stack = payload.get("softwareStack") or synthesised.get("softwareStack") or []
    if isinstance(stack, str):
        stack = [part.strip() for part in stack.split(",") if part.strip()]

    return ProjectEvidence(
        projectId=project_id,
        identity={
            "title": title,
            "category": category,
            "status": status,
            "scope": [str(s).strip() for s in scope if str(s).strip()],
            "tagline": (str(identity.get("tagline") or "").strip() or None),
        },
        decisionLog={
            "challenge": str(decision.get("challenge") or "").strip(),
            "decision": str(decision.get("decision") or "").strip(),
            "outcome": str(decision.get("outcome") or "").strip(),
        },
        evidenceLayer={
            "images": list(payload.get("images") or []),
            "technicalDrawings": list(payload.get("technicalDrawings") or []),
        },
        softwareStack=[str(s).strip() for s in stack if str(s).strip()],
        spatialFramework=SpatialFramework(
            circulationStrategy=str(spatial.get("circulationStrategy") or "").strip(),
            materialityAndAtmosphere=str(
                spatial.get("materialityAndAtmosphere") or ""
            ).strip(),
            sustainabilityFramework=str(
                spatial.get("sustainabilityFramework") or ""
            ).strip(),
        ),
        recruiterPitch=(str(synthesised.get("recruiterPitch") or "").strip() or None),
    )


# ---------------------------------------------------------------- #
# Orchestration                                                     #
# ---------------------------------------------------------------- #


async def synthesise(
    payload: dict[str, Any],
    *,
    project_id: str,
    llm: LLMProvider | None = None,
    vision: LLMProvider | None = None,
    assets: list[str] | None = None,
    observations: str | None = None,
) -> tuple[ProjectEvidence, str]:
    """
    Produce a draft case study. Returns (project, asset observations).

    The project is NOT persisted here — saving is a separate, explicit step.

    ``observations`` may be supplied to reuse an earlier inspection. A/B
    variants rely on this: both framings must see the identical reading of
    the assets, or the comparison measures vision noise, not framing.
    """
    if observations is None:
        observations = await inspect_assets(assets or [], llm=vision)

    measured = describe_assets(assets or [])

    llm = llm or get_llm_provider(role="curator")
    prompt = build_prompt(payload, observations, measured)
    raw = await llm.agenerate(prompt, system=SYNTHESIS_SYSTEM)

    project = to_project(parse_synthesis(raw), project_id=project_id, payload=payload)
    return project, observations
