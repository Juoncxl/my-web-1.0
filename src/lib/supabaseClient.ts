import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

export const SUPABASE_URL = String(env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY.length > 20
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (clientInstance) return clientInstance;

  try {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    });
    return clientInstance;
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    return null;
  }
}

export const supabase = getSupabaseClient();
