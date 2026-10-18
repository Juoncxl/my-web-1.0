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
 * Keep localhost in its isolated QA sandbox by default, while every deployed
 * Vite build uses its real backends. Data now lives in Google Sheets/Drive, so a
 * deployed build no longer needs the Supabase client values to leave the
 * sandbox. An explicit `mock` value always wins, which preserves an intentional
 * hosted QA sandbox. ('supabase' is the historical name of the non-mock mode.)
 */
export function resolvePersistenceMode(environment: PersistenceEnvironment): PersistenceMode {
  const configuredMode = String(environment.VITE_PERSISTENCE_MODE || '').trim().toLowerCase();
  if (configuredMode === 'mock') return 'mock';
  if (configuredMode === 'supabase') return 'supabase';

  const runtimeMode = String(environment.MODE || '').trim().toLowerCase();
  if (runtimeMode === 'test') return 'supabase';

  const isDeployedBuild = environment.PROD === true || String(environment.PROD).toLowerCase() === 'true';
  return isDeployedBuild ? 'supabase' : 'mock';
}

export const persistenceMode: PersistenceMode = resolvePersistenceMode(env);
export const isMockPersistence = persistenceMode === 'mock';
export const persistenceModeLabel = isMockPersistence ? 'QA Sandbox · Local only' : 'Production';
