/**
 * Thin typed client for the FastAPI backend.
 *
 * All requests are RELATIVE (`/api/...`). In development Vite proxies them to
 * the backend; in production the reverse proxy does. The browser must never
 * hold a Supabase service key or address the backend host directly.
 *
 * Every request carries the operator's Supabase access token when one exists.
 * The backend re-verifies it — the token is a claim, not a grant.
 */

import type {
  JobOpportunity,
  PipelineStage,
  Pitch,
  SearchConfiguration,
  TelemetrySnapshot,
} from '@/types';
import { getAccessToken } from './supabase';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The session is missing, expired, or not allowlisted. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Response shapes                                                     */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  database: string;
}

export interface SessionResponse {
  authorised: boolean;
  userId: string;
  email: string;
  role: string;
}

export interface SweepReport {
  raw_count: number;
  deduped_count: number;
  prefiltered_count: number;
  scored_count: number;
  accepted_count: number;
  rejected_count: number;
  errored_count: number;
  persisted_count: number;
  engine_counts: Record<string, number>;
  warnings: string[];
}

export interface IngestReport {
  embedded: string[];
  skipped: string[];
  failed: Record<string, string>;
  ok: boolean;
}

/** Raw snake_case row as stored in Postgres. */
export interface JobRow {
  id: string;
  title: string;
  company: string;
  company_id: string;
  location: string | null;
  url: string;
  source: string;
  engine: string;
  fit_score: number | null;
  best_project_id: string | null;
  rejection_reason: string | null;
  stage: PipelineStage;
  discovered_at: string;
}

export interface PitchRow {
  company_id: string;
  company_name: string;
  job_id: string | null;
  cover_letter: string;
  featured_project_ids: string[];
  approved: boolean;
  view_count: number;
  created_at: string;
}

export interface PublicPitch {
  companyId: string;
  companyName: string;
  coverLetter: string;
  projects: {
    projectId: string;
    identity: {
      title: string;
      category: string;
      status: string;
      scope: string[];
    };
    decisionLog: { challenge: string; decision: string; outcome: string };
    softwareStack: string[];
  }[];
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const api = {
  health: () => request<HealthResponse>('/health'),
  session: () => request<SessionResponse>('/admin/session'),

  readConfig: () => request<SearchConfiguration>('/config'),
  writeConfig: (config: SearchConfiguration) =>
    request<SearchConfiguration>('/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  listJobs: (stage?: PipelineStage) =>
    request<JobRow[]>(`/jobs${stage ? `?stage=${stage}` : ''}`),
  moveJob: (jobId: string, stage: PipelineStage) =>
    request<{ id: string; stage: string }>(`/jobs/${jobId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    }),

  telemetry: () => request<TelemetrySnapshot & Record<string, number>>('/telemetry'),

  listPitches: () => request<PitchRow[]>('/pitches'),
  upsertPitch: (pitch: Partial<Pitch> & { companyId: string; companyName: string }) =>
    request<PitchRow>('/pitches', { method: 'POST', body: JSON.stringify(pitch) }),
  approvePitch: (companyId: string, approved: boolean) =>
    request<{ companyId: string; approved: boolean }>(
      `/pitches/${companyId}/approval`,
      { method: 'PATCH', body: JSON.stringify({ approved }) },
    ),
  publicPitch: (companyId: string) =>
    request<PublicPitch>(`/pitch/${encodeURIComponent(companyId)}`),

  runIngest: (force = false) =>
    request<IngestReport>('/ingest', {
      method: 'POST',
      body: JSON.stringify({ force, dryRun: false }),
    }),
  runScout: (useDom = true) =>
    request<SweepReport>('/scout/run', {
      method: 'POST',
      body: JSON.stringify({ useDom, dryRun: false }),
    }),
};

export type { JobOpportunity };
