import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const collectionSource = readFileSync(new URL('./AssetCollectionView.tsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./CreatorProfilePreview.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');

describe('public Creator identity on Work cards', () => {
  it('loads canonical public profiles for cards instead of restoring legacy avatar blobs', () => {
    expect(collectionSource).toContain('usePublicCreatorProfiles(allAssets, currentUser)');
    expect(collectionSource).toContain('creatorProfile={creatorProfilesById.get(asset.userId) || null}');
    expect(cardSource).toContain('resolveWorkCreator(asset, resolvedCreatorProfile)');
  });

  it('loads the same canonical public profile in Work Detail for signed-out visitors', () => {
    expect(detailSource).toContain('usePublicCreatorProfiles(creatorProfileAssets, creatorProfile)');
    expect(detailSource).toContain('creatorProfile || publicCreatorProfiles.get(asset.userId) || null');
    expect(detailSource).toContain('resolveWorkCreator(asset, canonicalCreatorProfile)');
  });

  it('opens a compact creator profile without opening the Work card', () => {
    expect(cardSource).toContain('event.stopPropagation();');
    expect(cardSource).toContain('onPreviewCreator?.(resolvedCreatorProfile, event.currentTarget)');
    expect(collectionSource).toContain('<CreatorProfilePreview profile={previewCreator} anchor={previewAnchor} onClose={closeCreatorPreview} />');
    expect(previewSource).toContain('ดูโปรไฟล์เต็ม');
    expect(previewSource).toContain('getCanonicalProfilePath(profile)');
    expect(previewSource).toContain("event.key === 'Escape'");
  });

  it('limits a participant copy action to the house tag and note body', () => {
    expect(detailSource).toContain('getParticipantTagCopy(participant.houseTag)');
    expect(detailSource).toContain('getParticipantContentCopy(participant.notes)');
    expect(detailSource).toContain('participant-tag-${participant.id}');
    expect(detailSource).toContain('participant-content-${participant.id}');
    expect(detailSource).not.toContain('participant.platforms.join');
    expect(detailSource).not.toContain('`สถานะข้อมูล: ${getCollabStatusLabel(participant.dataStatus)}`');
  });
});
