import type { SupabaseClient } from '@supabase/supabase-js';
import { LocalAuth } from '../auth/localAuth';
import { SupabaseAuth } from '../auth/supabaseAuth';
import type { AuthService } from '../auth/types';
import { createSupabaseClient } from '../data/client';
import { LocalRepository } from '../data/localRepository';
import { SupabaseRepository } from '../data/supabaseRepository';
import type { Repository } from '../data';

export interface Backend {
  mode: 'supabase' | 'local';
  repo: Repository;
  auth: AuthService;
  client: SupabaseClient | null;
}

export function createLocalBackend(): Backend {
  const repo = new LocalRepository();
  return { mode: 'local', repo, auth: new LocalAuth(repo), client: null };
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const client = createSupabaseClient(url, key);
  return { mode: 'supabase', repo: new SupabaseRepository(client), auth: new SupabaseAuth(client), client };
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** The database when it is configured, otherwise the in-browser demo backend. */
export function createBackend(): Backend {
  return url && key ? createSupabaseBackend(url, key) : createLocalBackend();
}
