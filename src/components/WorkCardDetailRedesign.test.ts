import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./creator/CreatorReviewPreview.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const redesignStyles = styles.slice(styles.indexOf('Phase 1.5N Item 12E.2'));

describe('12E.2 final Work Card + Work Detail visual redesign', () => {
  it('keeps real covers square, non-destructive, and free from fallback decoration', () => {
    expect(cardSource).toContain('const mainImage = asset.previewImage || asset.previewImages?.[0];');
    expect(cardSource).toContain('className="cv-card-cover-image"');
    expect(cardSource).not.toContain('cv-fallback-symbol');
    expect(redesignStyles).toContain('.cv-card-cover {');
    expect(redesignStyles).toContain('aspect-ratio: 1 / 1;');
    expect(redesignStyles).toContain('object-fit: cover;');
    expect(redesignStyles).toContain('.cv-card-cover-image,');
    expect(redesignStyles).toContain('transform: none;');
  });

  it('uses restrained fallback decoration and a single Work Icon near the title', () => {
    expect(cardSource).toContain('cv-card-fallback cv-fallback-');
    expect(cardSource).toContain('className="cv-fallback-orbit cv-fallback-orbit-one"');
    expect(cardSource).toContain('className="cv-card-icon"');
    expect((cardSource.match(/className="cv-card-icon"/g) || []).length).toBe(1);
    expect(redesignStyles).toContain('.cv-card-fallback::after { opacity: .16;');
  });

  it('places real Like and Save actions in the lightweight boundary capsule', () => {
    expect(cardSource).toContain('className="cv-card-quick-actions"');
    expect(cardSource).toContain('onClick={handleLike}');
    expect(cardSource).toContain('onClick={handleBookmark}');
    expect(cardSource).toContain('(onLike || onBookmark) && !isTrashMode && <div className="cv-card-quick-actions"');
    expect(redesignStyles).toContain('backdrop-filter: blur(14px) saturate(115%);');
    expect(redesignStyles).toContain('bottom: -1.15rem;');
  });

  it('keeps Card summary metadata canonical and readable', () => {
    expect(cardSource).toContain('cv-card-meta-actions');
    expect(cardSource).toContain('isPublicFeedVisibility(asset)');
    expect(cardSource).toContain('statusMeta.name');
    expect(cardSource).toContain('<h3>{cardTitle}</h3>');
    expect(cardSource).toContain('display.summary || asset.content');
    expect(cardSource).toContain('className="cv-card-date"');
    expect(redesignStyles).toContain('.cv-card-title-row h3 { color: #01162b; font-size: 1.1rem;');
    expect(redesignStyles).toContain('.cv-card-snippet { min-height: 3.1rem;');
  });

  it('keeps Detail natural media, real content, and removes reference-only decoration', () => {
    expect(detailSource).toContain('className={`work-detail-cover ${activeImageIndex >= 0');
    expect(detailSource).toContain('resolveWorkPresentationContent(asset)');
    expect(detailSource).not.toContain('ABYSSAL DEEP REFLECTION');
    expect(detailSource).not.toContain('Ethereal Color Keys');
    expect(detailSource).not.toContain('#VAULT-CREATOR-');
    expect(redesignStyles).toContain('.work-detail-cover.has-image::after { display: none; }');
    expect(redesignStyles).toContain('.work-detail-cover > img { width: auto; height: auto;');
  });

  it('limits Detail metadata and keeps secondary values as simple chips', () => {
    expect(detailSource).toContain('const detailMetadataItems = [');
    expect(detailSource).toContain('.slice(0, 4);');
    expect(detailSource).toContain('work-detail-secondary-metadata');
    expect(detailSource).toContain('data-work-detail-section="draft-metadata"');
    expect(redesignStyles).toContain('.work-detail-presentation-metadata { grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('keeps Owner and Visitor actions distinct while reusing existing handlers', () => {
    expect(detailSource).toContain('data-work-detail-actions={isOwner ? \'owner\' : \'visitor\'}');
    expect(detailSource).toContain('!isOwner && onLike');
    expect(detailSource).toContain('!isOwner && onBookmark');
    expect(detailSource).toContain('isOwner && onEdit');
    expect(detailSource).toContain('isOwner && onMoveToFolder');
    expect(detailSource).not.toContain('ติดตามตัวเอง');
    expect(appSource).toContain('onLike={handleLikeAsset}');
    expect(appSource).toContain('isLiked={viewingAsset ? likedAssetIds.includes(viewingAsset.id) : false}');
    expect(creatorSource).toContain('onLike={!isEditing && activeTab !== \'trash\' ? onLike : undefined}');
  });

  it('keeps Review Card and Review Detail aligned with the canonical components', () => {
    expect(previewSource).toContain("import { AssetCard } from '../AssetCard';");
    expect(previewSource).toContain("import { WorkDetailModal } from '../WorkDetailModal';");
    expect(previewSource).toContain('<AssetCard asset={cardAsset}');
    expect(previewSource).toContain('<WorkDetailModal asset={asset}');
    expect(previewSource).not.toContain('Ethereal Color Keys');
    expect(previewSource).not.toContain('ABYSSAL DEEP REFLECTION');
  });

  it('keeps Ocean/Galaxy balance responsive in Light and Dark modes', () => {
    for (const color of ['#01162b', '#00385a', '#6a90b4', '#94a2bf', '#d2dbeb', '#b199db', '#724972', '#e9ccd3']) {
      expect(redesignStyles).toContain(color);
    }
    expect(redesignStyles).toContain('.dark .cv-asset-card');
    expect(redesignStyles).toContain('.dark .work-detail-modal');
    expect(redesignStyles).toContain('@media (max-width: 720px)');
    expect(redesignStyles).toContain('.work-detail-grid { grid-template-columns: 1fr; }');
    expect(redesignStyles).toContain('.work-detail-footer-actions { justify-content: stretch; }');
  });
});
