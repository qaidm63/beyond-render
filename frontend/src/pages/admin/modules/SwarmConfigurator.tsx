import { useEffect, useState } from 'react';
import { Loader2, Save, AlertTriangle, Check, Play } from 'lucide-react';
import { api, ApiError, type SweepReport } from '@/lib/api';
import type { SearchConfiguration } from '@/types';

/** Swarm Configurator — Blueprint § 5.2: live SearchConfiguration toggles. */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-zinc-300 group"
    >
      <span
        className={`w-9 h-5 rounded-full border transition-colors relative shrink-0 ${
          checked
            ? 'bg-amber-500/80 border-amber-400'
            : 'bg-zinc-800 border-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5 left-1' : 'left-0.5'
          }`}
          style={{ transform: checked ? 'translateX(16px)' : undefined }}
        />
      </span>
      <span className="group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}

export default function SwarmConfigurator() {
  const [config, setConfig] = useState<SearchConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [report, setReport] = useState<SweepReport | null>(null);

  useEffect(() => {
    api
      .readConfig()
      .then(setConfig)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load config.'),
      )
      .finally(() => setLoading(false));
  }, []);

  function patch(update: Partial<SearchConfiguration>) {
    setConfig((current) => (current ? { ...current, ...update } : current));
    setSaved(false);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      setConfig(await api.writeConfig(config));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function runSweep() {
    setSweeping(true);
    setError(null);
    setReport(null);
    try {
      setReport(await api.runScout(true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sweep failed.');
    } finally {
      setSweeping(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading configuration…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{error ?? 'Configuration unavailable.'}</span>
      </div>
    );
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-white font-semibold">Swarm Configurator</h2>
        <p className="text-xs text-zinc-500">
          Live control matrix. Writes to <code>agent_config</code>.
        </p>
      </header>

      {error && (
        <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
          <legend className="text-xs font-mono uppercase tracking-wider text-zinc-500 px-2">
            Work Model
          </legend>
          <Toggle
            label="Remote worldwide"
            checked={config.workModel.remoteWorldwide}
            onChange={(v) =>
              patch({ workModel: { ...config.workModel, remoteWorldwide: v } })
            }
          />
          <Toggle
            label="On site"
            checked={config.workModel.onSite}
            onChange={(v) => patch({ workModel: { ...config.workModel, onSite: v } })}
          />
          <Toggle
            label="Hybrid"
            checked={config.workModel.hybrid}
            onChange={(v) => patch({ workModel: { ...config.workModel, hybrid: v } })}
          />
        </fieldset>

        <fieldset className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
          <legend className="text-xs font-mono uppercase tracking-wider text-zinc-500 px-2">
            Contract Type
          </legend>
          <Toggle
            label="Full time"
            checked={config.contractType.fullTime}
            onChange={(v) =>
              patch({ contractType: { ...config.contractType, fullTime: v } })
            }
          />
          <Toggle
            label="Project based"
            checked={config.contractType.projectBased}
            onChange={(v) =>
              patch({ contractType: { ...config.contractType, projectBased: v } })
            }
          />
          <Toggle
            label="Freelance"
            checked={config.contractType.freelance}
            onChange={(v) =>
              patch({ contractType: { ...config.contractType, freelance: v } })
            }
          />
        </fieldset>
      </div>

      <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
        <label className="block space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Target locations (comma separated)
          </span>
          <input
            value={config.targetLocations.join(', ')}
            onChange={(e) =>
              patch({
                targetLocations: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Fit Score threshold
          </span>
          <span className="text-2xl font-mono text-amber-400">
            {config.matchingThreshold}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={config.matchingThreshold}
          onChange={(e) => patch({ matchingThreshold: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Jobs scoring below this never reach the Radar. Lower it to widen the
          net and raise LLM cost; raise it to keep only near-exact matches.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-sm rounded-lg px-4 py-2 transition"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved' : 'Save configuration'}
        </button>

        <button
          onClick={() => void runSweep()}
          disabled={sweeping}
          className="flex items-center gap-2 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 text-sm rounded-lg px-4 py-2 transition disabled:opacity-40"
        >
          {sweeping ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run sweep now
        </button>
      </div>

      {report && (
        <div className="border border-zinc-800 bg-black/40 rounded-2xl p-5 space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Last sweep
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ['Raw', report.raw_count],
              ['Deduped', report.deduped_count],
              ['Accepted', report.accepted_count],
              ['Persisted', report.persisted_count],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-[10px] uppercase font-mono text-zinc-600">
                  {label}
                </p>
                <p className="text-amber-400 font-mono">{value}</p>
              </div>
            ))}
          </div>
          {report.warnings.length > 0 && (
            <ul className="space-y-1 pt-2">
              {report.warnings.map((w) => (
                <li key={w} className="text-[11px] text-amber-300/70">
                  · {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
