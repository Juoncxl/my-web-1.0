import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./creator/CreatorReviewPreview.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./creator/CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const cleanupCss = cssSource.slice(cssSource.indexOf('Phase 1.5N Item 12E.1'));

describe('12E.1 Work Card and Work Detail presentation cleanup', () => {
  it('uses the explicit cover before gallery media, keeps its source intact, and presents Card cover as a square', () => {
    expect(cardSource).toContain('const mainImage = asset.previewImage || asset.previewImages?.[0];');
    expect(cardSource).toContain('cv-card-author-avatar-fallback');
    expect(cardSource).not.toContain('images.unsplash.com');
    expect(cleanupCss).toContain('.cv-card-cover { aspect-ratio: 1 / 1; }');
    expect(cssSource).toContain('.cv-card-cover-image { width: 100%; height: 100%; display: block; object-fit: cover;');
  });

  it('uses one canonical Card metadata row and keeps the cover free of repeated metadata', () => {
    expect(cardSource).toContain('<h3>{cardTitle}</h3>');
    expect(cardSource).toContain('display.summary || asset.content');
    expect(cardSource).toContain('isPublicFeedVisibility(asset)');
    expect(cardSource).toContain('statusMeta.name');
    expect(cardSource).toContain('categoryLabelOverride');
    expect(cardSource).toContain('cv-card-meta-actions');
    expect(cardSource).not.toContain('cv-cover-topline');
    expect(cardSource).not.toContain('cv-card-cover-overlay');
    expect(cardSource).not.toContain('cv-card-tags');
    expect(cardSource).not.toContain('handleTagClick');
    expect((cardSource.match(/cv-card-icon/g) || []).length).toBe(1);
  });

  it('keeps Work Detail media natural, removes duplicate chrome, and retains readable user-facing content', () => {
    expect(cleanupCss).toContain('.work-detail-cover { display: grid; place-items: center; min-height: 11rem; aspect-ratio: auto;');
    expect(cleanupCss).toContain('.work-detail-cover > img { position: relative; inset: auto; display: block; width: auto; height: auto;');
    expect(cleanupCss).toContain('object-fit: contain;');
    expect(detailSource).not.toContain('work-detail-eyebrow');
    expect(detailSource).not.toContain('ตัวอย่างจากข้อมูลปัจจุบัน');
    expect(detailSource).not.toContain('<span>#VAULT-');
    expect(detailSource).toContain('work-detail-history-control');
    expect(detailSource).toContain('ประวัติ ({asset.versions?.length || 1})');
    expect(detailSource).toContain('<h3 id="work-detail-title">{display.title}</h3>');
    expect(detailSource).toContain('ยังไม่มีคำอธิบายสั้นสำหรับผลงานชิ้นนี้');
    expect(detailSource).toContain('ยังไม่มีข้อมูลเนื้อหาในผลงานชิ้นนี้');
    expect(detailSource).toContain('ยังไม่มีแท็กสำหรับผลงานชิ้นนี้');
    expect(detailSource).toContain('asset.contentTypeLabels?.length');
    expect(detailSource).toContain('ยังไม่ได้เลือกโฟลเดอร์');
    expect(detailSource).toContain('work-detail-prompt-meta');
    expect(detailSource).toContain('ยังไม่ได้ระบุเครื่องมือหรือโมเดลสำหรับพรอมต์นี้');
    expect(detailSource).toContain('ผลงานที่เชื่อมโยงจากรายการเดียวกัน');
  });

  it('shows only public Collaboration information and reuses cleaned Card and Detail surfaces for Review', () => {
    expect(detailSource).toContain('publicCollaborationBlocks');
    expect(detailSource).toContain('ข้อมูลกลางของคอลแลป');
    expect(detailSource).toContain("const legacyContent = asset.category === 'collab' ? '' : resolvedLegacyContent;");
    expect(detailSource).not.toContain('work-detail-collab-summary');
    expect(previewSource).toContain('<AssetCard asset={cardAsset}');
    expect(previewSource).toContain('<WorkDetailModal asset={asset}');
    expect(previewSource).toContain('interactionMode="preview"');
    expect(workspaceSource).toContain('serializeCreatorWorkDraft');
    expect(cleanupCss).toContain('@media (max-width: 840px)');
  });
});
