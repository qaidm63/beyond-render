import { useState } from 'react';
import { Radar as RadarIcon, SlidersHorizontal, FlaskConical, Activity, LibraryBig, LogOut } from 'lucide-react';
import { useOperator } from '@/lib/useOperator';
import Radar from './modules/Radar';
import SwarmConfigurator from './modules/SwarmConfigurator';
import PitchStudio from './modules/PitchStudio';
import Telemetry from './modules/Telemetry';
import PortfolioStudio from './modules/PortfolioStudio';

/** Command Center — Blueprint § 5. */

const TABS = [
  { key: 'radar', label: 'Radar', icon: RadarIcon, render: () => <Radar /> },
  {
    key: 'swarm',
    label: 'Swarm',
    icon: SlidersHorizontal,
    render: () => <SwarmConfigurator />,
  },
  { key: 'pitch', label: 'Pitch Studio', icon: FlaskConical, render: () => <PitchStudio /> },
  { key: 'telemetry', label: 'Telemetry', icon: Activity, render: () => <Telemetry /> },
  { key: 'portfolio', label: 'Portfolio Studio', icon: LibraryBig, render: () => <PortfolioStudio /> },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CommandCenter() {
  const [active, setActive] = useState<TabKey>('radar');
  const { state, signOut } = useOperator();
  const current = TABS.find((t) => t.key === active)!;

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-200">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400">
              Shadow Matrix
            </span>
            <h1 className="text-2xl font-bold text-white">Command Center</h1>
          </div>
          <div className="flex items-center gap-4">
            {state.status === 'authorised' && (
              <span className="text-[11px] font-mono text-zinc-600">
                {state.operator.email}
              </span>
            )}
            <button
              onClick={() => void signOut()}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 border transition ${
                active === tab.key
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <main>{current.render()}</main>
      </div>
    </div>
  );
}
