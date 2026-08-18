import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables or localStorage overrides
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('creator_vault_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('creator_vault_supabase_key') || '' : '';

export const SUPABASE_URL = (envUrl || storedUrl).trim();
export const SUPABASE_ANON_KEY = (envKey || storedKey).trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http') && 
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY.length > 20
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('creator_vault_supabase_url') || '';
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('creator_vault_supabase_key') || '';

  if (url && key && url.startsWith('http') && !url.includes('your-project') && key.length > 20) {
    try {
      clientInstance = createClient(url.trim(), key.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      });
      return clientInstance;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

// Direct singleton export for direct usage: import { supabase } from '@/lib/supabaseClient'
export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
}) : null;

export function saveCustomSupabaseConfig(url: string, key: string): { success: boolean; error?: string } {
  const trimmedUrl = url.trim();
  const trimmedKey = key.trim();

  if (!trimmedUrl && !trimmedKey) {
    localStorage.removeItem('creator_vault_supabase_url');
    localStorage.removeItem('creator_vault_supabase_key');
    clientInstance = null;
    return { success: true };
  }

  if (!trimmedUrl.startsWith('http') || trimmedUrl.includes('your-project')) {
    return { success: false, error: 'รูปแบบ Supabase URL ไม่ถูกต้อง (เช่น https://xyz.supabase.co)' };
  }

  if (trimmedKey.length < 20) {
    return { success: false, error: 'Supabase Anon Key สั้นเกินไปหรือรูปแบบไม่ถูกต้อง' };
  }

  try {
    localStorage.setItem('creator_vault_supabase_url', trimmedUrl);
    localStorage.setItem('creator_vault_supabase_key', trimmedKey);
    clientInstance = createClient(trimmedUrl, trimmedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'ไม่สามารถเชื่อมต่อกับ Supabase ได้' };
  }
}
