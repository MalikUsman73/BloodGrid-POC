import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import type { Repository } from './types';

export * from './types';
export * from './sectors';
export { poolHash } from './hash';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** The database when configured, otherwise the in-memory fallback. */
export function createRepository(): Repository {
  return url && key ? new SupabaseRepository(url, key) : new LocalRepository();
}
