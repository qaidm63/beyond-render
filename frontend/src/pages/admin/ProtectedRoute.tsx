import { ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useOperator } from '@/lib/useOperator';
import LoginPage from './LoginPage';

/**
 * Admin route guard — Blueprint § 5 ("Protected Route").
 *
 * This component controls what is RENDERED, not what is PERMITTED. Every
 * protected endpoint re-verifies the operator's JWT server-side, so bypassing
 * this guard in the browser yields nothing but 401s.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { state, signOut } = useOperator();

  if (state.status === 'checking') {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-3" />
        <span className="font-mono text-sm">Verifying operator session…</span>
      </div>
    );
  }

  if (state.status === 'unconfigured') {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center px-6">
        <div className="max-w-md w-full border border-amber-900/40 bg-amber-950/10 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-white font-semibold text-xl">
            Authentication Not Configured
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">{state.reason}</p>
        </div>
      </div>
    );
  }

  if (state.status === 'signed-out') {
    return <LoginPage />;
  }

  if (state.status === 'denied') {
    return (
      <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center px-6 gap-4">
        <LoginPage notice={state.reason} />
        <button
          onClick={() => void signOut()}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline"
        >
          Sign out of the current account
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
