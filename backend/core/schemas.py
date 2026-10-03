"""
Shadow Matrix — Core data contracts (Pydantic mirror of frontend/src/types.ts).
Blueprint § 3.a.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class ProjectCategory(str, Enum):
    RESIDENTIAL = "Residential"
    COMMERCIAL = "Commercial"
    URBAN_PLANNING = "Urban Planning"
    TECHNICAL = "Technical"


class ProjectStatus(str, Enum):
    COMPLETED = "Completed"
    IN_PROGRESS = "In Progress"
    CONCEPT = "Concept"


class ProjectIdentity(BaseModel):
    title: str
    category: ProjectCategory
    status: ProjectStatus
    scope: list[str] = Field(default_factory=list)
    # Added by the Portfolio Studio. Optional so the four pre-existing
    # projects keep validating without a migration.
    tagline: str | None = None


class DecisionLog(BaseModel):
    challenge: str
    decision: str
    outcome: str


class SpatialFramework(BaseModel):
    """
    The design reasoning a recruiter actually interrogates.

    Separate from `decisionLog` on purpose: the decision log is one narrative
    arc (problem -> move -> result), while this is the standing systemic
    position of the project.
    """

    circulationStrategy: str = ""
    materialityAndAtmosphere: str = ""
    sustainabilityFramework: str = ""

    def is_populated(self) -> bool:
        return any(
            field.strip()
            for field in (
                self.circulationStrategy,
                self.materialityAndAtmosphere,
                self.sustainabilityFramework,
            )
        )


class EvidenceLayer(BaseModel):
    images: list[str] = Field(default_factory=list)
    technicalDrawings: list[str] = Field(default_factory=list)


class ProjectEvidence(BaseModel):
    projectId: str
    identity: ProjectIdentity
    decisionLog: DecisionLog
    evidenceLayer: EvidenceLayer
    softwareStack: list[str] = Field(default_factory=list)
    # --- Portfolio Studio additions (all optional, all backward-compatible) ---
    spatialFramework: SpatialFramework | None = None
    recruiterPitch: str | None = None

    def to_embedding_document(self) -> str:
        """
        Flatten this project into the text that gets embedded into pgvector.

        The decision log is weighted first because engineering judgement is the
        highest-signal content for matching against job descriptions.
        """
        parts = [
            f"Project: {self.identity.title}",
            f"Category: {self.identity.category.value}",
            f"Status: {self.identity.status.value}",
            f"Challenge: {self.decisionLog.challenge}",
            f"Decision: {self.decisionLog.decision}",
            f"Outcome: {self.decisionLog.outcome}",
            "Scope: " + "; ".join(self.identity.scope),
            "Software: " + ", ".join(self.softwareStack),
        ]

        if self.identity.tagline:
            parts.insert(1, f"Tagline: {self.identity.tagline}")

        # Spatial reasoning is high-signal for matching, so it joins the
        # document. Changing this text changes the content hash, which is
        # exactly what should force a re-embed.
        if self.spatialFramework and self.spatialFramework.is_populated():
            parts += [
                f"Circulation: {self.spatialFramework.circulationStrategy}",
                f"Materiality: {self.spatialFramework.materialityAndAtmosphere}",
                f"Sustainability: {self.spatialFramework.sustainabilityFramework}",
            ]

        if self.recruiterPitch:
            parts.append(f"Positioning: {self.recruiterPitch}")

        return "\n".join(parts)


class ScoutEngine(str, Enum):
    XHR = "xhr"
    DOM = "dom"


class PipelineStage(str, Enum):
    DISCOVERED = "discovered"
    HIGH_MATCH = "high_match"
    READY_TO_APPLY = "ready_to_apply"
    APPLIED = "applied"


class JobOpportunity(BaseModel):
    """A single scouted posting as it travels through the swarm."""

    # Stable cross-run identity, computed by the scout (see scout.fingerprint).
    fingerprint: str
    title: str
    company: str
    companyId: str
    url: str
    source: str
    engine: ScoutEngine
    id: str | None = None
    location: str | None = None
    description: str | None = None
    contractType: str | None = None
    isRemote: bool | None = None
    # Populated by the Analyst Agent (Layer 3).
    fitScore: float | None = None
    bestProjectId: str | None = None
    rejectionReason: str | None = None
    stage: PipelineStage = PipelineStage.DISCOVERED
    postedAt: datetime | None = None
    discoveredAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_matching_document(self) -> str:
        """Flatten the posting into the text embedded for gatekeeping."""
        parts = [f"Job title: {self.title}", f"Company: {self.company}"]
        if self.location:
            parts.append(f"Location: {self.location}")
        if self.contractType:
            parts.append(f"Contract: {self.contractType}")
        if self.description:
            parts.append(f"Description: {self.description}")
        return "\n".join(parts)


class Pitch(BaseModel):
    companyId: str
    companyName: str
    jobId: str
    coverLetter: str
    featuredProjectIds: list[str] = Field(default_factory=list)
    approved: bool = False
    viewCount: int = 0
    createdAt: datetime


class TelemetrySnapshot(BaseModel):
    totalDiscovered: int = 0
    totalHighMatch: int = 0
    totalApplied: int = 0
    averageFitScore: float = 0.0
    recruiterClicks: int = 0


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    database: str
