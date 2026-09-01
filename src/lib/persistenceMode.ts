export type PersistenceMode = 'mock' | 'supabase';

const env = (import.meta as any).env || {};
const configuredMode = String(env.VITE_PERSISTENCE_MODE || '').trim().toLowerCase();
const runtimeMode = String(env.MODE || '').trim().toLowerCase();

// Mock is the safe default. Production persistence must be explicitly opted in
// after Creator Space manual QA has passed.
export const persistenceMode: PersistenceMode = configuredMode === 'supabase' || (runtimeMode === 'test' && configuredMode !== 'mock') ? 'supabase' : 'mock';
export const isMockPersistence = persistenceMode === 'mock';
export const persistenceModeLabel = isMockPersistence ? 'QA Sandbox · Local only' : 'Supabase production';
