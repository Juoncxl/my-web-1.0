type PublicWorkShape = {
  id?: unknown;
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

/** Refresh the public CDN entry without affecting the mutation caller. */
export function warmPublicWorksCache(): void {
  try {
    void fetch('/api/cxl/public-works', {
      method: 'GET',
      // Protected Preview deployments need the same-origin Vercel auth cookie.
      credentials: 'same-origin',
      headers: { Accept: 'application/json', Pragma: 'no-cache' }
    }).catch(() => undefined);
  } catch {
    // Warming is best-effort, including synchronous fetch failures.
  }
}

/** Request one public Work detail so its CDN entry exists (or revalidates) before a guest opens it. */
export function warmPublicWorkDetailCache(workId: unknown): void {
  if (typeof workId !== 'string' || !/^asset_[A-Za-z0-9_-]{1,96}$/.test(workId)) return;
  try {
    void fetch(`/api/cxl/public-work?${new URLSearchParams({ id: workId })}`, {
      method: 'GET',
      credentials: 'same-origin',
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
  if (nowPublic) warmPublicWorkDetailCache(result.data.id);
}

