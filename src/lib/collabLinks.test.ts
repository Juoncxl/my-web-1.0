import { describe, expect, it } from 'vitest';
import { normalizeCollabLinks, publicCollabLinks, safeCollabLinkUrl } from './collabLinks';
import { createBlankCollabParticipant, createBlankCollaborationDraft, createPublicCollaborationSnapshot, cloneCreatorCollaborationDraft } from '../components/creator/creatorCollabModel';
import { d1CommitFields } from '../server/cxlDirectWrite';

describe('collaboration source links', () => {
  const links = [
    { id: 'private-doc', label: 'ตรวจงานเอง', url: 'https://docs.google.com/document/d/private', visibility: 'private' as const },
    { id: 'public-drive', label: 'รูปกลาง', url: 'https://drive.google.com/drive/folders/public', visibility: 'public' as const }
  ];
  it('keeps multiple named links and defaults old or missing visibility to private', () => {
    expect(normalizeCollabLinks([{ id: 'one', label: 'Word', url: 'https://example.com/doc' }])[0].visibility).toBe('private');
    expect(normalizeCollabLinks(links)).toEqual(links);
    expect(normalizeCollabLinks(undefined)).toEqual([]);
  });
  it('allows only ordinary web URLs and rejects executable URLs and embedded credentials', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///D:/private', 'https://user:password@example.com', 'not a url', '//example.com']) expect(safeCollabLinkUrl(url)).toBeNull();
    expect(safeCollabLinkUrl('https://drive.google.com/file/d/abc?usp=sharing')).toBe('https://drive.google.com/file/d/abc?usp=sharing');
  });
  it('exports only explicit public safe links at both collaboration and participant levels', () => {
    const draft = { ...createBlankCollaborationDraft(), name: 'Links', links, participants: [createBlankCollabParticipant({ creatorName: 'A', links })] };
    const clone = cloneCreatorCollaborationDraft(draft);
    expect(clone.links).toEqual(links);
    expect(clone.participants[0].links).toEqual(links);
    clone.links![0].label = 'changed';
    expect(draft.links[0].label).toBe('ตรวจงานเอง');
    const snapshot = createPublicCollaborationSnapshot(draft);
    expect(snapshot.links).toEqual([links[1]]);
    expect(snapshot.participants[0].links).toEqual([links[1]]);
    expect(JSON.stringify(snapshot)).not.toContain('private-doc');
    expect(publicCollabLinks([{ ...links[1], url: 'javascript:alert(1)' }])).toEqual([]);
  });
  it('keeps private links out of the live D1 public projection, including its nested asset', () => {
    const draft = { ...createBlankCollaborationDraft(), name: 'Links', links, participants: [createBlankCollabParticipant({ creatorName: 'A', links })] };
    const row = { id: 'links-work', user_id: 'owner', category: 'collab', title: 'Links', status: 'draft', visibility: 'public', is_public: true, created_at: '2026-11-03', updated_at: '2026-11-03' };
    const projection = d1CommitFields({ revision: 1, row, collaborationDraft: draft, mediaRecords: [], cxlAsset: { ...row, collaboration: draft, publicCollaboration: { ...createPublicCollaborationSnapshot(draft), links, participants: [{ ...draft.participants[0] }] } } }).publicProjection;
    expect(projection.public_collaboration.links).toEqual([links[1]]);
    expect(projection.public_collaboration.participants[0].links).toEqual([links[1]]);
    expect(JSON.stringify(projection)).not.toContain('private-doc');
  });
});
