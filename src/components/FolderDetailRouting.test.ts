import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./FolderDetailModal.tsx', import.meta.url), 'utf8');
const moveToFolderSource = readFileSync(new URL('./MoveToFolderModal.tsx', import.meta.url), 'utf8');
const detailCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('Folder Detail canonical viewport routing', () => {
  it('uses one canonical FolderDetailModal for Profile placement and Folder tab entry points', () => {
    expect(creatorSource.match(/<FolderDetailModal\b/g)).toHaveLength(1);
    expect(creatorSource.match(/openFolderDetail\(folder\.id\)/g)).toHaveLength(2);
    expect(creatorSource).toContain('const selectedFolder = folders.find(folder => folder.id === selectedFolderId) || null;');
  });

  it('mounts the canonical modal into document.body with a viewport-fixed backdrop', () => {
    expect(detailSource).toContain('createPortal(');
    expect(detailSource).toContain('</div>, document.body)');
    expect(detailSource).toContain('data-folder-detail-backdrop');
    expect(detailSource).toContain('}, [Boolean(folder), isOpen, isOwner]);');
    expect(detailCss).toMatch(/\.csp-folder-detail-backdrop\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
    expect(detailCss).toMatch(/\.csp-folder-detail-modal\s*\{[^}]*max-height:[^}]*100dvh/s);
  });

  it('cleans modal state when route ownership or supported Profile tabs change', () => {
    expect(creatorSource).toContain('setSelectedFolderId(null);\n  }, [activeSlug]);');
    expect(creatorSource).toContain("activeTab !== 'profile' && activeTab !== 'folders'");
    expect(creatorSource).toContain('onClose={closeFolderDetail}');
  });

  it('restores the originating Folder after Edit Work closes', () => {
    const modalStateSource = readFileSync(new URL('../hooks/useAssetModalState.ts', import.meta.url), 'utf8');
    expect(modalStateSource).toContain('editorReturnActionRef');
    expect(modalStateSource).toContain('onEditorClose?.();');
    expect(creatorSource).toContain('selectedAssetOriginFolderId');
    expect(creatorSource).toContain('onEditAsset(asset, originFolderId ? () => openFolderDetail(originFolderId) : undefined)');
  });

  it('persists the open Folder in the canonical Profile query for reload restoration', () => {
    expect(creatorSource).toContain("parseCanonicalProfileLocation(window.location.pathname, window.location.search)?.folderId || null");
    expect(creatorSource).toContain("url.searchParams.set('folder', folderId)");
    expect(creatorSource).toContain("url.searchParams.delete('folder')");
    expect(creatorSource).toContain('setSelectedFolderId(route.folderId);');
  });

  it('preserves the canonical one-Work-to-one-Folder field for list and unassign operations', () => {
    expect(detailSource).toContain('selectActiveAssetsInFolder(assets, folder.id)');
    expect(creatorSource).toContain('onMoveAssetToFolder(assetId, null)');
    expect(detailSource).not.toContain('deletedAt:');
  });

  it('passes the same derived folderId counts into the Move-to-Folder selector', () => {
    expect(appSource).toContain('const foldersWithCounts = folders.map(folder => ({');
    expect(appSource).toContain('assetsCount: folderAssetCounts[folder.id] || 0');
    const appMoveToFolderSource = appSource.match(/<MoveToFolderModal[\s\S]*?\/>/)?.[0] || '';
    expect(appMoveToFolderSource).toContain('folders={foldersWithCounts}');
  });

  it('keeps Move-to-Folder above Work Detail with nested-dialog focus handling', () => {
    expect(moveToFolderSource).toContain('createPortal(');
    expect(moveToFolderSource).toContain('data-move-to-folder-backdrop');
    expect(moveToFolderSource).toContain('data-move-to-folder-dialog');
    expect(moveToFolderSource).not.toContain('z-50');
    expect(moveToFolderSource).toContain('acquireViewportScrollLock(document)');
    expect(moveToFolderSource).toContain("window.addEventListener('keydown', handleKeyDown, true)");
    expect(moveToFolderSource).toContain('dialogRef.current?.focus({ preventScroll: true });');
    expect(moveToFolderSource).toContain('previouslyFocused?.isConnected');
    expect(detailCss).toMatch(/\.work-detail-backdrop\s*\{[^}]*z-index:\s*100;/s);
    expect(detailCss).toMatch(/\.move-to-folder-modal-backdrop\s*\{[^}]*z-index:\s*130;/s);
  });

  it('keeps Folder Detail identity, canonical Work Cards, and actions intact while polishing the shell', () => {
    expect(detailSource).toContain('className="cv-modal-panel csp-folder-detail-modal"');
    expect(detailSource).toContain('className="csp-folder-detail-header"');
    expect(detailSource).toContain('className="csp-folder-detail-identity"');
    expect(detailSource).toContain('className="csp-folder-detail-icon"');
    expect(detailSource).toContain('FOLDER DETAIL');
    expect(detailSource).toContain('<AssetCard asset={asset}');
    expect(detailSource).toContain('onMoveWork(asset)');
    expect(detailSource).toContain('onRemoveWork(assetId)');
    expect(detailSource).toContain('className="csp-folder-detail-work-actions"');
    expect(detailCss).toContain('.csp-folder-detail-header');
    expect(detailCss).toContain('.csp-folder-detail-body');
    expect(detailCss).toContain('.csp-folder-detail-work-actions button');
    expect(creatorSource).toContain('csp-folder-directory ${folderView ===');
    expect(creatorSource).toContain('className="csp-folder-card"');
    expect(creatorSource).toContain('onClick={() => openFolderDetail(folder.id)}');
  });
});
