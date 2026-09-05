import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { hydrateQaWorkPayloads, saveQaWorkPayload, stripQaWorkPayload } from './qaWorkPayloadStore';

function asset(): Asset {
  return {
    id: 'payload-test', userId: 'owner', authorName: 'Owner', title: 'Payload', icon: { type: 'emoji', value: '✦' },
    category: 'collab', content: 'large body', contentBlocks: [{ id: 'block', type: 'Text', title: 'ข้อมูล', body: 'large body' }],
    uiCodeSnippet: '<div>large</div>', previewImage: 'cover', previewImages: ['cover', 'second'],
    collaboration: { name: 'Collab', sharedTag: 'tag', platforms: [], sharedInformation: [], deadlines: [], participants: [], visibilityPolicy: { showParticipantStatuses: false, showParticipantNotes: false, showParticipantDeadlineOverrides: false } },
    publicCollaboration: null, isPublic: false, visibility: 'private', status: 'draft', createdAt: 'now', updatedAt: 'now'
  };
}

describe('QA Work payload overflow storage', () => {
  it('round-trips large fields while the JSON asset remains slim', async () => {
    const original = asset();
    const { key } = await saveQaWorkPayload({ assetId: original.id, asset: original });
    const slim = stripQaWorkPayload(original, key);
    expect(slim.content).toBe('');
    expect(slim.contentBlocks).toEqual([]);
    expect((await hydrateQaWorkPayloads([slim]))[0]).toMatchObject({
      content: original.content,
      contentBlocks: original.contentBlocks,
      uiCodeSnippet: original.uiCodeSnippet,
      previewImages: original.previewImages,
      collaboration: original.collaboration
    });
  });
});
