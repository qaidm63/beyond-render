/**
 * Supabase browser client — operator authentication only.
 *
 * Uses the ANON key exclusively. The service key never reaches the browser;
 * all privileged data access goes through the FastAPI backend, which verifies
 * the resulting JWT server-side.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when the deployment has not been given Supabase credentials. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'shadow-matrix-auth',
        },
      })
    : null;

export const supabaseConfigured = supabase !== null;

/** Current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
