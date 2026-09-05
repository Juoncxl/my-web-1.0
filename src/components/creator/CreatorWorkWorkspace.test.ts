import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Asset } from '../../types';
import { buildWorkDraftPreview, createBlankCreatorWorkDraft, createCreatorWorkDraftFromAsset, limitWorkIconInput, normalizeCreatorContentTypes, type CreatorWorkDraft } from './CreatorWorkWorkspace';
import { createBlankContentCanvasDraft } from './creatorContentModel';
import { createBlankMediaDraft } from './creatorMediaModel';
import { createBlankCollaborationDraft } from './creatorCollabModel';

const draft: CreatorWorkDraft = {
  title: '  Current draft  ', category: 'ui_code', contentTypes: ['ui_code', 'image_prompt'], workMode: 'standard', publicationStatus: 'published', workStatus: 'in_progress', description: ' Draft description ', visibility: 'public', status: 'in_progress',
  folderId: 'folder-qa',
  icon: { type: 'emoji', value: '✦' }, content: 'Current content',
  contentBlocks: [
    { id: 'text-1', type: 'Text', title: 'Main', body: 'MAIN CONTENT TEST' },
    { id: 'ui-1', type: 'UI Code', title: 'UI Code', body: '<p>Current</p><style>p{color:red}</style>' }
  ],
  uiCodeSnippet: '<p>Current</p><style>p{color:red}</style>', previewImages: ['data:image/png;base64,current'], coverImage: '', mediaDraft: createBlankMediaDraft(), tags: ['live'], appPlatforms: ['Doki Chat'], audienceRating: '13_plus', contentWarnings: ['สยองขวัญ'], genres: ['แฟนตาซี'], contentCanvas: createBlankContentCanvasDraft(), collaboration: createBlankCollaborationDraft(), collaborationAssetId: null
};
const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const workspaceStyles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
const canvasSource = readFileSync(new URL('./CreatorContentCanvas.tsx', import.meta.url), 'utf8');
const canvasModelSource = readFileSync(new URL('./creatorContentModel.ts', import.meta.url), 'utf8');
const composerSources = `${workspaceSource}\n${canvasSource}\n${canvasModelSource}`;

