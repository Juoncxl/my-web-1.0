import { describe, expect, it } from 'vitest';
import type { Asset } from '../../types';
import { buildWorkDraftPreview, createBlankCreatorWorkDraft, createCreatorWorkDraftFromAsset, type CreatorWorkDraft } from './CreatorWorkWorkspace';

const draft: CreatorWorkDraft = {
  title: '  Current draft  ', category: 'ui_code', description: ' Draft description ', visibility: 'public', status: 'in_progress',
  icon: { type: 'emoji', value: '✦' }, content: 'Current content',
  contentBlocks: [
    { id: 'text-1', type: 'Text', title: 'Main', body: 'MAIN CONTENT TEST' },
    { id: 'ui-1', type: 'UI Code', title: 'UI Code', body: '<p>Current</p><style>p{color:red}</style>' }
  ],
  uiCodeSnippet: '<p>Current</p><style>p{color:red}</style>', previewImages: ['data:image/png;base64,current'], tags: ['live']
};

describe('CreatorWorkWorkspace live draft preview', () => {
  it('starts Create mode from a clean draft without prior Work state', () => {
    expect(createBlankCreatorWorkDraft()).toMatchObject({ title: '', description: '', content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: [], tags: [] });
  });

  it('derives the preview from current draft values without mutating the input', () => {
    const preview = buildWorkDraftPreview(draft);
    expect(preview.title).toBe('Current draft');
    expect(preview.description).toBe('Draft description');
    expect(preview.content).toBe('Current content');
    expect(preview.contentBlocks).toEqual(draft.contentBlocks);
    expect(preview.contentBlocks).not.toBe(draft.contentBlocks);
    expect(preview.previewImages).toEqual(['data:image/png;base64,current']);
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
      visibility: 'private', isPublic: false, status: 'finished', previewImages: []
    } as unknown as Asset;
    const editable = createCreatorWorkDraftFromAsset(persisted);

    expect(editable.description).toBe('');
    expect(editable.contentBlocks.map(block => block.type)).toEqual(['Text', 'UI Code']);
    editable.contentBlocks[0].body = 'UNSAVED CHANGE';
    editable.tags.push('unsaved');
    expect(persisted.content).toBe('LEGACY MAIN CONTENT');
    expect(persisted.tags).toEqual(['saved']);
  });
});
