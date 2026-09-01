import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const legacyEntrySource = readFileSync(new URL('./AssetViewModal.tsx', import.meta.url), 'utf8');

describe('canonical Work Detail routing', () => {
  it('mounts WorkDetailModal from both primary Work Card flows', () => {
    expect(appSource).toContain("from './components/WorkDetailModal'");
    expect(appSource).toContain('<WorkDetailModal');
    expect(creatorSource).toContain("from '../components/WorkDetailModal'");
    expect(creatorSource).toContain('<WorkDetailModal');
    expect(appSource).not.toContain("from './components/AssetViewModal'");
    expect(creatorSource).not.toContain("from '../components/AssetViewModal'");
    expect(cardSource).toContain('onClick={() => onClick(asset)}');
    expect(creatorSource).toContain('onClick={setSelectedAsset}');
  });

  it('keeps the legacy entry as a compatibility alias without a second presentation', () => {
    expect(legacyEntrySource).toContain("WorkDetailModal as AssetViewModal");
    expect(legacyEntrySource).not.toContain('return <');
    expect(detailSource).toContain('data-work-detail-presentation="canonical"');
    expect(detailSource).toContain('resolveWorkPresentationContent(asset)');
    expect(detailSource).toContain('data-work-detail-section="short-description"');
    expect(detailSource).toContain('<WorkContentBlocksSection');
    expect(detailSource).toContain('<AssetViewCodeSection code={uiCode}');
  });
});
