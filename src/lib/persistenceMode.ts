export type PersistenceMode = 'mock' | 'supabase';

const env = (import.meta as any).env || {};

interface PersistenceEnvironment {
  VITE_PERSISTENCE_MODE?: unknown;
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
  MODE?: unknown;
  DEV?: unknown;
  PROD?: unknown;
}

/**
 * Keep localhost in its isolated QA sandbox by default, while ensuring every
 * deployed Vite build (including Vercel Preview deployments) uses Supabase
 * whenever the public client configuration is present. An explicit `mock`
 * value always wins, which preserves an intentional hosted QA sandbox.
 */
export function resolvePersistenceMode(environment: PersistenceEnvironment): PersistenceMode {
  const configuredMode = String(environment.VITE_PERSISTENCE_MODE || '').trim().toLowerCase();
  if (configuredMode === 'mock') return 'mock';
  if (configuredMode === 'supabase') return 'supabase';

  const runtimeMode = String(environment.MODE || '').trim().toLowerCase();
  if (runtimeMode === 'test') return 'supabase';

  const hasSupabaseConfig = Boolean(
    String(environment.VITE_SUPABASE_URL || '').trim()
    && String(environment.VITE_SUPABASE_ANON_KEY || '').trim()
  );
  const isDeployedBuild = environment.PROD === true || String(environment.PROD).toLowerCase() === 'true';
  return isDeployedBuild && hasSupabaseConfig ? 'supabase' : 'mock';
}

export const persistenceMode: PersistenceMode = resolvePersistenceMode(env);
export const isMockPersistence = persistenceMode === 'mock';
export const persistenceModeLabel = isMockPersistence ? 'QA Sandbox · Local only' : 'Supabase production';
