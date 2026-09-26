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

  it('keeps the application default on Supabase', () => {
    expect(cxlDataService.works.fetch).toBe(supabaseDataAdapter.works.fetch);
    expect(cxlDataService.works.create).toBe(supabaseDataAdapter.works.create);
  });

  it('preserves adapter errors without changing their result', async () => {
    const error = new Error('Google Works Read unavailable');
    const fetchSpy = vi.spyOn(googleDataAdapter.works, 'fetch').mockRejectedValueOnce(error);
    const service = createCxlDataService('google');
    await expect(service.works.fetch({})).rejects.toBe(error);
    fetchSpy.mockRestore();
  });

  it('keeps Google available as a separate contract-compatible adapter', () => {
    expect(googleDataAdapter).not.toBe(supabaseDataAdapter);
    expect(googleDataAdapter.works.fetch).not.toBe(supabaseDataAdapter.works.fetch);
    expect(googleDataAdapter.media.mediaReference('m1')).toBe('media:m1');
    expect(googleDataAdapter.media.mediaIdFromReference('media:m1')).toBe('m1');
  });
});
