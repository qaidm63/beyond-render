import { useEffect, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  DatabaseZap,
  Clock,
  Send,
  Radar as RadarIcon,
  KeyRound,
} from 'lucide-react';
import {
  api,
  ApiError,
  type IngestReport,
  type SchedulerState,
  type KeyringState,
} from '@/lib/api';

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
  const [scheduler, setScheduler] = useState<SchedulerState | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [opsNotice, setOpsNotice] = useState<string | null>(null);
  const [keyring, setKeyring] = useState<KeyringState | null>(null);

  useEffect(() => {
    api
      .telemetry()
      .then((d) => setData(d as Record<string, number>))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load telemetry.'),
      )
      .finally(() => setLoading(false));

    // Scheduler state is supplementary: its failure must not blank the page.
    api.scheduler().then(setScheduler).catch(() => setScheduler(null));
    api.keyring().then(setKeyring).catch(() => setKeyring(null));
  }, []);

  async function runSweep() {
    setSweeping(true);
    setError(null);
    setOpsNotice(null);
    try {
      const report = await api.runScheduledSweep();
      setOpsNotice(
        report.error
          ? `Sweep failed: ${String(report.error)}`
          : `Sweep finished — ${report.accepted_count ?? 0} accepted, ` +
            `${report.rejected_count ?? 0} rejected.`,
      );
      setScheduler(await api.scheduler());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sweep failed.');
    } finally {
      setSweeping(false);
    }
  }

  async function sendTestAlert() {
    setAlerting(true);
    setError(null);
    setOpsNotice(null);
    try {
      const result = await api.testAlert();
      setOpsNotice(
        result.delivered
          ? 'Telegram alert delivered — check your chat.'
          : 'Telegram is configured but the message was rejected. Verify the ' +
            'bot token and that you have sent /start to the bot.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Alert test failed.');
    } finally {
      setAlerting(false);
    }
  }

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

      <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Automation
        </h3>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono">
          <span className="text-zinc-600">Scheduler</span>
          <span className={scheduler?.enabled ? 'text-emerald-400' : 'text-zinc-500'}>
            {scheduler
              ? scheduler.enabled
                ? `every ${scheduler.intervalMinutes} min`
                : 'disabled'
              : 'unknown'}
          </span>

          <span className="text-zinc-600">Telegram</span>
          <span
            className={
              scheduler?.telegramConfigured ? 'text-emerald-400' : 'text-amber-400'
            }
          >
            {scheduler?.telegramConfigured ? 'configured' : 'not configured'}
          </span>

          <span className="text-zinc-600">Runs / failures</span>
          <span className="text-zinc-400">
            {scheduler?.runCount ?? 0} / {scheduler?.failureCount ?? 0}
          </span>

          <span className="text-zinc-600">Last finished</span>
          <span className="text-zinc-400">
            {scheduler?.lastFinishedAt
              ? new Date(scheduler.lastFinishedAt).toLocaleString()
              : 'never'}
          </span>
        </div>

        {scheduler?.lastError && (
          <p className="text-[11px] text-red-300/80 font-mono break-all">
            last error: {scheduler.lastError}
          </p>
        )}

        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Automatic sweeps are opt-in: set <code>SWEEP_INTERVAL_MINUTES</code>{' '}
          in <code>.env</code> and restart the API. Enable it in one process
          only.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void runSweep()}
            disabled={sweeping}
            className="flex items-center gap-2 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 text-sm rounded-lg px-4 py-2 transition disabled:opacity-40"
          >
            {sweeping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RadarIcon className="w-4 h-4" />
            )}
            Run sweep now
          </button>

          <button
            onClick={() => void sendTestAlert()}
            disabled={alerting}
            className="flex items-center gap-2 border border-zinc-700 hover:border-sky-500/60 text-zinc-300 text-sm rounded-lg px-4 py-2 transition disabled:opacity-40"
          >
            {alerting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Test Telegram alert
          </button>
        </div>

        {opsNotice && (
          <p className="text-[11px] text-sky-200/90 leading-relaxed">{opsNotice}</p>
        )}
      </div>

      <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5" />
            Model key pool
          </h3>
          <button
            onClick={() => void api.keyring().then(setKeyring).catch(() => {})}
            className="text-[11px] text-zinc-500 hover:text-amber-400"
          >
            Refresh
          </button>
        </div>

        {!keyring ? (
          <p className="text-[11px] text-zinc-600">Unavailable.</p>
        ) : !keyring.configured ? (
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            {keyring.detail ?? 'No rotating keys configured.'}
          </p>
        ) : (
          <>
            <p className="text-[11px] font-mono text-zinc-500">
              {keyring.available}/{keyring.total} available · cooldown{' '}
              {keyring.cooldownSeconds}s
            </p>

            <ul className="space-y-1.5">
              {keyring.keys?.map((key) => (
                <li
                  key={key.label}
                  className="flex items-center justify-between gap-3 text-[11px] font-mono border border-zinc-900 rounded-lg px-3 py-2"
                >
                  <span className="text-zinc-400">{key.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-zinc-600">
                      ✓{key.successCount} ✕{key.failureCount}
                    </span>
                    <span
                      className={
                        key.state === 'closed'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {key.state === 'closed'
                        ? 'healthy'
                        : `isolated ${key.cooldownRemaining}s`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {keyring.models && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono pt-1">
                <span className="text-zinc-600">Vision / DOM</span>
                <span className="text-zinc-400">{keyring.models.vision}</span>
                <span className="text-zinc-600">Analyst filter</span>
                <span className="text-zinc-400">{keyring.models.analyst}</span>
                <span className="text-zinc-600">Tailor</span>
                <span className="text-zinc-400">{keyring.models.tailor}</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
