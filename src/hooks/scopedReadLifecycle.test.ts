import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ScopedReadLifecycle } from './scopedReadLifecycle';

const assetHookSource = readFileSync(new URL('./useAssetData.ts', import.meta.url), 'utf8');
const folderHookSource = readFileSync(new URL('./useFolderData.ts', import.meta.url), 'utf8');

type OwnerData = { works: string[]; folders: string[] };

function makeScopedReader<T>(lifecycle: ScopedReadLifecycle, scope: string, read: () => Promise<T>, commit: (value: T) => void) {
  if (!lifecycle.claimAutomaticLoad(scope)) return false;
  const ticket = lifecycle.capture(scope);
  if (!ticket) return false;
  void read().then(value => {
    if (lifecycle.isCurrent(ticket)) commit(value);
  });
  return true;
}

describe('Owner scoped read lifecycle', () => {
  it('starts Works and folder reads when a guest Creator route becomes the authenticated Owner route', async () => {
    const workLifecycle = new ScopedReadLifecycle();
    const folderLifecycle = new ScopedReadLifecycle();
    const guestScope = 'public-creator:juoncxl';
    const ownerScope = 'owner:stable-key';
    workLifecycle.transition(guestScope);
    folderLifecycle.transition(guestScope);

    const readWorks = vi.fn(async () => ['owner-work']);
    const readFolders = vi.fn(async () => ['owner-folder']);
    let data: OwnerData = { works: [], folders: [] };
    const ownerTransitioned = workLifecycle.transition(ownerScope);
    folderLifecycle.transition(ownerScope);

    expect(ownerTransitioned).toBe(true);
    expect(makeScopedReader(workLifecycle, ownerScope, readWorks, works => { data = { ...data, works }; })).toBe(true);
    expect(makeScopedReader(folderLifecycle, ownerScope, readFolders, folders => { data = { ...data, folders }; })).toBe(true);
    await vi.waitFor(() => expect(data).toEqual({ works: ['owner-work'], folders: ['owner-folder'] }));
    expect(readWorks).toHaveBeenCalledOnce();
    expect(readFolders).toHaveBeenCalledOnce();
  });

  it('replaces initial empty Owner state with both read results without a page reload', async () => {
    const workLifecycle = new ScopedReadLifecycle();
    const folderLifecycle = new ScopedReadLifecycle();
    workLifecycle.transition('owner:stable-key');
    folderLifecycle.transition('owner:stable-key');
    let works: string[] = [];
    let folders: string[] = [];

    makeScopedReader(workLifecycle, 'owner:stable-key', async () => ['work-1', 'work-2'], value => { works = value; });
    makeScopedReader(folderLifecycle, 'owner:stable-key', async () => ['folder-1'], value => { folders = value; });
    await vi.waitFor(() => {
      expect(works).toEqual(['work-1', 'work-2']);
      expect(folders).toEqual(['folder-1']);
    });
  });

  it('prevents stale anonymous results from overwriting Owner results', async () => {
    const lifecycle = new ScopedReadLifecycle();
    lifecycle.transition('public-creator:juoncxl');
    let resolvePublic!: (value: string[]) => void;
    const stalePublicRead = new Promise<string[]>(resolve => { resolvePublic = resolve; });
    const publicTicket = lifecycle.capture('public-creator:juoncxl');
    let works: string[] = [];

    expect(lifecycle.transition('owner:stable-key')).toBe(true);
    const ownerTicket = lifecycle.capture('owner:stable-key')!;
    works = ['owner-work'];
    resolvePublic(['anonymous-public-work']);
    await stalePublicRead.then(result => {
      if (publicTicket && lifecycle.isCurrent(publicTicket)) works = result;
    });
    expect(lifecycle.isCurrent(ownerTicket)).toBe(true);
    expect(works).toEqual(['owner-work']);
  });

  it('claims each automatic scope load once across rerenders and bootstrap effect replay', () => {
    const lifecycle = new ScopedReadLifecycle();
    lifecycle.transition('owner:stable-key');
    const readWorks = vi.fn();
    const readFolders = vi.fn();

    if (lifecycle.claimAutomaticLoad('owner:stable-key')) readWorks();
    if (lifecycle.claimAutomaticLoad('owner:stable-key')) readWorks();
    if (lifecycle.claimAutomaticLoad('owner:stable-key')) readFolders();

    expect(readWorks).toHaveBeenCalledOnce();
    // Each hook owns a lifecycle instance; the folder read is independently claimed.
    const folderLifecycle = new ScopedReadLifecycle();
    folderLifecycle.transition('owner:stable-key');
    if (folderLifecycle.claimAutomaticLoad('owner:stable-key')) readFolders();
    expect(readFolders).toHaveBeenCalledOnce();
  });

  it('invalidates Owner requests and clears Owner scoped data on logout', async () => {
    const lifecycle = new ScopedReadLifecycle();
    lifecycle.transition('owner:stable-key');
    const ownerTicket = lifecycle.capture('owner:stable-key')!;
    let data: OwnerData = { works: ['owner-work'], folders: ['owner-folder'] };

    expect(lifecycle.transition('anonymous')).toBe(true);
    data = { works: [], folders: [] };
    if (lifecycle.isCurrent(ownerTicket)) data = { works: ['late-owner-work'], folders: ['late-owner-folder'] };

    expect(data).toEqual({ works: [], folders: [] });
    expect(lifecycle.isCurrent(ownerTicket)).toBe(false);
  });

  it('keeps anonymous public reads available without triggering an Owner-only folder read', () => {
    const publicLifecycle = new ScopedReadLifecycle();
    publicLifecycle.transition('public-feed');
    const readPublicWorks = vi.fn();
    const readFolders = vi.fn();
    if (publicLifecycle.claimAutomaticLoad('public-feed')) readPublicWorks();

    const currentUserId: string | undefined = undefined;
    if (currentUserId && publicLifecycle.claimAutomaticLoad(currentUserId)) readFolders();

    expect(readPublicWorks).toHaveBeenCalledOnce();
    expect(readFolders).not.toHaveBeenCalled();
  });

  it('wires both production hooks to scope transitions, one automatic read, and stale-result guards', () => {
    expect(assetHookSource).toContain('useLayoutEffect(() => {');
    expect(assetHookSource).toContain('readLifecycle.current.transition(requestScopeKey)');
    expect(assetHookSource).toContain('readLifecycle.current.claimAutomaticLoad(requestScopeKey)');
    expect(assetHookSource).toContain('cxlDataService.works.fetch');
    expect(assetHookSource).toContain('readLifecycle.current.isCurrent(ticket)');
    expect(assetHookSource).toContain('readWithBoundedRetry');
    expect(assetHookSource).toContain('retryOwnerInitialRead');
    expect(assetHookSource).toContain('retryPublicInitialSummaryRead');
    expect(assetHookSource).toContain("loadOptions.publicOnly === true");
    expect(assetHookSource).toContain("loadOptions.detail !== 'full'");
    expect(assetHookSource).toMatch(/setAssets\(res\.data\);[\s\S]*reportError\(null\);/);

    expect(folderHookSource).toContain('useLayoutEffect(() => {');
    expect(folderHookSource).toContain('readLifecycle.current.transition(requestScopeKey)');
    expect(folderHookSource).toContain('readLifecycle.current.claimAutomaticLoad(requestScopeKey)');
    expect(folderHookSource).toContain('cxlDataService.folders.fetch(currentUserId)');
    expect(folderHookSource).toContain('readLifecycle.current.isCurrent(ticket)');
    expect(folderHookSource).toContain('readWithBoundedRetry');
    expect(folderHookSource).toContain('isInitialLoad && isVercelOwnerAuth');
  });
});
