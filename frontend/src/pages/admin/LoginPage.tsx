import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LanguageToggle, useLanguage } from '@/i18n';

/**
 * Operator sign-in. Credentials go straight to Supabase Auth — this app
 * never sees or stores a password.
 */
export default function LoginPage({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, dir } = useLanguage();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) setError(signInError.message);
    setBusy(false);
    // On success the auth listener in useOperator re-verifies against the API.
  }

  return (
    <div
      className="min-h-screen bg-[#07080c] flex items-center justify-center px-6"
      dir={dir}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 border border-zinc-800 bg-zinc-950/60 rounded-2xl p-8"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <KeyRound className="w-7 h-7 text-amber-400" />
            <LanguageToggle />
          </div>
          <h1 className="text-xl font-semibold text-white">{t.commandCenter}</h1>
          <p className="text-xs text-zinc-500">{t.operatorAccessOnly}</p>
        </div>

        {notice && (
          <div className="flex gap-2 text-xs text-amber-300/90 bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
            <span>{notice}</span>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {t.email}
          </span>
          <input
            type="email"
            dir="ltr"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/60 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {t.password}
          </span>
          <input
            type="password"
            dir="ltr"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/60 focus:outline-none"
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !supabase}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-sm rounded-lg py-2.5 transition"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t.signIn}
        </button>
      </form>
    </div>
  );
}
