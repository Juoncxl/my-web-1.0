import { describe, expect, it } from 'vitest';
import { resolveWorkPresentationContent } from './workContent';

describe('Work content mapping', () => {
  it('keeps short description independent from Text and UI Code blocks', () => {
    const result = resolveWorkPresentationContent({
      shortDescription: 'SHORT DESCRIPTION TEST',
      content: 'MAIN CONTENT TEST',
      contentBlocks: [
        { id: 'text-1', type: 'Text', title: 'Main', body: 'MAIN CONTENT TEST' },
        { id: 'ui-1', type: 'UI Code', title: 'UI Code', body: '<div>SAFE</div><style>div{color:white}</style>' }
      ],
      uiCodeSnippet: 'legacy-code'
    });
    expect(result.shortDescription).toBe('SHORT DESCRIPTION TEST');
    expect(result.shortDescription).not.toContain('MAIN CONTENT TEST');
    expect(result.shortDescription).not.toContain('<style>');
    expect(result.uiCode).toContain('<style>');
    expect(result.contentBlocks[0].body).toBe('MAIN CONTENT TEST');
  });

  it('uses legacy content and UI Code only when structured fields are unavailable', () => {
    expect(resolveWorkPresentationContent({ content: 'Legacy content', uiCodeSnippet: '<p>Legacy UI</p>' })).toEqual({
      shortDescription: '', contentBlocks: [], legacyContent: 'Legacy content', uiCode: '<p>Legacy UI</p>'
    });
  });
});
