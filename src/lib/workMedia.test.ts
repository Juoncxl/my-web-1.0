import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { assertNoInlineMedia, collectReferencedMediaIds, dataUrlToBlob, mediaIdFromReference, prepareAssetMedia } from './workMedia';

function createAsset(): Asset {
  const now = new Date().toISOString();
  const image = 'data:image/png;base64,aGVsbG8=';
  return {
    id: 'asset-media-test', userId: '11111111-1111-4111-8111-111111111111', authorName: 'Creator', title: 'Media',
    icon: { type: 'emoji', value: '✨' }, category: 'collab', content: '', contentBlocks: [],
    previewImage: '', previewImages: [], isPublic: true, visibility: 'public', status: 'finished', tags: [],
    createdAt: now, updatedAt: now,
    collaboration: {
      name: 'Collab', sharedTag: '', platforms: [], sharedInformation: [], deadlines: [],
      participants: [{ id: 'participant-1', isOwner: true, creatorName: 'A', houseTag: '', platforms: [], contact: '', externalWorkName: '', dataStatus: 'approved', imageStatus: 'approved', notes: '', referenceImages: [{ id: 'ref-1', src: image, kind: 'image', mimeType: 'image/png' }], linkedWorkIds: [], deadlineOverrides: {}, useDeadlineOverrides: false }],
      visibilityPolicy: { showParticipantStatuses: true, showParticipantNotes: true, showParticipantDeadlineOverrides: true }
    },
    publicCollaboration: {
      name: 'Collab', sharedTag: '', platforms: [], sharedInformation: [], deadlines: [],
      participants: [{ id: 'participant-1', isOwner: true, creatorName: 'A', houseTag: '', platforms: [], externalWorkName: '', referenceImages: [{ id: 'ref-1', src: image, kind: 'image', mimeType: 'image/png' }], linkedWorkIds: [] }],
      visibilityPolicy: { showParticipantStatuses: true, showParticipantNotes: true, showParticipantDeadlineOverrides: true }
    }
  };
}

describe('Work media preparation', () => {
  it('converts legacy data URLs without losing their MIME type', () => {
    const blob = dataUrlToBlob('data:image/gif;base64,R0lGODlh');
    expect(blob.type).toBe('image/gif');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('stores one participant file for both public and private collaboration JSON', async () => {
    const prepared = await prepareAssetMedia(createAsset(), '11111111-1111-4111-8111-111111111111');
    expect(prepared.pending).toHaveLength(1);
    expect(prepared.asset.collaboration?.participants[0].referenceImages[0].src).toMatch(/^media:/);
    expect(prepared.asset.publicCollaboration?.participants[0].referenceImages[0].src).toBe(prepared.asset.collaboration?.participants[0].referenceImages[0].src);
    expect(() => assertNoInlineMedia(prepared.asset)).not.toThrow();
    expect(collectReferencedMediaIds(prepared.asset)).toContain(mediaIdFromReference(prepared.asset.collaboration!.participants[0].referenceImages[0].src));
  });

  it('rejects inline media that reaches a cloud payload', () => {
    expect(() => assertNoInlineMedia({ nested: { src: 'blob:https://example.test/1' } })).toThrow(/ยังไม่ได้อัปโหลด/);
  });
});
