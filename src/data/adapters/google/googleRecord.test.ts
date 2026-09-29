import { describe, expect, it } from 'vitest';
import type { Asset } from '../../../types';
import { deserializeGoogleWork, projectGooglePublicWork, serializeGoogleWork } from './googleRecord';

const asset = { id: 'asset_1', userId: 'owner', title: 'Work', category: 'character', status: 'draft',
  visibility: 'public', isPublic: true, tags: ['tag'], content: 'full text', contentBlocks: [],
  presentationMetadata: { futureField: true }, collaboration: { participants: [{ contact: 'secret' }] },
  publicCollaboration: { participants: [{ creatorName: 'A', contact: 'secret' }] },
  folderId: 'f1', linkedAssetIds: ['asset_2'], versions: [{ version: 1 }], media: [{ id: 'm1' }],
  prototypeExtension: { keep: true } } as unknown as Asset;

describe('Google work record mapping', () => {
  it('round trips the complete CXL shape and unknown fields in Drive JSON', () => {
    const saved = serializeGoogleWork(asset);
    expect(saved.row.folder_id).toBe('f1');
    expect(deserializeGoogleWork(saved)).toEqual(asset);
    expect(saved.cxlAsset?.prototypeExtension).toEqual({ keep: true });
  });

  it('creates a public projection without private collaboration or contact data', () => {
    const projection = projectGooglePublicWork(asset) as Record<string, any>;
    expect(projection.collaboration).toBeUndefined();
    expect(projection.userId).toBeUndefined();
    expect(projection.publicCollaboration.participants[0].contact).toBeUndefined();
  });
});
