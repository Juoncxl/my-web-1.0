import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const header = read('./Header.tsx');
const detail = read('./WorkDetailModal.tsx');
const workspace = read('./creator/CreatorWorkWorkspace.tsx');

describe('idea inbox placement (Owner only)', () => {
  it('opens the global inbox from the account menu', () => {
    expect(header).toContain('กล่องไอเดีย');
    expect(header).toContain('<IdeaInboxModal');
  });

  it('shows a Work\'s ideas on its detail page for the Owner only, not in the composer preview', () => {
    expect(detail).toContain("{isOwner && interactionMode !== 'preview' && asset && <section");
    expect(detail).toContain('ไอเดียของงานนี้');
    expect(detail).toContain('<IdeaList workId={asset.id} />');
  });

  it('adds an ideas tab to the editor for saved Works only', () => {
    expect(workspace).toContain("type WorkSection = 'details' | 'content' | 'media' | 'collab' | 'settings' | 'review' | 'ideas';");
    expect(workspace).toContain("initialData?.id ? [['ideas', 'ไอเดีย'] as const] : []");
    expect(workspace).toContain('<IdeaList workId={initialData.id} />');
  });
});
