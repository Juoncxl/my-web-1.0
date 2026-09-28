type PublicWorkShape = {
  title?: unknown;
  visibility?: unknown;
  isPublic?: unknown;
  deletedAt?: unknown;
};

type WorkMutationResult = {
  data?: PublicWorkShape | null;
  error?: unknown;
};

const isPublicVisible = (work: PublicWorkShape | null | undefined) =>
  work?.visibility === 'public' && work.isPublic === true && !work.deletedAt;

/** Fire one anonymous request to refresh the public CDN entry, without affecting its caller. */
export function warmPublicWorksCache(): void {
  try {
    void fetch('/api/cxl/public-works', {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json', Pragma: 'no-cache' }
    }).catch(() => undefined);
  } catch {
    // Warming is best-effort, including synchronous fetch failures.
  }
}

/** Rebuild first; warm only after success and never let warming change the result. */
export async function rebuildPublicSnapshotAndWarm<T>(rebuild: () => Promise<T>): Promise<T> {
  const result = await rebuild();
  warmPublicWorksCache();
  return result;
}

/** Warm after a successful mutation that could change the public snapshot. */
export function warmAfterPublicWorkMutation(
  action: 'works.create' | 'works.update',
  result: WorkMutationResult,
  updates?: PublicWorkShape
): void {
  if (result.error || !result.data) return;

  const nowPublic = isPublicVisible(result.data);
  const movedOutOfPublic = action === 'works.update' && (
    updates?.visibility === 'private' || updates?.isPublic === false || Boolean(updates?.deletedAt)
  );

  if (nowPublic || movedOutOfPublic) warmPublicWorksCache();
}

