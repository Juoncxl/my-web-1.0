import type { Asset } from '../types';
import { readWithBoundedRetry } from './boundedReadRetry';

type DetailReadResult<TAsset> = { data: TAsset[]; error: string | null };
type SequenceRef = { current: number };

export function isCurrentDetailOpen(
  request: { sequence: number; scopeKey: string },
  currentSequence: number,
  currentScopeKey: string
): boolean {
  return request.sequence === currentSequence && request.scopeKey === currentScopeKey;
}

export function shouldRetryOwnerDetailRead(options: {
  vercelOwnerAuth: boolean;
  currentUserId?: string;
  publicOnly?: boolean;
  creatorSlug?: string;
  scopedUserId?: string;
}): boolean {
  if (!options.vercelOwnerAuth || !options.currentUserId || options.publicOnly) return false;
  return !options.creatorSlug || options.scopedUserId === options.currentUserId;
}

type AssetDetailReadOptions<TAsset> = {
  sequence: SequenceRef;
  isScopeCurrent: () => boolean;
  retryOwnerTransient: boolean;
  read: () => Promise<DetailReadResult<TAsset>>;
  reportError: (message: string | null) => void;
  commit: (asset: TAsset, isCurrent: () => boolean) => void;
  delayMs?: number;
};

/** Fetch one full Work and guard both transient recovery and state commits by selection/scope. */
export async function loadAssetDetailWithBoundedRetry<TAsset extends Asset>(
  options: AssetDetailReadOptions<TAsset>
): Promise<TAsset | null> {
  const requestSequence = ++options.sequence.current;
  const isCurrent = () => options.sequence.current === requestSequence && options.isScopeCurrent();
  if (!isCurrent()) return null;

  let result: DetailReadResult<TAsset>;
  try {
    result = await readWithBoundedRetry(options.read, {
      enabled: options.retryOwnerTransient,
      isCurrent,
      getError: value => value.error,
      delayMs: options.delayMs
    });
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }

  if (!isCurrent()) return null;
  if (result.error) {
    options.reportError(result.error);
    return null;
  }
  const asset = result.data[0];
  if (!asset || !isCurrent()) return null;
  options.commit(asset, isCurrent);
  return isCurrent() ? asset : null;
}
