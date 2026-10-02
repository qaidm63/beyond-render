import { Radar, SlidersHorizontal, FlaskConical, Activity } from 'lucide-react';

/**
 * Command Center — Blueprint § 5.
 * Phase 1 delivers the shell and the four module slots. Phase 3 fills them
 * with live data from FastAPI.
 */

const MODULES = [
  {
    key: 'radar',
    icon: Radar,
    title: 'The Radar',
    subtitle: 'Scout Pipeline — Kanban',
    detail: 'Discovered → High Match → Ready to Apply → Applied',
    phase: 'Phase 3',
  },
  {
    key: 'configurator',
    icon: SlidersHorizontal,
    title: 'Swarm Configurator',
    subtitle: 'SearchConfiguration toggles',
    detail: 'Work model · Target locations · Contract type · Fit threshold',
    phase: 'Phase 3',
  },
  {
    key: 'studio',
    icon: FlaskConical,
    title: 'Dynamic Pitch Studio',
    subtitle: 'Cover letter review & VIP link',
    detail: 'Preview, approve and mint the /vip/:companyId route',
    phase: 'Phase 4',
  },
  {
    key: 'telemetry',
    icon: Activity,
    title: 'Telemetry',
    subtitle: 'Match stats & recruiter clicks',
    detail: 'Fit-score distribution, conversion, VIP page engagement',
    phase: 'Phase 4',
  },
] as const;

export default function CommandCenter() {
  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-200 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-amber-400">
            Shadow Matrix
          </span>
          <h1 className="text-3xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-zinc-500">
            Operator console for the autonomous scout swarm.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {MODULES.map((m) => (
            <section
              key={m.key}
              className="border border-zinc-800 bg-zinc-950/60 rounded-2xl p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <m.icon className="w-6 h-6 text-amber-400 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 border border-zinc-800 rounded px-2 py-1">
                  {m.phase}
                </span>
              </div>
              <div>
                <h2 className="text-white font-semibold">{m.title}</h2>
                <p className="text-xs text-amber-400/70 font-mono">
                  {m.subtitle}
                </p>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{m.detail}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
