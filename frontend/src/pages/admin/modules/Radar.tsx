import { useEffect, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  PenLine,
} from 'lucide-react';
import { api, ApiError, type JobRow } from '@/lib/api';
import type { PipelineStage } from '@/types';

/** The Radar — Blueprint § 5.1: Scout Pipeline Kanban. */

const COLUMNS: { stage: PipelineStage; label: string; hint: string }[] = [
  { stage: 'discovered', label: 'Discovered', hint: 'Below threshold or unscored' },
  { stage: 'high_match', label: 'High Match', hint: 'Passed the gatekeeper' },
  { stage: 'ready_to_apply', label: 'Ready to Apply', hint: 'Pitch approved' },
  { stage: 'applied', label: 'Applied', hint: 'Submitted' },
];

const NEXT_STAGE: Partial<Record<PipelineStage, PipelineStage>> = {
  discovered: 'high_match',
  high_match: 'ready_to_apply',
  ready_to_apply: 'applied',
};

function fitTone(score: number | null): string {
  if (score === null) return 'text-zinc-600 border-zinc-800';
  if (score >= 85) return 'text-emerald-300 border-emerald-900/60';
  if (score >= 70) return 'text-amber-300 border-amber-900/60';
  return 'text-zinc-500 border-zinc-800';
}

function JobCard({
  job,
  onMove,
  onDraft,
  busy,
  drafting,
}: {
  job: JobRow;
  onMove: (job: JobRow, stage: PipelineStage) => void;
  onDraft: (job: JobRow) => void;
  busy: boolean;
  drafting: boolean;
}) {
  const next = NEXT_STAGE[job.stage];
  // Drafting is only offered once the gatekeeper has cleared the job: an LLM
  // call per below-threshold posting is exactly the cost the gate prevents.
  const canDraft = job.stage === 'high_match' || job.stage === 'ready_to_apply';
  return (
    <article className="border border-zinc-800 bg-black/40 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm text-zinc-200 font-medium leading-snug">
          {job.title}
        </h4>
        <span
          className={`text-[10px] font-mono border rounded px-1.5 py-0.5 shrink-0 ${fitTone(
            job.fit_score,
          )}`}
        >
          {job.fit_score === null ? '—' : job.fit_score.toFixed(0)}
        </span>
      </div>

      <p className="text-xs text-zinc-500">{job.company}</p>
      {job.location && (
        <p className="text-[11px] text-zinc-600">{job.location}</p>
      )}

      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
        <span className="border border-zinc-800 rounded px-1.5 py-0.5">
          {job.engine}
        </span>
        <span>{job.source}</span>
      </div>

      {job.best_project_id && (
        <p className="text-[10px] text-amber-400/60 font-mono">
          ↳ {job.best_project_id}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1"
        >
          Open <ExternalLink className="w-3 h-3" />
        </a>
        {next && (
          <button
            disabled={busy}
            onClick={() => onMove(job, next)}
            className="text-[11px] text-amber-400/80 hover:text-amber-300 disabled:opacity-40"
          >
            Advance →
          </button>
        )}
        {canDraft && (
          <button
            disabled={drafting}
            onClick={() => onDraft(job)}
            title="Draft a tailored cover letter with the Tailor Agent"
            className="text-[11px] text-sky-400/80 hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 ml-auto"
          >
            {drafting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <PenLine className="w-3 h-3" />
            )}
            Draft
          </button>
        )}
      </div>
    </article>
  );
}

export default function Radar() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setJobs(await api.listJobs());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message} (HTTP ${err.status})`
          : 'Failed to load the pipeline.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function move(job: JobRow, stage: PipelineStage) {
    setMovingId(job.id);
    // Optimistic: the Kanban should feel immediate, and a failure rolls back.
    const previous = jobs;
    setJobs((current) =>
      current.map((j) => (j.id === job.id ? { ...j, stage } : j)),
    );
    try {
      await api.moveJob(job.id, stage);
    } catch {
      setJobs(previous);
      setError('Could not move that card — change reverted.');
    } finally {
      setMovingId(null);
    }
  }

  async function draft(job: JobRow) {
    setDraftingId(job.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.draftPitch(job.id);
      setNotice(
        `Draft saved for ${job.company} via ${result.generator}. ` +
          `It stays private at ${result.vipPath} until you approve it in the ` +
          `Pitch Studio.`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Drafting failed: ${err.message} (HTTP ${err.status})`
          : 'Drafting failed.',
      );
    } finally {
      setDraftingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">The Radar</h2>
          <p className="text-xs text-zinc-500">Scout pipeline · {jobs.length} records</p>
        </div>
        <button
          onClick={() => void load()}
          className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex gap-2 text-xs text-sky-200 bg-sky-950/20 border border-sky-900/40 rounded-lg p-3">
          <PenLine className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading pipeline…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const items = jobs.filter((j) => j.stage === column.stage);
            return (
              <div
                key={column.stage}
                className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-3 space-y-3 min-h-[160px]"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                      {column.label}
                    </h3>
                    <span className="text-[10px] text-zinc-600">{items.length}</span>
                  </div>
                  <p className="text-[10px] text-zinc-700">{column.hint}</p>
                </div>

                {items.length === 0 ? (
                  <p className="text-[11px] text-zinc-700 italic py-4 text-center">
                    Empty
                  </p>
                ) : (
                  items.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onMove={move}
                      onDraft={draft}
                      busy={movingId === job.id}
                      drafting={draftingId === job.id}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
