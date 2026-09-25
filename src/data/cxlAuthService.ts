import { supabaseAuthAdapter } from './adapters/supabase/supabaseAuthAdapter';

/** Separate application auth boundary; account behavior remains unchanged. */
export const cxlAuthService = supabaseAuthAdapter;
