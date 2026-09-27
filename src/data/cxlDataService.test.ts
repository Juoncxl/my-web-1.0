import { describe, expect, it, vi } from 'vitest';
import { createCxlDataService, cxlDataService } from './cxlDataService';
import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';

describe('CXL data service boundary', () => {
  it.each([undefined, '', 'supabase', 'invalid'])('defaults to Supabase Works Read for flag %s', flag => {
    const service = createCxlDataService(flag);
    expect(service.works.fetch).toBe(supabaseDataAdapter.works.fetch);
  });

  it('selects Google for works.fetch only when explicitly configured', () => {
    const service = createCxlDataService('google');
    expect(service.works.fetch).toBe(googleDataAdapter.works.fetch);
    expect(service.works.create).toBe(supabaseDataAdapter.works.create);
    expect(service.works.update).toBe(supabaseDataAdapter.works.update);
    expect(service.works.softDelete).toBe(supabaseDataAdapter.works.softDelete);
    expect(service.works.restore).toBe(supabaseDataAdapter.works.restore);
    expect(service.works.permanentDelete).toBe(supabaseDataAdapter.works.permanentDelete);
    expect(service.works.emptyTrash).toBe(supabaseDataAdapter.works.emptyTrash);
    expect(service.works.fork).toBe(supabaseDataAdapter.works.fork);
  });

  it.each([undefined, '', 'supabase', 'invalid'])('defaults Public Creator reads to Supabase for flag %s', flag => {
    const service = createCxlDataService(undefined, flag);
    expect(service.profiles.getCreator).toBe(supabaseDataAdapter.profiles.getCreator);
    expect(service.profiles.getPublic).toBe(supabaseDataAdapter.profiles.getPublic);
    expect(service.settings.readCreatorSpace).toBe(supabaseDataAdapter.settings.readCreatorSpace);
  });

  it('selects Google only for validated public profile and Creator Space reads', () => {
    const service = createCxlDataService(undefined, 'google');
    expect(service.profiles.getCreator).toBe(googleDataAdapter.profiles.getCreator);
    expect(service.profiles.getPublic).toBe(googleDataAdapter.profiles.getPublic);
    expect(service.settings.readCreatorSpace).toBe(googleDataAdapter.settings.readCreatorSpace);
    expect(service.works.fetch).toBe(supabaseDataAdapter.works.fetch);
  });

  it('keeps all non-Works-read paths on Supabase when Google is selected', () => {
    const service = createCxlDataService('google');
    expect(service.folders).toBe(supabaseDataAdapter.folders);
    expect(service.collaborations).toBe(supabaseDataAdapter.collaborations);
    expect(service.profiles.getSnapshot).toBe(supabaseDataAdapter.profiles.getSnapshot);
    expect(service.profiles.getCreatorSnapshot).toBe(supabaseDataAdapter.profiles.getCreatorSnapshot);
    expect(service.profiles.get).toBe(supabaseDataAdapter.profiles.get);
    expect(service.profiles.getCreator).toBe(supabaseDataAdapter.profiles.getCreator);
    expect(service.profiles.getPublic).toBe(supabaseDataAdapter.profiles.getPublic);
    expect(service.profiles.uploadImage).toBe(supabaseDataAdapter.profiles.uploadImage);
    expect(service.profiles.upsert).toBe(supabaseDataAdapter.profiles.upsert);
    expect(service.settings.readCreatorSpace).toBe(supabaseDataAdapter.settings.readCreatorSpace);
    expect(service.settings.writeCreatorSpace).toBe(supabaseDataAdapter.settings.writeCreatorSpace);
    expect(service.settings.removeWorkFromCreatorSpace).toBe(supabaseDataAdapter.settings.removeWorkFromCreatorSpace);
    expect(service.engagement).toBe(supabaseDataAdapter.engagement);
    expect(service.reports).toBe(supabaseDataAdapter.reports);
    expect(service.media).toBe(supabaseDataAdapter.media);
  });

  it('keeps operations outside Public Creator reads on Supabase when that flag is Google', () => {
    const service = createCxlDataService(undefined, 'google');
    expect(service.profiles.getSnapshot).toBe(supabaseDataAdapter.profiles.getSnapshot);
    expect(service.profiles.getCreatorSnapshot).toBe(supabaseDataAdapter.profiles.getCreatorSnapshot);
    expect(service.profiles.get).toBe(supabaseDataAdapter.profiles.get);
    expect(service.profiles.uploadImage).toBe(supabaseDataAdapter.profiles.uploadImage);
    expect(service.profiles.upsert).toBe(supabaseDataAdapter.profiles.upsert);
    expect(service.settings.writeCreatorSpace).toBe(supabaseDataAdapter.settings.writeCreatorSpace);
    expect(service.settings.removeWorkFromCreatorSpace).toBe(supabaseDataAdapter.settings.removeWorkFromCreatorSpace);
    expect(service.folders).toBe(supabaseDataAdapter.folders);
    expect(service.collaborations).toBe(supabaseDataAdapter.collaborations);
    expect(service.engagement).toBe(supabaseDataAdapter.engagement);
    expect(service.reports).toBe(supabaseDataAdapter.reports);
    expect(service.media).toBe(supabaseDataAdapter.media);
  });

  it('keeps the existing Works selector independent from the Public Creator selector', () => {
    const googleCreatorOnly = createCxlDataService(undefined, 'google');
    expect(googleCreatorOnly.works.fetch).toBe(supabaseDataAdapter.works.fetch);
    const googleWorksOnly = createCxlDataService('google');
    expect(googleWorksOnly.works.fetch).toBe(googleDataAdapter.works.fetch);
    expect(googleWorksOnly.profiles.getCreator).toBe(supabaseDataAdapter.profiles.getCreator);
    expect(googleWorksOnly.profiles.getPublic).toBe(supabaseDataAdapter.profiles.getPublic);
    expect(googleWorksOnly.settings.readCreatorSpace).toBe(supabaseDataAdapter.settings.readCreatorSpace);
  });

  it('selects only metadata create/edit and Owner folder reads when the write flag is Google', async () => {
    const createSpy = vi.spyOn(googleDataAdapter.works, 'create').mockResolvedValue({ data: null, error: 'google create' });
    const supabaseCreateSpy = vi.spyOn(supabaseDataAdapter.works, 'create').mockResolvedValue({ data: null, error: 'supabase create' });
    const updateSpy = vi.spyOn(googleDataAdapter.works, 'update').mockResolvedValue({ data: null, error: 'google update' });
    const supabaseUpdateSpy = vi.spyOn(supabaseDataAdapter.works, 'update').mockResolvedValue({ data: null, error: 'supabase update' });
    const folderSpy = vi.spyOn(googleDataAdapter.folders, 'fetch').mockResolvedValue({ data: [], error: null });
    const service = createCxlDataService(undefined, undefined, 'google');
    const payload = { userId: 'owner', authorName: 'Owner', title: 'Test', category: 'character', icon: { type: 'emoji' as const, value: '✨' }, content: '', isPublic: false, visibility: 'private' as const, status: 'draft' as const };
    const requestId = '123e4567-e89b-42d3-a456-426614174000';

    await service.works.create(payload, { requestId });
    await service.works.create(payload);
    await service.works.update('asset_test', { title: 'Updated' }, { requestId, expectedRevision: 1 });
    await service.works.update('asset_test', { folderId: 'folder-1' });
    await service.folders.fetch('owner');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(supabaseCreateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(supabaseUpdateSpy).toHaveBeenCalledTimes(1);
    expect(service.folders.fetch).toBe(googleDataAdapter.folders.fetch);
    expect(service.folders.create).toBe(supabaseDataAdapter.folders.create);
    expect(service.folders.update).toBe(supabaseDataAdapter.folders.update);
    expect(service.folders.delete).toBe(supabaseDataAdapter.folders.delete);
    expect(service.works.fetch).toBe(supabaseDataAdapter.works.fetch);
    expect(service.media).toBe(supabaseDataAdapter.media);
    createSpy.mockRestore(); supabaseCreateSpy.mockRestore(); updateSpy.mockRestore(); supabaseUpdateSpy.mockRestore(); folderSpy.mockRestore();
  });

  it('keeps the application default on Supabase', () => {
    const defaults = createCxlDataService(undefined, undefined, undefined);
    expect(defaults.works.fetch).toBe(supabaseDataAdapter.works.fetch);
    expect(defaults.works.create).toBe(supabaseDataAdapter.works.create);
    expect(defaults.works.update).toBe(supabaseDataAdapter.works.update);
    expect(defaults.folders.fetch).toBe(supabaseDataAdapter.folders.fetch);
  });

  it('preserves adapter errors without changing their result', async () => {
    const error = new Error('Google Works Read unavailable');
    const fetchSpy = vi.spyOn(googleDataAdapter.works, 'fetch').mockRejectedValueOnce(error);
    const service = createCxlDataService('google');
    await expect(service.works.fetch({})).rejects.toBe(error);
    fetchSpy.mockRestore();
  });

  it('keeps Owner-only unsupported operations explicit and routes only configured core writes to Google', async () => {
    const folderFetch = vi.spyOn(googleDataAdapter.folders, 'fetch').mockResolvedValue({ data: [], error: null });
    const service = createCxlDataService('google', 'google', undefined, 'vercel');
    expect(service.works.fetch).toBe(googleDataAdapter.works.fetch);
    expect(service.profiles.getPublic).toBe(googleDataAdapter.profiles.getPublic);
    expect(service.settings.readCreatorSpace).toBe(googleDataAdapter.settings.readCreatorSpace);
    await expect(service.works.create({} as any)).resolves.toMatchObject({ data: null, error: expect.stringContaining('Google Works write Preview flag') });
    await expect(service.folders.fetch('browser-spoofed-id')).resolves.toEqual({ data: [], error: null });
    expect(folderFetch).toHaveBeenCalledWith('browser-spoofed-id');
    expect(service.folders.create).not.toBe(googleDataAdapter.folders.create);
    await expect(service.folders.create({ userId: 'owner', name: 'Folder' } as any)).resolves.toMatchObject({ success: false, error: expect.stringContaining('deferred') });
    await expect(service.settings.writeCreatorSpace('owner', {} as any)).resolves.toMatchObject({ success: false, error: expect.stringContaining('deferred') });
    await expect(service.folders.delete('folder', 'owner')).resolves.toMatchObject({ success: false, error: expect.stringContaining('deferred') });
    await expect(service.engagement.setBookmark('owner', 'work', true)).resolves.toMatchObject({ success: false, error: expect.stringContaining('deferred') });
    await expect(service.engagement.fetchBookmarks('owner')).resolves.toMatchObject({ data: [], error: expect.stringContaining('deferred') });
    await expect(service.collaborations.fetchDrafts({ userId: 'owner' })).resolves.toMatchObject({ data: [], error: expect.stringContaining('deferred') });
    await expect(service.media.hydrate([] as any)).rejects.toThrow('deferred');
    folderFetch.mockRestore();
  });

  it('keeps Google available as a separate contract-compatible adapter', () => {
    expect(googleDataAdapter).not.toBe(supabaseDataAdapter);
    expect(googleDataAdapter.works.fetch).not.toBe(supabaseDataAdapter.works.fetch);
    expect(googleDataAdapter.media.mediaReference('m1')).toBe('media:m1');
    expect(googleDataAdapter.media.mediaIdFromReference('media:m1')).toBe('m1');
  });
});
