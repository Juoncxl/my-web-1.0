import { describe, expect, it } from 'vitest';
import { filterCollabParticipants, getCollabGroups, normalizeCollabGroups } from './collabParticipantFilters';
import { createBlankCollabParticipant, createBlankCollaborationDraft, createPublicCollaborationSnapshot, createCollabDraftFromPublicSnapshot, updateCollabGroup } from '../components/creator/creatorCollabModel';
import { d1CommitFields } from '../server/cxlDirectWrite';

describe('collaboration groups and participant discovery', () => {
  const people = [
    createBlankCollabParticipant({ id: 'one', creatorName: 'เก้า', houseTag: 'บ้านเก้า', groups: ['ตะวันออก'], detailLabel: 'ฉะเชิงเทรา', notes: 'ตัวละคร ธาม', dataStatus: 'approved', imageStatus: 'not_submitted' }),
    createBlankCollabParticipant({ id: 'two', creatorName: 'เก้า', groups: ['กลาง', 'ทีมแพทย์'], detailLabel: 'สมุทรปราการ', dataStatus: 'reviewing', imageStatus: 'approved' }),
    createBlankCollabParticipant({ id: 'three', creatorName: 'Noir', dataStatus: 'approved', imageStatus: 'approved' })
  ];

  it('finds all entries for one creator and searches collapsed notes, tags and labels', () => {
    expect(filterCollabParticipants(people, { query: 'เก้า' }).map(p => p.id)).toEqual(['one', 'two']);
    expect(filterCollabParticipants(people, { query: 'ธาม' }).map(p => p.id)).toEqual(['one']);
    expect(filterCollabParticipants(people, { query: 'ฉะเชิงเทรา' }).map(p => p.id)).toEqual(['one']);
    expect(filterCollabParticipants(people, { query: 'noIR' }).map(p => p.id)).toEqual(['three']);
  });

  it('combines groups, search and the separate data/image statuses', () => {
    expect(filterCollabParticipants(people, { query: 'เก้า', group: 'กลาง', dataStatus: 'reviewing', imageStatus: 'approved' }).map(p => p.id)).toEqual(['two']);
    expect(filterCollabParticipants(people, { group: 'ตะวันออก', imageStatus: 'approved' })).toEqual([]);
    expect(filterCollabParticipants(people, { group: '__ungrouped__' }).map(p => p.id)).toEqual(['three']);
    expect(filterCollabParticipants(people, {})).toEqual(people);
  });

  it('handles legacy records and never interprets hidden statuses as missing work', () => {
    const legacy = [{ id: 'old', creatorName: 'Old' }];
    expect(filterCollabParticipants(legacy, {})).toEqual(legacy);
    expect(filterCollabParticipants(legacy, { imageStatus: 'not_submitted' })).toEqual([]);
    expect(getCollabGroups([], legacy)).toEqual([]);
    expect(normalizeCollabGroups([' A ', 'a', '', 'เหนือ', 'เหนือ'])).toEqual(['A', 'เหนือ']);
  });

  it('finds submission statuses through the search field without mixing data with images', () => {
    expect(filterCollabParticipants(people, { query: 'ยังไม่ส่งรูป' }).map(p => p.id)).toEqual(['one']);
    expect(filterCollabParticipants(people, { query: 'ข้อมูลรอตรวจ' }).map(p => p.id)).toEqual(['two']);
    expect(filterCollabParticipants(people, { query: 'ผ่านแล้ว รูป' }).map(p => p.id)).toEqual(['two', 'three']);
    expect(filterCollabParticipants([{ id: 'hidden', creatorName: 'A' }], { query: 'ยังไม่ส่ง' })).toEqual([]);
  });

  it('renames/removes groups across memberships without losing participants or mutating the draft', () => {
    const draft = { ...createBlankCollaborationDraft(), groups: ['กลาง', 'ทีมแพทย์'], participants: people };
    const renamed = updateCollabGroup(draft, 'กลาง', 'ส่วนกลาง');
    expect(renamed.participants[1].groups).toEqual(['ส่วนกลาง', 'ทีมแพทย์']);
    expect(draft.participants[1].groups).toEqual(['กลาง', 'ทีมแพทย์']);
    const removed = updateCollabGroup(renamed, 'ส่วนกลาง', '');
    expect(removed.participants).toHaveLength(3);
    expect(removed.participants[1].groups).toEqual(['ทีมแพทย์']);
    expect(getCollabGroups(removed.groups, removed.participants)).toEqual(['ทีมแพทย์', 'ตะวันออก']);
  });

  it('round trips group metadata while keeping private contact and hidden notes/statuses out of public search', () => {
    const draft = { ...createBlankCollaborationDraft(), groups: ['ตะวันออก'], participants: [createBlankCollabParticipant({ ...people[0], contact: 'private-contact' })] };
    const snapshot = createPublicCollaborationSnapshot(draft);
    expect(snapshot.groups).toEqual(['ตะวันออก']);
    expect(snapshot.participants[0]).toMatchObject({ groups: ['ตะวันออก'], detailLabel: 'ฉะเชิงเทรา' });
    expect(snapshot.participants[0]).not.toHaveProperty('contact');
    expect(filterCollabParticipants(snapshot.participants, { query: 'ธาม' })).toEqual([]);
    expect(filterCollabParticipants(snapshot.participants, { query: 'private-contact' })).toEqual([]);
    expect(filterCollabParticipants(snapshot.participants, { dataStatus: 'not_submitted' })).toEqual([]);
    expect(createCollabDraftFromPublicSnapshot(snapshot).participants[0].groups).toEqual(['ตะวันออก']);
  });

  it('preserves groups and labels through the D1 public projection used by the live site', () => {
    const draft = { ...createBlankCollaborationDraft(), name: 'Any collab', groups: ['ทีมแพทย์'], participants: [createBlankCollabParticipant({ creatorName: 'A', groups: ['ทีมแพทย์'], detailLabel: 'ศัลยแพทย์', contact: 'private' })] };
    const record = { revision: 1, row: { id: 'work-groups', user_id: 'owner', category: 'collab', title: 'Any collab', status: 'draft', visibility: 'public', is_public: true, created_at: '2026-11-03', updated_at: '2026-11-03' }, collaborationDraft: draft, mediaRecords: [] };
    const projection = d1CommitFields(record).publicProjection;
    expect(projection.public_collaboration.groups).toEqual(['ทีมแพทย์']);
    expect(projection.public_collaboration.participants[0]).toMatchObject({ groups: ['ทีมแพทย์'], detailLabel: 'ศัลยแพทย์' });
    expect(JSON.stringify(projection)).not.toContain('"contact"');
  });
});
