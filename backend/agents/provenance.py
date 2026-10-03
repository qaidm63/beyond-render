"""
Shadow Matrix — Provenance Guard.

Verifies that every verifiable claim in a synthesised case study traces
back to something the operator actually supplied.

Why this is not redundant with the prompt
-----------------------------------------
`curator.SYNTHESIS_SYSTEM` forbids inventing clients, budgets, metrics,
awards and certifications. Instructions reduce fabrication; they do not
prevent it, and a plausible invented figure is exactly the failure a
reader cannot catch. This module turns that instruction into a mechanical
check: extract claims from the generated text, look for their support in
the operator's own inputs, and flag what is unsupported.

Design position
---------------
This guard **advises, it does not block**. A false positive that refuses
to save a truthful project would push operators to disable the guard
entirely, which is worse than no guard. Findings surface in the UI for
confirmation; the operator remains accountable for the text.

Deliberately conservative: it only flags claim classes that are both
high-risk and cheaply checkable. Prose is not fact-checked.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

from backend.core.schemas import ProjectEvidence

Severity = Literal["critical", "warning"]


@dataclass
class Finding:
    """One unsupported claim."""

    severity: Severity
    kind: str
    claim: str
    field: str
    message: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "kind": self.kind,
            "claim": self.claim,
            "field": self.field,
            "message": self.message,
        }


@dataclass
class ProvenanceReport:
    findings: list[Finding] = field(default_factory=list)
    checkedFields: list[str] = field(default_factory=list)

    @property
    def clean(self) -> bool:
        return not self.findings

    @property
    def criticalCount(self) -> int:
        return sum(1 for f in self.findings if f.severity == "critical")

    def to_dict(self) -> dict[str, Any]:
        return {
            "clean": self.clean,
            "criticalCount": self.criticalCount,
            "warningCount": len(self.findings) - self.criticalCount,
            "findings": [f.to_dict() for f in self.findings],
            "checkedFields": self.checkedFields,
        }


# ---------------------------------------------------------------- #
# Claim patterns                                                    #
# ---------------------------------------------------------------- #

# Certifications are the highest-stakes class: claiming LEED Gold on a
# project that never pursued it is a career-ending line on a CV.
_CERTIFICATION_RE = re.compile(
    r"\b("
    r"LEED(?:\s+(?:Platinum|Gold|Silver|Certified))?"
    r"|BREEAM(?:\s+(?:Outstanding|Excellent|Very\s+Good|Good))?"
    r"|Estidama(?:\s+\d\s*Pearl)?|\d\s*Pearl\b"
    r"|WELL(?:\s+(?:Platinum|Gold|Silver))?\s+Certifi\w+"
    r"|Mostadam|GSAS|Passivhaus|Passive\s+House|EDGE\s+Certifi\w+"
    r"|net[-\s]?zero\s+certifi\w+"
    r")\b",
    re.IGNORECASE,
)

_AWARD_RE = re.compile(
    r"\b(award[- ]winning|won\s+the\s+\w+|prize[- ]winning|shortlisted\s+for"
    r"|RIBA\s+\w+|AIA\s+Award|Aga\s+Khan\s+Award|Pritzker)\b",
    re.IGNORECASE,
)

# Quantities: percentages, money, areas, counts of storeys/units.
_NUMBER_RE = re.compile(
    r"(?<![\w.])"
    r"(?:[$€£¥]\s?\d[\d,.]*\s*(?:k|m|bn|million|billion)?"
    r"|\d[\d,.]*\s*(?:%|percent|per\s+cent)"
    r"|\d[\d,.]*\s*(?:m²|m2|sqm|sq\.?\s?m|ft²|ft2|sqft|sq\.?\s?ft|hectares?|acres?)"
    r"|\d[\d,.]*\s*(?:storeys?|stories|floors?|levels?|units?|apartments?|keys?|beds?)"
    r"|\d[\d,.]*\s*(?:kWh|kW|MW|tonnes?|tCO2e?)"
    r")",
    re.IGNORECASE,
)

# Figures that carry no risk of misrepresentation.
_BENIGN_NUMBERS = re.compile(
    r"^(?:0|1|2|two|single|double)\s*(?:storeys?|stories|floors?|levels?)$",
    re.IGNORECASE,
)


def _normalise(text: str) -> str:
    """Lowercase and strip separators so '4,200 m2' matches '4200 m²'."""
    lowered = text.lower()
    lowered = lowered.replace("²", "2").replace("м", "m")
    lowered = re.sub(r"(?<=\d)[,\s](?=\d)", "", lowered)
    lowered = re.sub(r"[^\w%$€£¥.]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _digits(text: str) -> str:
    """
    The numeric magnitude of a claim, ignoring any unit.

    Only the FIRST run of digits is taken: '4200 m2' must reduce to '4200',
    not '42002', or it would never match '4200 sqm' in the brief.
    """
    match = re.search(r"\d[\d.]*", text)
    if not match:
        return ""
    return match.group(0).rstrip(".").replace(".", "")


# ---------------------------------------------------------------- #
# Evidence corpus                                                   #
# ---------------------------------------------------------------- #


def build_source_corpus(payload: dict[str, Any], observations: str = "") -> str:
    """
    Everything the operator supplied, flattened.

    Asset observations are included: a measured sheet size or a figure the
    vision model read off a drawing is operator-provided evidence, not an
    invention of the narrative model.
    """
    parts: list[str] = []
    for value in payload.values():
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, (list, tuple)):
            parts.extend(str(v) for v in value if isinstance(v, (str, int, float)))
        elif isinstance(value, (int, float)):
            parts.append(str(value))
    if observations:
        parts.append(observations)
    # Base64 payloads are noise and would create accidental digit matches.
    corpus = " ".join(p for p in parts if not p.startswith("data:"))
    return _normalise(corpus)


def _supported(claim: str, corpus: str, corpus_digits: set[str]) -> bool:
    normalised = _normalise(claim)
    if not normalised:
        return True
    if normalised in corpus:
        return True
    # A figure counts as supported when its digits appear in the inputs,
    # even if the unit was written differently.
    digits = _digits(normalised)
    return bool(digits) and digits in corpus_digits


# ---------------------------------------------------------------- #
# Verification                                                      #
# ---------------------------------------------------------------- #

_CHECKED_FIELDS: tuple[tuple[str, str], ...] = (
    ("identity.tagline", "tagline"),
    ("decisionLog.challenge", "challenge"),
    ("decisionLog.decision", "decision"),
    ("decisionLog.outcome", "outcome"),
    ("spatialFramework.circulationStrategy", "circulation strategy"),
    ("spatialFramework.materialityAndAtmosphere", "materiality"),
    ("spatialFramework.sustainabilityFramework", "sustainability framework"),
    ("recruiterPitch", "recruiter pitch"),
)


def _resolve(project: ProjectEvidence, path: str) -> str:
    obj: Any = project
    for part in path.split("."):
        obj = getattr(obj, part, None)
        if obj is None:
            return ""
    return obj if isinstance(obj, str) else ""


def verify(
    project: ProjectEvidence,
    payload: dict[str, Any],
    observations: str = "",
) -> ProvenanceReport:
    """
    Check a synthesised project against the operator's inputs.

    Returns a report. Never raises, never mutates the project.
    """
    corpus = build_source_corpus(payload, observations)
    corpus_digits = {_digits(tok) for tok in corpus.split() if any(c.isdigit() for c in tok)}
    corpus_digits.discard("")

    report = ProvenanceReport()
    seen: set[tuple[str, str]] = set()

    for path, label in _CHECKED_FIELDS:
        text = _resolve(project, path)
        if not text.strip():
            continue
        report.checkedFields.append(path)

        for match in _CERTIFICATION_RE.finditer(text):
            claim = match.group(0).strip()
            if _supported(claim, corpus, corpus_digits):
                continue
            if (claim.lower(), "certification") in seen:
                continue
            seen.add((claim.lower(), "certification"))
            report.findings.append(
                Finding(
                    severity="critical",
                    kind="certification",
                    claim=claim,
                    field=path,
                    message=(
                        f'"{claim}" appears in the {label} but was not in your '
                        "inputs. Remove it unless the project genuinely holds "
                        "this certification."
                    ),
                )
            )

        for match in _AWARD_RE.finditer(text):
            claim = match.group(0).strip()
            if _supported(claim, corpus, corpus_digits):
                continue
            if (claim.lower(), "award") in seen:
                continue
            seen.add((claim.lower(), "award"))
            report.findings.append(
                Finding(
                    severity="critical",
                    kind="award",
                    claim=claim,
                    field=path,
                    message=(
                        f'"{claim}" claims recognition that was not in your '
                        f"inputs. Verify it before publishing."
                    ),
                )
            )

        for match in _NUMBER_RE.finditer(text):
            claim = match.group(0).strip()
            if _BENIGN_NUMBERS.match(claim):
                continue
            if _supported(claim, corpus, corpus_digits):
                continue
            if (claim.lower(), "quantity") in seen:
                continue
            seen.add((claim.lower(), "quantity"))
            report.findings.append(
                Finding(
                    severity="warning",
                    kind="quantity",
                    claim=claim,
                    field=path,
                    message=(
                        f'The figure "{claim}" in the {label} does not appear '
                        "in your inputs. Confirm it against your records or "
                        "replace it with a qualitative statement."
                    ),
                )
            )

    return report
