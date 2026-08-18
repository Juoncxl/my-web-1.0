import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('creator_vault_supabase_url');
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('creator_vault_supabase_key');

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch (e) {
      console.warn('Supabase initialization error:', e);
      return null;
    }
  }

  return null;
}

export function saveCustomSupabaseConfig(url: string, key: string) {
  if (url && key) {
    localStorage.setItem('creator_vault_supabase_url', url);
    localStorage.setItem('creator_vault_supabase_key', key);
    supabaseInstance = createClient(url, key);
  } else {
    localStorage.removeItem('creator_vault_supabase_url');
    localStorage.removeItem('creator_vault_supabase_key');
    supabaseInstance = null;
  }
}
