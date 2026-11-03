import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { CollabParticipantFilters } from './CollabParticipantFilters';
import { CreatorCollabPanel } from './creator/CreatorCollabPanel';
import { WorkDetailModal } from './WorkDetailModal';
import { createBlankCollaborationDraft, createBlankCollabParticipant, createPublicCollaborationSnapshot } from './creator/creatorCollabModel';
import { createBlankCreatorWorkDraft } from './creator/CreatorWorkWorkspace';
import { serializeCreatorWorkDraft } from './creator/creatorWorkSerializer';

const draft = { ...createBlankCollaborationDraft(), name: 'คอลทดสอบ', groups: ['ภาคเหนือ', 'ทีมแพทย์'], participants: [
  createBlankCollabParticipant({ id: 'p1', creatorName: 'เก้า', groups: ['ภาคเหนือ'], detailLabel: 'เชียงใหม่', notes: 'private-note', contact: 'private-contact' }),
  ...['A', 'B', 'C'].map(creatorName => createBlankCollabParticipant({ creatorName }))
] };

describe('participant discovery surfaces', () => {
  it('offers group selection but no status controls when statuses are private', () => {
    const html = renderToStaticMarkup(<CollabParticipantFilters value={{ query: 'เก้า' }} onChange={() => {}} groups={['ทีมแพทย์']} showStatuses={false} count={1} total={4} />);
    expect(html).toContain('ทีมแพทย์');
    expect(html).toContain('ล้างตัวกรอง');
    expect(html).toContain('แสดง 1 จาก 4 รายการ');
    expect(html).not.toContain('สถานะข้อมูล');
    expect(html).not.toContain('สถานะรูป');
  });

  it('renders the same controls in the owner editor with editable groups and compact labels', () => {
    const html = renderToStaticMarkup(<CreatorCollabPanel draft={draft} visibility="public" onVisibilityChange={() => {}} platformOptions={[]} counterMode="characters" onCounterModeChange={() => {}} onChange={() => {}} />);
    expect(html).toContain('ค้นหาและกรองผู้เข้าร่วม');
    expect(html).toContain('ชื่อกลุ่มใหม่');
    expect(html).not.toContain('<option value="not_submitted">');
    expect(html).toContain('เชียงใหม่');
    expect(html).toContain('ภาคเหนือ');
  });

  it('shows folded labels/groups and search in owner and public detail without private information', () => {
    const asset = { id: 'public-collab', userId: 'owner', authorName: 'Owner', title: 'คอลทดสอบ', category: 'collab', icon: { type: 'emoji', value: '✨' }, status: 'draft', tags: [], visibility: 'public', isPublic: true, content: '', createdAt: '', updatedAt: '', collaboration: draft, publicCollaboration: createPublicCollaborationSnapshot(draft) } as Asset;
    for (const isOwner of [false, true]) {
      const html = renderToStaticMarkup(<WorkDetailModal asset={asset} isOpen onClose={() => {}} isOwner={isOwner} embedded />);
      expect(html).toContain('ค้นหาและกรองผู้เข้าร่วม');
      expect(html).toContain('เชียงใหม่');
      expect(html).toContain('ภาคเหนือ');
      expect(html).toContain('ดูผู้เข้าร่วม / เช็กงาน');
      expect(html).not.toContain('private-contact');
      expect(html).not.toContain('private-note');
      expect(html).not.toContain('สถานะข้อมูล');
    }
  });

  it('keeps groups through canonical save serialization for private and public records', () => {
    const blank = createBlankCreatorWorkDraft();
    const result = serializeCreatorWorkDraft({ ...blank, workMode: 'collab', visibility: 'public', collaboration: draft, imagePromptToolModel: blank.contentCanvas.imagePrompt.toolModel });
    expect(result.collaboration?.groups).toEqual(['ภาคเหนือ', 'ทีมแพทย์']);
    expect(result.publicCollaboration?.participants[0]).toMatchObject({ detailLabel: 'เชียงใหม่', groups: ['ภาคเหนือ'] });
    expect(result.publicCollaboration?.participants[0]).not.toHaveProperty('contact');
  });
});
