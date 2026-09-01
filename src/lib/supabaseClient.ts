import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidSupabaseKey, isValidSupabaseUrl } from './apiHelper';

const env = (import.meta as any).env || {};

export const SUPABASE_URL = String(env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigStatus = {
  urlConfigured: isValidSupabaseUrl(SUPABASE_URL),
  anonKeyConfigured: isValidSupabaseKey(SUPABASE_ANON_KEY)
};

export const isSupabaseConfigured = Boolean(
  supabaseConfigStatus.urlConfigured && supabaseConfigStatus.anonKeyConfigured
);

export function isLocalRuntime(): boolean {
  if ((import.meta as any).env?.DEV) return true;
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

let clientInstance: SupabaseClient | null = null;
let didLogUnavailableClient = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    if (isLocalRuntime() && !didLogUnavailableClient) {
      didLogUnavailableClient = true;
      console.warn('[supabase:config] client unavailable', {
        url: supabaseConfigStatus.urlConfigured ? 'configured' : 'missing',
        anonKey: supabaseConfigStatus.anonKeyConfigured ? 'configured' : 'missing'
      });
    }
    return null;
  }
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
    if (isLocalRuntime()) {
      console.warn('[supabase:client-init] failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown client initialization error'
      });
    }
    return null;
  }
}

export const supabase = getSupabaseClient();
