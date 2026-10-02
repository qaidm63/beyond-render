import { ReactNode, useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Admin route guard — Blueprint § 5 ("Protected Route").
 *
 * PHASE 1 SCOPE: this is a *structural* guard only. It asks the backend
 * whether the current session is authorised; the backend currently answers
 * "not configured", so the Command Center is sealed by default.
 *
 * PHASE 3 will wire this to the real auth decision (Supabase Auth or a single
 * operator credential — pending the owner's decision). Nothing secret is ever
 * evaluated in the browser: the verdict always comes from the server.
 */

type AuthState = 'checking' | 'authorised' | 'denied';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('checking');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setState('authorised');
          return;
        }
        const body = await res.json().catch(() => ({}));
        setReason(body?.detail ?? `HTTP ${res.status}`);
        setState('denied');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReason(err instanceof Error ? err.message : 'Backend unreachable');
        setState('denied');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-3" />
        <span className="font-mono text-sm">Verifying operator session…</span>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center px-6">
        <div className="max-w-md w-full border border-red-900/40 bg-red-950/10 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-white font-semibold text-xl">
            Command Center Sealed
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Operator authentication is not yet configured. This route unlocks in
            Phase 3 once the auth strategy is selected.
          </p>
          {reason && (
            <p className="text-xs font-mono text-zinc-600 break-words">
              {reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
