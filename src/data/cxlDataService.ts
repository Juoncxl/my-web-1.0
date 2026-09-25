import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';

/** Structural contract derived from the CXL operations implemented by adapters. */
export type CxlDataService = typeof supabaseDataAdapter;

/** Application-facing persistence boundary. GO 1 deliberately selects Supabase. */
export const cxlDataService: CxlDataService = supabaseDataAdapter;

export type { FetchAssetsOptions } from '../lib/supabaseService';
