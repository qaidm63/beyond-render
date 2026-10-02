import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, DatabaseZap } from 'lucide-react';
import { api, ApiError, type IngestReport } from '@/lib/api';

/** Telemetry — Blueprint § 5.4: match stats and recruiter clicks. */

const METRICS: { key: string; label: string; hint: string }[] = [
  { key: 'totalDiscovered', label: 'Discovered', hint: 'All scouted postings' },
  { key: 'totalHighMatch', label: 'High match', hint: 'Passed the gatekeeper' },
  { key: 'totalReadyToApply', label: 'Ready', hint: 'Pitch approved' },
  { key: 'totalApplied', label: 'Applied', hint: 'Submitted' },
  { key: 'averageFitScore', label: 'Avg fit score', hint: 'Across scored jobs' },
  { key: 'recruiterClicks', label: 'Recruiter views', hint: 'VIP page opens' },
  { key: 'totalPitches', label: 'Pitches', hint: 'Generated' },
];

export default function Telemetry() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);

  useEffect(() => {
    api
      .telemetry()
      .then((d) => setData(d as Record<string, number>))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load telemetry.'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function runIngest() {
    setIngesting(true);
    setError(null);
    setIngestReport(null);
    try {
      setIngestReport(await api.runIngest(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ingestion failed.');
    } finally {
      setIngesting(false);
    }
  }

  return (
    <section className="space-y-5 max-w-4xl">
      <header>
        <h2 className="text-white font-semibold">Telemetry</h2>
        <p className="text-xs text-zinc-500">Pipeline conversion and engagement.</p>
      </header>

      {error && (
        <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading metrics…
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {METRICS.map((metric) => (
            <div
              key={metric.key}
              className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-4 space-y-1"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">
                {metric.label}
              </p>
              <p className="text-2xl font-mono text-amber-400">
                {data?.[metric.key] ?? 0}
              </p>
              <p className="text-[10px] text-zinc-700">{metric.hint}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
          Portfolio embeddings
        </h3>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Re-run after editing <code>shared/portfolio_evidence.json</code>.
          Unchanged projects are skipped, so this is cheap to repeat.
        </p>
        <button
          onClick={() => void runIngest()}
          disabled={ingesting}
          className="flex items-center gap-2 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 text-sm rounded-lg px-4 py-2 transition disabled:opacity-40"
        >
          {ingesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DatabaseZap className="w-4 h-4" />
          )}
          Run ingestion
        </button>
        {ingestReport && (
          <p className="text-[11px] font-mono text-zinc-500">
            embedded={ingestReport.embedded.length} · skipped=
            {ingestReport.skipped.length} · failed=
            {Object.keys(ingestReport.failed).length}
          </p>
        )}
      </div>
    </section>
  );
}
