import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./CreatorReviewPreview.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../WorkDetailModal.tsx', import.meta.url), 'utf8');

describe('Creator Composer D.5 Review presentation contracts', () => {
  it('defaults to Work Card and switches to Work Detail without leaving Composer', () => {
    expect(workspaceSource).toContain("useState<CreatorReviewMode>('card')");
    expect(workspaceSource).toContain('🗂️ การ์ดผลงาน');
    expect(workspaceSource).toContain('📖 หน้ารายละเอียด');
    expect(workspaceSource).toContain('เลือกมุมมองตัวอย่าง');
    expect(workspaceSource).toContain('csp-review-mode-control');
    expect(workspaceSource).toContain('setReviewPreviewMode');
    expect(workspaceSource).toContain('<CreatorReviewPreview');
  });

  it('reuses the canonical AssetCard and WorkDetail presentation components', () => {
    expect(previewSource).toContain("import { AssetCard } from '../AssetCard';");
    expect(previewSource).toContain("import { WorkDetailModal } from '../WorkDetailModal';");
    expect(previewSource).toContain('<AssetCard asset={cardAsset}');
    expect(previewSource).toContain('interactionMode="preview"');
    expect(previewSource).toContain('allAssets={allAssets}');
    expect(previewSource).not.toContain('categoryLabelOverride');
    expect(previewSource).not.toContain('presentationMetadata?:');
    expect(previewSource).toContain('<WorkDetailModal asset={asset}');
    expect(workspaceSource).toContain('imagePromptToolModel: draftPreview.contentCanvas.imagePrompt.toolModel');
    expect(detailSource).toContain('embedded?: boolean');
    expect(detailSource).toContain('coverImage?: string');
  });

  it('removes device modes and legacy debug presentation from Review', () => {
    expect(workspaceSource).not.toContain('reviewViewport');
    expect(workspaceSource).not.toContain('Desktop</button>');
    expect(workspaceSource).not.toContain('Mobile</button>');
    expect(workspaceSource).not.toContain('Main Content');
    expect(workspaceSource).not.toContain('data-preview-section="content-blocks"');
    expect(workspaceSource).not.toContain('csp-review-card ${reviewViewport');
  });

  it('supports full preview for both presentation modes while retaining safe UI Code preview', () => {
    expect(workspaceSource).toContain("fullPreviewKind === 'ui-code'");
    expect(workspaceSource).toContain("fullPreviewKind !== 'ui-code'");
    expect(workspaceSource).toContain('showFullButton={false}');
    expect(workspaceSource).toContain('<SandboxedCodePreview code={contentCanvas.uiCode}');
    expect(previewSource).toContain('onOpenFullPreview');
    expect(detailSource).toContain('<CodePresentation code={uiCode}');
  });
});
