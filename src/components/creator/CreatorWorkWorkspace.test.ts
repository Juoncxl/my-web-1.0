import { describe, expect, it } from 'vitest';
import { buildWorkDraftPreview, type CreatorWorkDraft } from './CreatorWorkWorkspace';

const draft: CreatorWorkDraft = {
  title: '  Current draft  ', category: 'ui_code', description: ' Draft description ', visibility: 'public', status: 'in_progress',
  icon: { type: 'emoji', value: '✦' }, content: 'Current content', uiCodeSnippet: '<p>Current</p>', previewImages: ['data:image/png;base64,current'], tags: ['live']
};

describe('CreatorWorkWorkspace live draft preview', () => {
  it('derives the preview from current draft values without mutating the input', () => {
    const preview = buildWorkDraftPreview(draft);
    expect(preview.title).toBe('Current draft');
    expect(preview.description).toBe('Draft description');
    expect(preview.content).toBe('Current content');
    expect(preview.previewImages).toEqual(['data:image/png;base64,current']);
    expect(preview).not.toBe(draft);
    expect(draft.title).toBe('  Current draft  ');
  });

  it('uses the current description when the draft has no separate content', () => {
    expect(buildWorkDraftPreview({ ...draft, content: '' }).content).toBe('Draft description');
  });
});
