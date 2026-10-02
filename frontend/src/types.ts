/**
 * Shadow Matrix — Unified Type Contracts
 * =====================================
 * Source of truth: Shadow_Matrix_Final_Blueprint § 3 (Core Data Schemas).
 *
 * These interfaces are mirrored by Pydantic models in `backend/core/schemas.py`.
 * Any change here MUST be reflected there — the ingestion pipeline that turns
 * portfolio projects into pgvector embeddings reads this exact shape.
 */

/* ------------------------------------------------------------------ */
/* § 3.a — Portfolio Source of Truth                                   */
/* ------------------------------------------------------------------ */

export type ProjectCategory =
  | 'Residential'
  | 'Commercial'
  | 'Urban Planning'
  | 'Technical';

export type ProjectStatus = 'Completed' | 'In Progress' | 'Concept';

export interface ProjectIdentity {
  title: string;
  category: ProjectCategory;
  status: ProjectStatus;
  /** Discrete deliverables — these are embedded for semantic matching. */
  scope: string[];
}

/**
 * The Decision Log is the highest-signal field for semantic matching:
 * it encodes *engineering judgement*, not just visual output.
 */
export interface DecisionLog {
  challenge: string;
  decision: string;
  outcome: string;
}

export interface EvidenceLayer {
  images: string[];
  technicalDrawings: string[];
}

export interface ProjectEvidence {
  projectId: string;
  identity: ProjectIdentity;
  decisionLog: DecisionLog;
  evidenceLayer: EvidenceLayer;
  softwareStack: string[];
}

/* ------------------------------------------------------------------ */
/* § 3.b — Search Configuration Matrix (table: agent_config)           */
/* ------------------------------------------------------------------ */

export interface WorkModel {
  remoteWorldwide: boolean;
  onSite: boolean;
  hybrid: boolean;
}

export interface ContractType {
  fullTime: boolean;
  projectBased: boolean;
  freelance: boolean;
}

export interface SearchConfiguration {
  workModel: WorkModel;
  targetLocations: string[];
  contractType: ContractType;
  /** Fit Score gate enforced by the Semantic Gatekeeper. Default: 85. */
  matchingThreshold: number;
}

/* ------------------------------------------------------------------ */
/* § 4 — The Swarm: scout pipeline contracts                           */
/* ------------------------------------------------------------------ */

/** Which engine tier produced a job record. */
export type ScoutEngine = 'xhr' | 'dom';

/** § 5 — Radar Kanban columns. */
export type PipelineStage =
  | 'discovered'
  | 'high_match'
  | 'ready_to_apply'
  | 'applied';

export interface JobOpportunity {
  /** Stable cross-run identity: sha256 of the posting URL. */
  fingerprint: string;
  title: string;
  company: string;
  companyId: string;
  url: string;
  source: string;
  engine: ScoutEngine;
  id?: string | null;
  location?: string | null;
  description?: string | null;
  contractType?: string | null;
  isRemote?: boolean | null;
  /** 0–100. Produced by the Analyst Agent via pgvector similarity. */
  fitScore?: number | null;
  /** Which portfolio project matched best — drives Radar explainability. */
  bestProjectId?: string | null;
  rejectionReason?: string | null;
  stage: PipelineStage;
  postedAt?: string | null;
  discoveredAt: string;
}

/* ------------------------------------------------------------------ */
/* § 5.3 — Dynamic Pitch Studio                                        */
/* ------------------------------------------------------------------ */

export interface Pitch {
  companyId: string;
  companyName: string;
  jobId: string;
  coverLetter: string;
  /** Projects hand-picked (or auto-selected) for this company's VIP page. */
  featuredProjectIds: string[];
  approved: boolean;
  viewCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* § 5.4 — Telemetry                                                   */
/* ------------------------------------------------------------------ */

export interface TelemetrySnapshot {
  totalDiscovered: number;
  totalHighMatch: number;
  totalApplied: number;
  averageFitScore: number;
  recruiterClicks: number;
}

/* ------------------------------------------------------------------ */
/* Legacy presentational types (public site components)                */
/* ------------------------------------------------------------------ */
/* These back the existing showcase components. Phase 3 rebuilds those  */
/* views directly on `ProjectEvidence`; until then they remain so the   */
/* public site keeps rendering.                                         */

export interface ProjectDetails {
  location: string;
  area: string;
  scope: string;
  tech: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  desc: string;
  image: string;
  details: ProjectDetails;
  highlights: string[];
}

export interface BlueprintRoom {
  id: string;
  name: string;
  arabicName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  elevation: number;
  color: string;
  details: string;
  technicalDetails: string;
}
