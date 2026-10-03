import { useState } from 'react';
import { Radar as RadarIcon, SlidersHorizontal, FlaskConical, Activity, LibraryBig, LogOut } from 'lucide-react';
import { useOperator } from '@/lib/useOperator';
import { LanguageToggle, useLanguage, type AdminDictionary } from '@/i18n';
import Radar from './modules/Radar';
import SwarmConfigurator from './modules/SwarmConfigurator';
import PitchStudio from './modules/PitchStudio';
import Telemetry from './modules/Telemetry';
import PortfolioStudio from './modules/PortfolioStudio';

/** Command Center — Blueprint § 5. */

/** Labels resolve per render so the nav re-labels on a language switch. */
const TABS = [
  {
    key: 'radar',
    label: (t: AdminDictionary) => t.tabRadar,
    icon: RadarIcon,
    render: () => <Radar />,
  },
  {
    key: 'swarm',
    label: (t: AdminDictionary) => t.tabSwarm,
    icon: SlidersHorizontal,
    render: () => <SwarmConfigurator />,
  },
  {
    key: 'pitch',
    label: (t: AdminDictionary) => t.tabPitch,
    icon: FlaskConical,
    render: () => <PitchStudio />,
  },
  {
    key: 'telemetry',
    label: (t: AdminDictionary) => t.tabTelemetry,
    icon: Activity,
    render: () => <Telemetry />,
  },
  {
    key: 'portfolio',
    label: (t: AdminDictionary) => t.tabPortfolio,
    icon: LibraryBig,
    render: () => <PortfolioStudio />,
  },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CommandCenter() {
  const [active, setActive] = useState<TabKey>('radar');
  const { state, signOut } = useOperator();
  const { t, dir } = useLanguage();
  const current = TABS.find((t) => t.key === active)!;

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-200" dir={dir}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400">
              {t.brand}
            </span>
            <h1 className="text-2xl font-bold text-white">{t.commandCenter}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {state.status === 'authorised' && (
              <span className="text-[11px] font-mono text-zinc-600" dir="ltr">
                {state.operator.email}
              </span>
            )}
            <button
              onClick={() => void signOut()}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> {t.signOut}
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
              {tab.label(t)}
            </button>
          ))}
        </nav>

        <main>{current.render()}</main>
      </div>
    </div>
  );
}
