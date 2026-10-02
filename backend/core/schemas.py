"""
Shadow Matrix — Core data contracts (Pydantic mirror of frontend/src/types.ts).
Blueprint § 3.a.
"""

from __future__ import annotations

from datetime import datetime
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


class DecisionLog(BaseModel):
    challenge: str
    decision: str
    outcome: str


class EvidenceLayer(BaseModel):
    images: list[str] = Field(default_factory=list)
    technicalDrawings: list[str] = Field(default_factory=list)


class ProjectEvidence(BaseModel):
    projectId: str
    identity: ProjectIdentity
    decisionLog: DecisionLog
    evidenceLayer: EvidenceLayer
    softwareStack: list[str] = Field(default_factory=list)

    def to_embedding_document(self) -> str:
        """
        Flatten this project into the text that gets embedded into pgvector.

        The decision log is weighted first because engineering judgement is the
        highest-signal content for matching against job descriptions.
        """
        return "\n".join(
            [
                f"Project: {self.identity.title}",
                f"Category: {self.identity.category.value}",
                f"Status: {self.identity.status.value}",
                f"Challenge: {self.decisionLog.challenge}",
                f"Decision: {self.decisionLog.decision}",
                f"Outcome: {self.decisionLog.outcome}",
                "Scope: " + "; ".join(self.identity.scope),
                "Software: " + ", ".join(self.softwareStack),
            ]
        )


class ScoutEngine(str, Enum):
    XHR = "xhr"
    DOM = "dom"


class PipelineStage(str, Enum):
    DISCOVERED = "discovered"
    HIGH_MATCH = "high_match"
    READY_TO_APPLY = "ready_to_apply"
    APPLIED = "applied"


class JobOpportunity(BaseModel):
    id: str
    title: str
    company: str
    companyId: str
    location: str | None = None
    url: str
    source: str
    engine: ScoutEngine
    description: str | None = None
    fitScore: float | None = None
    stage: PipelineStage = PipelineStage.DISCOVERED
    discoveredAt: datetime


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
