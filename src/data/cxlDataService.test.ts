import { describe, expect, it } from 'vitest';
import { cxlDataService } from './cxlDataService';
import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';

describe('CXL data service boundary', () => {
  it('delegates application operations to the currently selected Supabase adapter', () => {
    expect(cxlDataService).toBe(supabaseDataAdapter);
    expect(cxlDataService.works.fetch).toBe(supabaseDataAdapter.works.fetch);
    expect(cxlDataService.folders.delete).toBe(supabaseDataAdapter.folders.delete);
    expect(cxlDataService.collaborations.fetchDrafts).toBe(supabaseDataAdapter.collaborations.fetchDrafts);
    expect(cxlDataService.collaborations.createPublicSnapshot).toBe(supabaseDataAdapter.collaborations.createPublicSnapshot);
    expect(cxlDataService.profiles.getCreator).toBe(supabaseDataAdapter.profiles.getCreator);
    expect(cxlDataService.settings.readCreatorSpace).toBe(supabaseDataAdapter.settings.readCreatorSpace);
    expect(cxlDataService.engagement.setWorkLike).toBe(supabaseDataAdapter.engagement.setWorkLike);
    expect(cxlDataService.reports.submit).toBe(supabaseDataAdapter.reports.submit);
    expect(cxlDataService.media.getFreshDownload).toBe(supabaseDataAdapter.media.getFreshDownload);
  });

  it('keeps Google available as a separate contract-compatible, inactive adapter', () => {
    expect(googleDataAdapter).not.toBe(cxlDataService);
    expect(googleDataAdapter.works.fetch).not.toBe(supabaseDataAdapter.works.fetch);
    expect(googleDataAdapter.media.mediaReference('m1')).toBe('media:m1');
    expect(googleDataAdapter.media.mediaIdFromReference('media:m1')).toBe('m1');
  });
});
