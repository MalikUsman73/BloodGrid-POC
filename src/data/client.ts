import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * One client for the whole app, so the database calls and the sign-in session are the same thing.
 * PKCE keeps confirmation links as ?code=… rather than a #fragment, which the hash router would swallow.
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
}
