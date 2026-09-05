import { describe, expect, it } from 'vitest';
import { buildWorkDraftPreview, createBlankCreatorWorkDraft } from './CreatorWorkWorkspace';
import {
  addCollabDeadline,
  addCollabParticipant,
  addCollabParticipantReferenceImage,
  addCollabSharedInformation,
  createBlankCollabParticipant,
  createBlankCollabSharedInformation,
  createBlankCollaborationDraft,
  createCollabDraftFromPublicContentBlocks,
  createPublicCollabContentBlocks,
  getCollaborationSummary,
  removeCollabDeadline,
  removeCollabParticipantReferenceImage,
  updateCollabParticipant,
  updateCollabSharedInformation,
  upsertCollabDeadline
} from './creatorCollabModel';

describe('Creator Composer D.6.1 collaboration draft model', () => {
  it('starts empty without predefined shared information or deadlines', () => {
    expect(createBlankCollaborationDraft()).toEqual({
      name: '', sharedTag: '', platforms: [], sharedInformation: [], deadlines: [], participants: [],
      visibilityPolicy: { showParticipantStatuses: false, showParticipantNotes: false, showParticipantDeadlineOverrides: false }
    });
  });

  it('adds a blank user-defined Shared Information section with unspecified app scope', () => {
    const next = addCollabSharedInformation(createBlankCollaborationDraft());
    expect(next.sharedInformation).toHaveLength(1);
    expect(next.sharedInformation[0]).toMatchObject({ title: '', type: 'text', content: '', appScope: 'unspecified', platforms: [] });
  });

  it('updates shared title and text content immutably', () => {
    const original = addCollabSharedInformation(createBlankCollaborationDraft(), createBlankCollabSharedInformation({ id: 'shared-1' }));
    const next = updateCollabSharedInformation(original, 'shared-1', { title: 'กติกาของคอลแลป', content: 'อย่าลืมส่งข้อมูล' });
    expect(next.sharedInformation[0]).toMatchObject({ title: 'กติกาของคอลแลป', type: 'text', content: 'อย่าลืมส่งข้อมูล' });
    expect(original.sharedInformation[0].content).toBe('');
  });

  it('switches a Shared Information item to code without losing its content', () => {
    const original = addCollabSharedInformation(createBlankCollaborationDraft(), createBlankCollabSharedInformation({ id: 'shared-1', content: '<section>shared</section>' }));
    const next = updateCollabSharedInformation(original, 'shared-1', { type: 'code' });
    expect(next.sharedInformation[0]).toMatchObject({ type: 'code', content: '<section>shared</section>' });
  });

  it('keeps app scope optional and exposes platforms only for specific-app scope', () => {
    const original = addCollabSharedInformation(createBlankCollaborationDraft(), createBlankCollabSharedInformation({ id: 'shared-1', platforms: ['Doki Chat'] }));
    const allApps = updateCollabSharedInformation(original, 'shared-1', { appScope: 'all_apps' });
    expect(allApps.sharedInformation[0]).toMatchObject({ appScope: 'all_apps', platforms: [] });
    const specificApps = updateCollabSharedInformation(allApps, 'shared-1', { appScope: 'specific_apps', platforms: ['Doki Chat', 'Rubii'] });
    expect(specificApps.sharedInformation[0]).toMatchObject({ appScope: 'specific_apps', platforms: ['Doki Chat', 'Rubii'] });
  });

  it('adds preset and custom deadlines with no enable/disable rows', () => {
    const dataDeadline = addCollabDeadline(createBlankCollaborationDraft(), 'data');
    expect(dataDeadline.deadlines[0]).toMatchObject({ kind: 'data', label: '📋 ส่งข้อมูล', date: '' });
    const customDeadline = addCollabDeadline(dataDeadline, 'custom');
    expect(customDeadline.deadlines[1]).toMatchObject({ kind: 'custom', label: '', date: '' });
  });

  it('edits and deletes any deadline while cleaning participant overrides', () => {
    let draft = addCollabDeadline(createBlankCollaborationDraft(), 'data');
    const deadlineId = draft.deadlines[0].id;
    draft = addCollabParticipant(draft, createBlankCollabParticipant({ id: 'p1', deadlineOverrides: { [deadlineId]: '2026-10-10' } }));
    const edited = upsertCollabDeadline(draft, deadlineId, { label: 'ส่งข้อมูลรอบแก้', date: '2026-10-09' });
    expect(edited.deadlines[0]).toMatchObject({ label: 'ส่งข้อมูลรอบแก้', date: '2026-10-09' });
    const removed = removeCollabDeadline(edited, deadlineId);
    expect(removed.deadlines).toEqual([]);
    expect(removed.participants[0].deadlineOverrides).toEqual({});
  });

  it('keeps reference images inside the participant rather than global media', () => {
    let draft = addCollabParticipant(createBlankCollaborationDraft(), createBlankCollabParticipant({ id: 'p1' }));
    draft = addCollabParticipantReferenceImage(draft, 'p1', { id: 'reference-1', src: 'data:image/png;base64,reference', kind: 'image', mimeType: 'image/png' });
    expect(draft.participants[0].referenceImages).toHaveLength(1);
    expect(draft).not.toHaveProperty('mediaDraft');
    expect(draft).not.toHaveProperty('contentCanvas');
    const removed = removeCollabParticipantReferenceImage(draft, 'p1', 'reference-1');
    expect(removed.participants[0].referenceImages).toEqual([]);
  });

  it('preserves separate data and image statuses and calculated summary', () => {
    let draft = createBlankCollaborationDraft();
    draft = addCollabParticipant(draft, createBlankCollabParticipant({ id: 'p1', dataStatus: 'approved', imageStatus: 'not_submitted' }));
    const next = updateCollabParticipant(draft, 'p1', { imageStatus: 'approved', notes: 'ข้อมูลครบแล้ว' });
    expect(next.participants[0]).toMatchObject({ dataStatus: 'approved', imageStatus: 'approved', notes: 'ข้อมูลครบแล้ว' });
    expect(getCollaborationSummary(next)).toEqual({ participants: 1, dataApproved: 1, imageApproved: 1 });
  });

  it('keeps D.6.1 data when the Composer draft is cloned for other tabs', () => {
    let collaboration = addCollabSharedInformation(createBlankCollaborationDraft(), createBlankCollabSharedInformation({ id: 'shared-1', title: 'ข้อมูลรวม', content: 'A', appScope: 'specific_apps', platforms: ['Doki Chat'] }));
    collaboration = addCollabDeadline(collaboration, 'image');
    const preview = buildWorkDraftPreview({ ...createBlankCreatorWorkDraft(), workMode: 'collab', collaboration });
    expect(preview.collaboration.sharedInformation[0]).toMatchObject({ title: 'ข้อมูลรวม', platforms: ['Doki Chat'] });
    expect(preview.collaboration.deadlines).toHaveLength(1);
    expect(preview.collaboration).not.toBe(collaboration);
  });

  it('publishes only Shared Information and never participant management data', () => {
    let collaboration = addCollabSharedInformation(createBlankCollaborationDraft(), createBlankCollabSharedInformation({ id: 'share-1', title: 'ข้อมูลที่แชร์', type: 'code', content: 'COPY_ME', appScope: 'specific_apps', platforms: ['Rubii'] }));
    collaboration = addCollabParticipant(collaboration, createBlankCollabParticipant({ creatorName: 'Private person', contact: '@secret', notes: 'PRIVATE_NOTE' }));
    collaboration = addCollabDeadline(collaboration, 'data');
    const blocks = createPublicCollabContentBlocks(collaboration);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'Prompt', title: 'ข้อมูลที่แชร์', body: 'COPY_ME' });
    expect(blocks[0].id).toContain('csp-collab-shared-');
    expect(JSON.stringify(blocks)).not.toContain('Private person');
    expect(JSON.stringify(blocks)).not.toContain('@secret');
    expect(JSON.stringify(blocks)).not.toContain('PRIVATE_NOTE');
  });

  it('restores persisted public Shared Information as editable collaboration data', () => {
    const restored = createCollabDraftFromPublicContentBlocks([
      { id: `csp-collab-shared-${encodeURIComponent(JSON.stringify({ id: 'share-1', appScope: 'specific_apps', platforms: ['Doki Chat'] }))}`, type: 'Text', title: 'กติกา', body: 'อ่านก่อนเริ่ม' },
      { id: 'normal-block', type: 'Text', title: 'เนื้อหางาน', body: 'ไม่ใช่ข้อมูลคอลแลป' }
    ]);
    expect(restored.sharedInformation).toEqual([{ id: 'share-1', title: 'กติกา', type: 'text', content: 'อ่านก่อนเริ่ม', appScope: 'specific_apps', platforms: ['Doki Chat'] }]);
    expect(restored.participants).toEqual([]);
  });

  it('persists and restores only public-safe Collaboration identity fields', () => {
    const collaboration = { ...createBlankCollaborationDraft(), name: 'คอลแลป A', sharedTag: 'บ้านA', platforms: ['Doki Chat', 'Rubii'] };
    const blocks = createPublicCollabContentBlocks(collaboration);
    expect(blocks[0]).toEqual({
      id: 'csp-collab-identity-v1',
      type: 'Note',
      title: 'คอลแลป A',
      body: 'แท็กคอลแลป: #บ้านA\nแอป / แพลตฟอร์ม: Doki Chat · Rubii'
    });
    const restored = createCollabDraftFromPublicContentBlocks(blocks);
    expect(restored).toMatchObject({ name: 'คอลแลป A', sharedTag: 'บ้านA', platforms: ['Doki Chat', 'Rubii'] });
    expect(restored.participants).toEqual([]);
    expect(restored.deadlines).toEqual([]);
  });
});
