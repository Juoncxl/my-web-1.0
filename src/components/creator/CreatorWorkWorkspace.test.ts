import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Asset } from '../../types';
import { buildWorkDraftPreview, createBlankCreatorWorkDraft, createCreatorWorkDraftFromAsset, limitWorkIconInput, type CreatorWorkDraft } from './CreatorWorkWorkspace';

const draft: CreatorWorkDraft = {
  title: '  Current draft  ', category: 'ui_code', description: ' Draft description ', visibility: 'public', status: 'in_progress',
  folderId: 'folder-qa',
  icon: { type: 'emoji', value: '✦' }, content: 'Current content',
  contentBlocks: [
    { id: 'text-1', type: 'Text', title: 'Main', body: 'MAIN CONTENT TEST' },
    { id: 'ui-1', type: 'UI Code', title: 'UI Code', body: '<p>Current</p><style>p{color:red}</style>' }
  ],
  uiCodeSnippet: '<p>Current</p><style>p{color:red}</style>', previewImages: ['data:image/png;base64,current'], tags: ['live']
};
const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const workspaceStyles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('CreatorWorkWorkspace live draft preview', () => {
  it('starts Create mode from a clean draft without prior Work state', () => {
    expect(createBlankCreatorWorkDraft()).toMatchObject({ title: '', description: '', folderId: null, content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: [], tags: [] });
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

  it('derives each Review Preview render from the latest unsaved block state', () => {
    const editedDraft = {
      ...draft,
      contentBlocks: draft.contentBlocks.map(block => block.id === 'text-1' ? { ...block, body: 'UNSAVED BLOCK EDIT' } : block)
    };
    expect(buildWorkDraftPreview(editedDraft).contentBlocks[0].body).toBe('UNSAVED BLOCK EDIT');
    expect(buildWorkDraftPreview(draft).contentBlocks[0].body).toBe('MAIN CONTENT TEST');
  });

  it('hydrates legacy edit data as Main Content without mutating persisted data on cancel', () => {
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

  it('keeps legacy draft visibility compatible while exposing only the two-axis visibility choices', () => {
    const persisted = {
      id: 'legacy-draft-visibility', title: 'Legacy draft visibility', category: 'prompts', content: '',
      uiCodeSnippet: '', icon: { type: 'emoji', value: '✦' }, tags: [],
      visibility: 'draft', isPublic: false, status: 'draft', previewImages: [], folderId: null
    } as unknown as Asset;
    expect(createCreatorWorkDraftFromAsset(persisted).visibility).toBe('private');
    const visibilityControl = workspaceSource.match(/Visibility<select[\s\S]*?<\/select>/)?.[0] || '';
    expect(visibilityControl).toContain('<option>ส่วนตัว</option>');
    expect(visibilityControl).toContain('<option>สาธารณะ</option>');
    expect(visibilityControl).not.toContain('แบบร่าง');
  });

  it('keeps the four-tab workspace anatomy while applying scoped visual cleanup', () => {
    expect(workspaceSource).toContain("[['details', 'ข้อมูลหลัก'], ['content', 'เนื้อหา'], ['media', 'สื่อ'], ['review', 'ตรวจสอบ']]");
    expect(workspaceSource).toContain('className="csp-work-main"');
    expect(workspaceSource).toContain('className="csp-work-sidebar"');
    expect(workspaceSource).toContain('className="csp-modal-footer"');
    expect(workspaceSource).toContain('className="csp-icon-picker"');
    expect(workspaceSource).toContain('className="csp-preset-grid"');
    expect(workspaceSource).toContain('className="csp-media-placeholder"');
    expect(workspaceSource).toContain('data-preview-section="content-blocks"');
    expect(workspaceSource).toContain('data-preview-section="ui-code"');
    expect(workspaceSource).toContain('disabled={isSaving || !title.trim()}');
    expect(workspaceSource).toContain('onClick={onClose}>ยกเลิก</button>');

    expect(workspaceStyles).toContain('.csp-work-modal > .csp-modal-header');
    expect(workspaceStyles).toContain('.csp-work-modal > .csp-work-nav');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-work-main > .csp-work-section');
    expect(workspaceStyles).toContain('.csp-work-modal .csp-work-sidebar > .csp-work-section');
    expect(workspaceStyles).toContain('.csp-work-modal [data-preview-section="ui-code"]');
    expect(workspaceStyles).toContain('.csp-work-modal > .csp-modal-footer');
    expect(workspaceStyles).toContain('@media (max-width: 520px)');
  });
});
