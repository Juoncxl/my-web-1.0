import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidSupabaseUrl, isValidSupabaseKey, formatFriendlyErrorMessage } from './apiHelper';

let supabaseInstance: SupabaseClient | null = null;
let lastKnownValid = true;

/**
 * Returns a configured SupabaseClient if a valid URL and key are provided.
 * Ignores invalid URLs or placeholder templates to prevent unexpected HTML/JSON crashes.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('creator_vault_supabase_url');
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('creator_vault_supabase_key');

  if (url && key && isValidSupabaseUrl(url) && isValidSupabaseKey(key)) {
    try {
      supabaseInstance = createClient(url.trim(), key.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('Supabase client creation error:', e);
      supabaseInstance = null;
      return null;
    }
  }

  return null;
}

/**
 * Executes a Supabase operation safely, catching HTML response or JSON syntax errors.
 */
export async function safeSupabaseOperation<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<{ data: T | null; error: string | null; isHtmlError: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: 'Supabase client is not configured', isHtmlError: false };
  }

  try {
    const result = await operation(client);
    return { data: result, error: null, isHtmlError: false };
  } catch (err: any) {
    const friendly = formatFriendlyErrorMessage(err);
    const isHtmlError =
      friendly.includes('HTML') ||
      (typeof err?.message === 'string' &&
        (err.message.includes('Unexpected token') ||
          err.message.includes('is not valid JSON') ||
          err.message.includes('The page c')));

    console.warn('Safe Supabase caught error:', err);
    return {
      data: null,
      error: friendly,
      isHtmlError
    };
  }
}

/**
 * Saves or clears custom Supabase credentials from local storage
 */
export function saveCustomSupabaseConfig(url: string, key: string): { success: boolean; error?: string } {
  const trimmedUrl = url.trim();
  const trimmedKey = key.trim();

  if (!trimmedUrl && !trimmedKey) {
    localStorage.removeItem('creator_vault_supabase_url');
    localStorage.removeItem('creator_vault_supabase_key');
    supabaseInstance = null;
    return { success: true };
  }

  if (!isValidSupabaseUrl(trimmedUrl)) {
    return {
      success: false,
      error: 'รูปแบบ Supabase URL ไม่ถูกต้อง กรุณากรอก URL ในรูปแบบ https://[project-id].supabase.co'
    };
  }

  if (!isValidSupabaseKey(trimmedKey)) {
    return {
      success: false,
      error: 'รูปแบบ Supabase Anon Key ไม่ถูกต้อง'
    };
  }

  try {
    localStorage.setItem('creator_vault_supabase_url', trimmedUrl);
    localStorage.setItem('creator_vault_supabase_key', trimmedKey);
    supabaseInstance = createClient(trimmedUrl, trimmedKey);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'ไม่สามารถสร้างการเชื่อมต่อกับ Supabase ได้' };
  }
}