describe('CreatorWorkWorkspace live draft preview', () => {
  it('starts Create mode from a clean draft without prior Work state', () => {
    expect(createBlankCreatorWorkDraft()).toMatchObject({
      title: '', description: '', folderId: null, content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: [], tags: [],
      contentTypes: [], workMode: 'standard', publicationStatus: 'draft', workStatus: 'not_started', visibility: 'private', status: 'idea', appPlatforms: [], audienceRating: 'general', contentWarnings: [], genres: []
    });
  });

  it('derives the preview from current draft values without mutating the input', () => {
    const preview = buildWorkDraftPreview(draft);
    expect(preview.title).toBe('Current draft');
    expect(preview.description).toBe('Draft description');
    expect(preview.content).toBe('Current content');
    expect(preview.contentBlocks).toEqual(draft.contentBlocks);
    expect(preview.contentBlocks).not.toBe(draft.contentBlocks);
    expect(preview.previewImages).toEqual(['data:image/png;base64,current']);
    expect(preview.folderId).toBe('folder-qa');
    expect(preview.publicationStatus).toBe('published');
    expect(preview.workStatus).toBe('in_progress');
    expect(preview).not.toBe(draft);
    expect(draft.title).toBe('  Current draft  ');
  });

  it('keeps short description independent from Text and UI Code blocks', () => {
    const preview = buildWorkDraftPreview({ ...draft, content: '' });
    expect(preview.description).toBe('Draft description');
    expect(preview.description).not.toContain('MAIN CONTENT TEST');
    expect(preview.description).not.toContain('<style>');
    expect(preview.content).toBe('');
  });

  it('keeps compound emoji sequences intact while applying the icon input limit', () => {
    expect(limitWorkIconInput('❤️‍🔥')).toBe('❤️‍🔥');
    expect(limitWorkIconInput('❤️')).toBe('❤️');
    expect(limitWorkIconInput('👍')).toBe('👍');
    expect(limitWorkIconInput('👨‍💻')).toBe('👨‍💻');
    expect(limitWorkIconInput('❤️‍🔥👍👨‍💻✨🙂')).toBe('❤️‍🔥👍👨‍💻✨');
  });

  it('retains a hydrated GIF icon key and mode when reopening a Work for edit', () => {
    const persisted = {
      id: 'gif-work', title: 'GIF Work', category: 'lore', content: '', uiCodeSnippet: '', tags: [],
      icon: { type: 'image', value: 'blob:hydrated-gif', storageKey: 'work-icon:gif-work:stored', mimeType: 'image/gif' },
      visibility: 'private', isPublic: false, status: 'finished', previewImages: [], folderId: null
    } as unknown as Asset;

    expect(createCreatorWorkDraftFromAsset(persisted).icon).toMatchObject({
      type: 'image', value: 'blob:hydrated-gif', storageKey: 'work-icon:gif-work:stored', mimeType: 'image/gif'
    });
    expect(workspaceSource).toContain("draft.icon.mimeType === 'image/gif'");
  });

  it('hydrates legacy global media into one draft collection and keeps the explicit cover', () => {
    const persisted = {
      id: 'media-work', title: 'Media Work', category: 'lore', content: '', uiCodeSnippet: '',
      previewImage: 'data:image/png;base64,cover',
      previewImages: ['data:image/png;base64,gallery', 'data:image/png;base64,cover'],
      icon: { type: 'emoji', value: '✦' }, tags: [], visibility: 'private', isPublic: false,
      status: 'finished', folderId: null
    } as unknown as Asset;
    const editable = createCreatorWorkDraftFromAsset(persisted);
    expect(editable.mediaDraft.items.map(item => item.src)).toEqual([
      'data:image/png;base64,gallery', 'data:image/png;base64,cover'
    ]);
    expect(editable.mediaDraft.items.find(item => item.id === editable.mediaDraft.coverId)?.src).toBe('data:image/png;base64,cover');
    expect(editable.coverImage).toBe('data:image/png;base64,cover');
  });

  it('derives each Review Preview render from the latest unsaved block state', () => {
    const editedDraft = {
      ...draft,
      contentBlocks: draft.contentBlocks.map(block => block.id === 'text-1' ? { ...block, body: 'UNSAVED BLOCK EDIT' } : block)
    };
    expect(buildWorkDraftPreview(editedDraft).contentBlocks[0].body).toBe('UNSAVED BLOCK EDIT');
    expect(buildWorkDraftPreview(draft).contentBlocks[0].body).toBe('MAIN CONTENT TEST');
  });

  it('hydrates legacy edit data as เนื้อหาหลัก without mutating persisted data on cancel', () => {
    const persisted = {
      id: 'legacy-work', title: 'Legacy', category: 'prompts', content: 'LEGACY MAIN CONTENT',
      uiCodeSnippet: '<div>Legacy UI</div>', icon: { type: 'emoji', value: '✦' }, tags: ['saved'],
      visibility: 'private', isPublic: false, status: 'finished', previewImages: [], folderId: 'folder-legacy'
    } as unknown as Asset;
    const editable = createCreatorWorkDraftFromAsset(persisted);

    expect(editable.description).toBe('');
    expect(editable.contentBlocks.map(block => block.type)).toEqual(['Text', 'UI Code']);
    expect(editable.folderId).toBe('folder-legacy');
    editable.contentBlocks[0].body = 'UNSAVED CHANGE';
    editable.tags.push('unsaved');
    expect(persisted.content).toBe('LEGACY MAIN CONTENT');
    expect(persisted.tags).toEqual(['saved']);
  });

  it('restores every saved Collaboration group when reopening a Collaboration card', () => {
    const persisted = {
      id: 'collab-work', userId: 'owner-1', authorName: 'Owner', title: 'Collaboration',
      category: 'collab', content: '', uiCodeSnippet: '', icon: { type: 'emoji', value: '🤝' },
      tags: [], visibility: 'private', isPublic: false, status: 'in_progress', previewImages: [], folderId: null,
      contentTypes: ['character', 'ui_code'],
      collaboration: {
        name: 'Project Aurora', sharedTag: 'aurora', platforms: ['Doki Chat'],
        sharedInformation: [{ id: 'shared-1', title: 'ข้อมูลกลาง', type: 'text', content: 'PUBLIC DATA', appScope: 'all_apps', platforms: [] }],
        deadlines: [{ id: 'deadline-1', kind: 'image', label: 'ส่งรูป', date: '2026-12-31' }],
        participants: [{
          id: 'participant-1', isOwner: false, creatorName: 'Partner', houseTag: '@partner', platforms: ['Doki Chat'],
          contact: 'contact@example.com', externalWorkName: 'Partner Work', dataStatus: 'approved', imageStatus: 'reviewing',
          notes: 'PRIVATE NOTE', referenceImages: [{ id: 'reference-1', src: 'data:image/png;base64,reference', kind: 'image' }],
          linkedWorkIds: ['linked-work'], deadlineOverrides: { 'deadline-1': '2027-01-02' }, useDeadlineOverrides: true
        }]
      }
    } as unknown as Asset;

    const editable = createCreatorWorkDraftFromAsset(persisted);
    expect(editable.workMode).toBe('collab');
    expect(editable.contentTypes).toEqual(['character', 'ui_code']);
    expect(editable.collaboration).toMatchObject(persisted.collaboration as object);
    expect(editable.collaboration.visibilityPolicy).toEqual({ showParticipantStatuses: false, showParticipantNotes: false, showParticipantDeadlineOverrides: false });
    expect(editable.collaboration).not.toBe(persisted.collaboration);
    expect(editable.collaboration.participants[0]).not.toBe(persisted.collaboration?.participants[0]);
  });

  it('keeps legacy draft visibility compatible while exposing only the two-axis visibility choices', () => {
    const persisted = {
      id: 'legacy-draft-visibility', title: 'Legacy draft visibility', category: 'prompts', content: '',
      uiCodeSnippet: '', icon: { type: 'emoji', value: '✦' }, tags: [],
      visibility: 'draft', isPublic: false, status: 'draft', previewImages: [], folderId: null
    } as unknown as Asset;
    expect(createCreatorWorkDraftFromAsset(persisted).visibility).toBe('private');
    expect(workspaceSource).toContain('การมองเห็น');
    expect(workspaceSource).toContain("['private', '🔒 ส่วนตัว']");
    expect(workspaceSource).toContain("['public', '🌐 สาธารณะ']");
    expect(workspaceSource).not.toContain('Visibility<select');
  });

  it('keeps publication, visibility, and work progress as separate Composer concepts', () => {
    expect(workspaceSource).toContain('สถานะการเผยแพร่');
    expect(workspaceSource).toContain('publicationStatus === value');
    expect(workspaceSource).toContain('workStatus === option.value');
    expect(workspaceSource).toContain('📝 แบบร่าง');
    expect(workspaceSource).toContain('✅ เผยแพร่แล้ว');
    expect(workspaceSource).toContain('🟠 รอข้อมูล');
    expect(workspaceSource).toContain('🔵 รอตรวจ');
    expect(workspaceSource).toContain('🟣 รอแก้ไข');
    expect(workspaceSource).toContain('🔴 ติดปัญหา');
    expect(workspaceSource).toContain('⏸️ พักไว้');
    expect(workspaceSource).not.toContain('className={status === value');
    expect(workspaceSource).not.toContain('setStatus(value)');
  });

  it('allows content type selection to return to zero', () => {
    expect(workspaceSource).toContain('onClick={() => setContentTypes(previous => toggleSelection(previous, option.value))}');
    expect(workspaceSource).toContain("contentTypes.length > 0 ? `${contentTypes.length} ประเภทที่เลือก` : \"ยังไม่เลือก\"");
    expect(workspaceSource).not.toContain('previous.length === 1 && previous[0] === option.value');
  });

  it('keeps the short-description label and character counter on a dedicated aligned row', () => {
    expect(workspaceSource).toContain('คำอธิบายสั้น <span className="csp-field-count">{description.length}/240</span>');
    expect(workspaceSource).toContain('maxLength={240}');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-composer-setup > .csp-field:nth-of-type(2)');
    expect(workspaceStyles).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(workspaceStyles).toContain('grid-column: 1 / -1');
  });

  it('applies the D.2.1 copy cleanup and heading hierarchy', () => {
    expect(workspaceSource).not.toContain('CREATOR COMPOSER');
    expect(workspaceSource).not.toContain('ทดลอง');
    expect(composerSources).not.toContain('พรอมต์สร้างภาพ');
    expect(composerSources).not.toContain('พรอมต์ / เทมเพลตบอท');
    expect(composerSources).not.toContain('Gore');
    expect(composerSources).not.toContain('Worldbuilding');
    expect(composerSources).toContain('พรอมต์เจนรูป');
    expect(composerSources).toContain('พรอมต์ / OOC / เทมเพลตบอท');
    expect(workspaceSource).toContain('<h2 id="csp-composer-settings-title">การตั้งค่าผลงาน</h2>');
    expect(workspaceSource).toContain('<h2>ข้อมูลพื้นฐาน</h2>');
  });

  it('keeps the five-tab Composer anatomy while preserving temporary inner surfaces', () => {
    expect(workspaceSource).toContain("...(workMode === 'collab' ? [['collab', 'คอลแลป'] as const] : [])");
    expect(workspaceSource).toContain("['settings', 'การตั้งค่าผลงาน'], ['review', 'ตรวจสอบ']");
    expect(workspaceSource).toContain('className="csp-work-main"');
    expect(workspaceSource).not.toContain('className="csp-work-sidebar"');
    expect(workspaceSource).not.toContain('isInspectorOpen');
    expect(workspaceSource).not.toContain('csp-inspector-toggle');
    expect(workspaceSource).toContain('className="csp-modal-footer"');
    expect(workspaceSource).toContain('className="csp-unified-icon-picker"');
    expect(workspaceSource).toContain('csp-composer-settings');
    expect(workspaceSource).toContain('csp-selection-card');
    expect(workspaceSource).toContain('<CreatorContentCanvas');
    expect(canvasSource).toContain('csp-content-empty-state');
    expect(canvasSource).toContain('getSelectedContentTypes');
    expect(workspaceSource).toContain('<CreatorMediaCollection');
    expect(workspaceSource).toContain('csp-review-work-section');
    expect(workspaceSource).toContain('reviewPreviewMode');
    expect(workspaceSource).toContain('CreatorReviewPreview');
    expect(workspaceSource).not.toContain('reviewViewport');
    expect(workspaceSource).not.toContain('Desktop</button>');
    expect(workspaceSource).not.toContain('Mobile</button>');
    expect(workspaceSource).toContain("disabled={isSaving || !(workMode === 'collab' ? collaboration.name.trim() : title.trim())}");
    expect(workspaceSource).toContain('onClick={onClose}>ยกเลิก</button>');
    expect(workspaceSource).toContain("{section === 'review' && <footer className=\"csp-modal-footer\"");
    expect(workspaceSource).toContain("data-review-actions={section === 'review'}");

    expect(workspaceStyles).toContain('.csp-work-modal > .csp-modal-header');
    expect(workspaceStyles).toContain('.csp-work-modal > .csp-work-nav');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-work-main > .csp-work-section');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-composer-settings');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-content-type-grid');
    expect(workspaceStyles).toContain('.csp-work-modal [data-preview-section="ui-code"]');
    expect(workspaceStyles).toContain('.csp-work-modal > .csp-modal-footer');
    expect(workspaceStyles).toContain('@media (max-width: 520px)');
  });

  it('keeps the dedicated settings tab connected to the existing draft contracts', () => {
    expect(workspaceSource).toContain('csp-composer-settings');
    expect(workspaceSource).toContain('การตั้งค่าผลงาน');
    expect(workspaceSource).toContain('visibility === value');
    expect(workspaceSource).toContain('workStatus === option.value');
    expect(workspaceSource).toContain("value={folderId || ''}");
    expect(workspaceSource).toContain('setTags(previous => previous.filter');
    expect(workspaceSource).toContain('onClick={() => void saveWork()}');
    expect(workspaceSource).toContain('setAppPlatforms(previous => toggleSelection(previous, platform))');
    expect(workspaceSource).toContain('setContentWarnings(previous => toggleSelection(previous, warning))');
    expect(workspaceSource).toContain('setGenres(previous => toggleSelection(previous, genre))');
  });

  it('normalizes legacy single categories without putting apps into content types', () => {
    expect(normalizeCreatorContentTypes('character')).toEqual(['character']);
    expect(normalizeCreatorContentTypes('app_data')).toEqual(['bot_prompt']);
    expect(normalizeCreatorContentTypes('prompts', ['ui_code', 'ui_code', 'image_prompt'])).toEqual(['ui_code', 'image_prompt']);
    expect(buildWorkDraftPreview(draft).contentTypes).toEqual(['ui_code', 'image_prompt']);
    expect(workspaceSource).toContain("category: workMode === 'collab' ? 'collab'");
    expect(buildWorkDraftPreview(draft).appPlatforms).toEqual(['Doki Chat']);
    expect(buildWorkDraftPreview(draft).contentWarnings).toEqual(['สยองขวัญ']);
    expect(buildWorkDraftPreview(draft).genres).toEqual(['แฟนตาซี']);
  });

  it('serializes the complete draft once while Review receives the public persisted projection', () => {
    expect(workspaceSource).toContain("{section === 'collab' && workMode === 'collab' && <CreatorCollabPanel");
    expect(workspaceSource).toContain('collaboration: cloneCreatorCollaborationDraft(draft.collaboration)');
    expect(workspaceSource).toContain('serializeCreatorWorkDraft');
    expect(workspaceSource).toContain('allAssets={ownedWorks}');
    expect(workspaceSource).not.toContain('collaborationDisplayContext={reviewCollaborationDisplayContext}');
    expect(workspaceSource).toContain('ownedWorks={ownedWorks}');
  });
});
