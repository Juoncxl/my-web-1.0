import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const assetCardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const collectionSource = readFileSync(new URL('./AssetCollectionView.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const folderSource = readFileSync(new URL('./FolderDetailModal.tsx', import.meta.url), 'utf8');

describe('Work Card three-dot menu dismissal', () => {
  it('dismisses the menu before every menu action, including Copy', () => {
    expect(assetCardSource).toContain('const handleMenuAction =');
    expect(assetCardSource).toContain('window.dispatchEvent(new CustomEvent(\'creator-vault:card-menu-open\'');
    expect(assetCardSource).toContain('onClick={handleQuickCopy}');

    const copyHandlerStart = assetCardSource.indexOf('const handleQuickCopy');
    const copyHandlerEnd = assetCardSource.indexOf('const handleLike', copyHandlerStart);
    expect(copyHandlerStart).toBeGreaterThanOrEqual(0);
    expect(copyHandlerEnd).toBeGreaterThan(copyHandlerStart);
    expect(assetCardSource.slice(copyHandlerStart, copyHandlerEnd)).toContain('setMenuOpen(false);');
  });

  it('supports outside-pointer, Escape, and cross-card dismissal', () => {
    expect(assetCardSource).toContain('const menuRef = useRef<HTMLDivElement>(null);');
    expect(assetCardSource).toContain("document.addEventListener('pointerdown', closeOnOutsidePointer)");
    expect(assetCardSource).toContain("document.addEventListener('keydown', closeOnEscape)");
    expect(assetCardSource).toContain("event.key === 'Escape'");
    expect(assetCardSource).toContain('ref={menuRef}');
  });

  it('routes the other menu actions through the existing closing handler', () => {
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onFork(asset))}');
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onReport(asset))}');
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onEdit(asset))}');
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onOpenMoveToFolder(asset))}');
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onDelete(asset))}');
    expect(assetCardSource).toContain('onClick={handleMenuAction(() => onRestore(asset.id))}');
  });

  it('reuses the same AssetCard menu across Vault, Creator Space, and Folder Detail', () => {
    expect(collectionSource).toContain("import { AssetCard } from './AssetCard';");
    expect(creatorSource).toContain("import { AssetCard } from '../components/AssetCard';");
    expect(folderSource).toContain("import { AssetCard } from './AssetCard';");
  });
});
