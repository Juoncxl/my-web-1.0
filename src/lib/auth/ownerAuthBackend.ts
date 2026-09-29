export type OwnerAuthBackend = 'supabase' | 'vercel';

/** Unknown/missing build values keep the existing Supabase path as the safe default. */
export function selectOwnerAuthBackend(value: unknown): OwnerAuthBackend {
  return String(value || '').trim().toLowerCase() === 'vercel' ? 'vercel' : 'supabase';
}

const env = (import.meta as any).env || {};
export const ownerAuthBackend = selectOwnerAuthBackend(env.VITE_CXL_OWNER_AUTH_BACKEND);
export const isVercelOwnerAuth = ownerAuthBackend === 'vercel';
