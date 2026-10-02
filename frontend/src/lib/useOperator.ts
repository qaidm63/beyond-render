import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type SessionResponse } from './api';
import { supabase, supabaseConfigured } from './supabase';

export type OperatorState =
  | { status: 'checking' }
  | { status: 'unconfigured'; reason: string }
  | { status: 'signed-out' }
  | { status: 'denied'; reason: string }
  | { status: 'authorised'; operator: SessionResponse };

/**
 * Resolves the operator session.
 *
 * Authorisation is decided by the BACKEND, never here: we only hold a token
 * and ask the server what it is worth. A Supabase session that the backend
 * rejects (not on the allowlist) surfaces as 'denied', not 'authorised'.
 */
export function useOperator() {
  const [state, setState] = useState<OperatorState>({ status: 'checking' });

  const verify = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      setState({
        status: 'unconfigured',
        reason:
          'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set for this build.',
      });
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState({ status: 'signed-out' });
      return;
    }

    try {
      const operator = await api.session();
      setState({ status: 'authorised', operator });
    } catch (err) {
      if (err instanceof ApiError && err.isAuthFailure) {
        setState({
          status: 'denied',
          reason:
            'This account is signed in but is not an authorised operator.',
        });
        return;
      }
      setState({
        status: 'denied',
        reason: err instanceof Error ? err.message : 'Verification failed.',
      });
    }
  }, []);

  useEffect(() => {
    void verify();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void verify();
    });
    return () => sub.subscription.unsubscribe();
  }, [verify]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setState({ status: 'signed-out' });
  }, []);

  return { state, refresh: verify, signOut };
}
