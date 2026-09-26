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

  it('keeps all non-Works-read paths on Supabase when Google is selected', () => {
    const service = createCxlDataService('google');
    expect(service.folders).toBe(supabaseDataAdapter.folders);
    expect(service.collaborations).toBe(supabaseDataAdapter.collaborations);
    expect(service.profiles).toBe(supabaseDataAdapter.profiles);
    expect(service.settings).toBe(supabaseDataAdapter.settings);
    expect(service.engagement).toBe(supabaseDataAdapter.engagement);
    expect(service.reports).toBe(supabaseDataAdapter.reports);
    expect(service.media).toBe(supabaseDataAdapter.media);
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
