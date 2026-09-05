import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { getWorkDisplayPresentation } from './workDisplayPresentation';
import { CREATOR_COLLAB_IDENTITY_BLOCK_ID, CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX } from '../components/creator/creatorCollabModel';

const baseAsset: Asset = {
  id: 'work-1', userId: 'creator-1', authorName: 'Creator', title: 'ยังไม่ได้ตั้งชื่อผลงาน', icon: { type: 'emoji', value: '✦' }, category: 'collab', content: '', contentBlocks: [], isPublic: true, visibility: 'public', status: 'idea', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z'
};

describe('shared Work display presentation', () => {
  it('uses a meaningful in-memory Collaboration title only for a collaboration-focused draft', () => {
    expect(getWorkDisplayPresentation(baseAsset, { name: 'คอลแลป A' }).title).toBe('คอลแลป A');
  });

  it('does not let Collaboration override a normal multi-content Work title', () => {
    const asset: Asset = { ...baseAsset, title: 'โลกหลักของโปรเจกต์', contentBlocks: [{ id: 'text-1', type: 'Text', title: 'เรื่องย่อ', body: 'เนื้อหางานปกติ' }] };
    const presentation = getWorkDisplayPresentation(asset, { name: 'คอลแลป A' });
    expect(presentation.title).toBe('โลกหลักของโปรเจกต์');
    expect(presentation.isCollaborationFocused).toBe(true);
  });

  it('recognizes only explicitly public Collaboration blocks and leaves private data absent', () => {
    const publicBlock = { id: `${CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX}safe`, type: 'Text' as const, title: 'ข้อมูลกลาง', body: 'ข้อความที่เผยแพร่ได้' };
    const privateLookingBlock = { id: 'participant-notes', type: 'Text' as const, title: 'โน้ตภายใน', body: 'ข้อมูลภายใน' };
    const presentation = getWorkDisplayPresentation({ ...baseAsset, contentBlocks: [publicBlock] });
    expect(presentation.publicCollaborationBlocks).toEqual([publicBlock]);
    expect(getWorkDisplayPresentation({ ...baseAsset, contentBlocks: [privateLookingBlock] }).isCollaborationFocused).toBe(true);
  });

  it('reads persisted Collaboration identity for actual Card and Detail without private management fields', () => {
    const identity = { id: CREATOR_COLLAB_IDENTITY_BLOCK_ID, type: 'Note' as const, title: 'คอลแลป A', body: 'แท็กคอลแลป: #บ้านA\nแอป / แพลตฟอร์ม: Doki Chat' };
    const presentation = getWorkDisplayPresentation({ ...baseAsset, contentBlocks: [identity] });
    expect(presentation.title).toBe('คอลแลป A');
    expect(presentation.summary).toContain('#บ้านA');
    expect(presentation.collaborationTitle).toBe('คอลแลป A');
    expect(presentation.publicCollaborationBlocks).toEqual([]);
  });

  it('passes only the stored public Collaboration snapshot to public surfaces', () => {
    const collaboration = {
      name: 'คอลแลปเต็ม', sharedTag: 'บ้านA', platforms: ['Doki Chat'], sharedInformation: [], deadlines: [], participants: [],
      visibilityPolicy: { showParticipantStatuses: false, showParticipantNotes: false, showParticipantDeadlineOverrides: false }
    };
    expect(getWorkDisplayPresentation({ ...baseAsset, publicCollaboration: collaboration }).collaboration).toEqual(collaboration);
    expect(getWorkDisplayPresentation({ ...baseAsset, collaboration: { ...collaboration, participants: [] } }).collaboration).toBeNull();
  });
});
