import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollabLinks, CollabLinksEditor } from './CollabLinks';
import { CollabProgressSummary } from './CollabProgressSummary';
import { summarizeCollabParticipants } from '../lib/collabParticipantSummary';
import { WorkDetailModal } from './WorkDetailModal';
import { createBlankCollaborationDraft, createBlankCollabParticipant, createPublicCollaborationSnapshot } from './creator/creatorCollabModel';
import { createPublicAssetExport } from './creator/creatorWorkSerializer';
import { serializeGoogleWork, deserializeGoogleWork } from '../data/adapters/google/googleRecord';
import type { Asset } from '../types';

describe('compact links and progress display', () => {
  const links = [
    { id: 'private', label: 'Private doc', url: 'https://example.com/private', visibility: 'private' as const },
    { id: 'public', label: 'Public Drive', url: 'https://drive.google.com/file/d/abc', visibility: 'public' as const }
  ];
  it('renders only public links for visitors and all links for the owner, opening a new tab', () => {
    const visitor = renderToStaticMarkup(<CollabLinks links={links} />);
    expect(visitor).toContain('Public Drive');
    expect(visitor).toContain('target="_blank"');
    expect(visitor).toContain('rel="noopener noreferrer"');
    expect(visitor).not.toContain('example.com/private');
    const owner = renderToStaticMarkup(<CollabLinks links={links} owner />);
    expect(owner).toContain('Private doc');
    expect(owner).toContain('เฉพาะฉัน');
  });
  it('does not render unsafe link targets even on the owner view', () => {
    expect(renderToStaticMarkup(<CollabLinks links={[{ ...links[0], url: 'javascript:alert(1)' }]} owner />)).toBe('');
    const editor = renderToStaticMarkup(<CollabLinksEditor links={[{ ...links[0], url: 'javascript:alert(1)' }]} onChange={() => {}} label="เอกสาร" />);
    expect(editor).toContain('aria-invalid="true"');
    expect(editor).not.toContain('href="javascript:');
  });
  it('keeps the 77-entry missing list folded until requested', () => {
    const summary = summarizeCollabParticipants(Array.from({ length: 77 }, (_, i) => ({ id: String(i), creatorName: `Creator ${i}`, dataStatus: 'not_submitted' as const, imageStatus: 'not_submitted' as const })));
    const html = renderToStaticMarkup(<CollabProgressSummary summary={summary} />);
    expect(html).toContain('ข้อมูลผ่าน 0/77');
    expect(html).toContain('ดูรายการที่ยังขาด (77)');
    expect(html).toContain('<details');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
  });

  it('persists private links for the owner but omits them in visitor detail and downloads', () => {
    const draft = { ...createBlankCollaborationDraft(), name: 'Links', links, participants: [createBlankCollabParticipant({ creatorName: 'A', links })] };
    const asset = { id: 'link-work', userId: 'owner', title: 'Links', category: 'collab', authorName: 'Owner', icon: { type: 'emoji', value: '✨' }, content: '', status: 'draft', tags: [], visibility: 'public', isPublic: true, createdAt: '', updatedAt: '', collaboration: draft, publicCollaboration: createPublicCollaborationSnapshot(draft) } as Asset;
    const restored = deserializeGoogleWork(serializeGoogleWork(asset))!;
    expect(restored.collaboration?.links).toEqual(links);
    expect(restored.collaboration?.participants[0].links).toEqual(links);
    const visitor = renderToStaticMarkup(<WorkDetailModal asset={restored} isOpen embedded onClose={() => {}} />);
    expect(visitor).toContain('Public Drive');
    expect(visitor).not.toContain('example.com/private');
    const owner = renderToStaticMarkup(<WorkDetailModal asset={restored} isOpen embedded isOwner onClose={() => {}} />);
    expect(owner).toContain('Private doc');
    const exported = createPublicAssetExport({ ...restored, publicCollaboration: { ...restored.publicCollaboration!, links, participants: [{ ...restored.publicCollaboration!.participants[0], links }] } });
    expect(JSON.stringify(exported)).not.toContain('example.com/private');
    expect(JSON.stringify(exported)).toContain('drive.google.com');
  });
});
