import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const reviewSource = readFileSync(new URL('./creator/CreatorReviewPreview.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./creator/CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('./asset-view/AssetViewContentSection.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('12E.2.1 Work presentation parity and action cleanup', () => {
  it('routes Review and Actual Card/Detail through shared canonical components and selector', () => {
    expect(reviewSource).toContain("import { AssetCard } from '../AssetCard';");
    expect(reviewSource).toContain("import { WorkDetailModal } from '../WorkDetailModal';");
    expect(cardSource).toContain('getWorkDisplayPresentation(asset, collaborationDisplayContext)');
    expect(detailSource).toContain('getWorkDisplayPresentation(asset)');
    expect(workspaceSource).toContain('serializeCreatorWorkDraft');
    expect(reviewSource).toContain('interactionMode="preview"');
  });

  it('removes generic Card-menu copy while retaining Like and Save quick actions', () => {
    expect(cardSource).not.toContain('คัดลอกเนื้อหา');
    expect(cardSource).not.toContain('handleQuickCopy');
    expect(cardSource).toContain('onClick={handleLike}');
    expect(cardSource).toContain('onClick={handleBookmark}');
  });

  it('keeps copy next to meaningful text/prompt/note content and never images or empties', () => {
    expect(detailSource).toContain("const isCopyable = ['Text', 'Prompt', 'Note'].includes(block.type) && isMeaningfulCopyText(body, block.title);");
    expect(detailSource).toContain('function isMeaningfulCopyText');
    expect(detailSource).toContain('label="คัดลอก"');
    expect(detailSource).not.toContain('คัดลอก block');
    expect(contentSource).toContain('const hasCopyableContent = Boolean(content.trim());');
    expect(contentSource).toContain('{hasCopyableContent && <button');
  });

  it('renders separate standard and Collaboration cards and includes every created Collaboration group', () => {
    expect(cardSource).toContain("display.isCollaborationFocused ? 'is-collaboration-card' : 'is-standard-card'");
    expect(cardSource).toContain('สรุปข้อมูลคอลแลป');
    expect(cardSource).toContain('ผู้เข้าร่วม {collaboration.participants.length} คน');
    expect(cardSource).not.toContain('participant.contact');
    expect(cardSource).toContain('<CollabCardSummary collaboration={collaboration} />');
    expect(appSource).toContain('serializeCreatorWorkDraft');
    expect(cssSource).toContain('repeat(4, minmax(0, 1fr))');
    expect(cssSource).toContain('.csp-free-canvas .csp-portfolio-showcase-grid');
    expect(cssSource).toContain('.csp-folder-detail-grid');
  });

  it('keeps Collaboration detail separate from an empty generic section', () => {
    expect(detailSource).toContain('publicCollaborationBlocks');
    expect(detailSource).toContain('ข้อมูลกลางของคอลแลป');
    expect(detailSource).toContain('!display.isCollaborationFocused');
    expect(detailSource).not.toContain('participant.contact');
    expect(detailSource).toContain('participant.deadlineOverrides');
    expect(detailSource).toContain('createPublicAssetExport(asset)');
  });

  it('preserves square Card cover and natural Detail media without image download controls', () => {
    expect(cardSource).toContain('const mainImage = asset.previewImage || asset.previewImages?.[0];');
    expect(detailSource).toContain('className={`work-detail-cover ${activeImageIndex >= 0');
    expect(`${cardSource}\n${detailSource}`).not.toMatch(/(?:Save|Download|Copy) Image|บันทึกรูป|ดาวน์โหลดรูป|คัดลอกรูป/);
  });
});
