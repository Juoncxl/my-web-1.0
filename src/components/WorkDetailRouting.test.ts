import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIENCE_RATING_LABELS } from '../lib/constants';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const detailCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const constantsSource = readFileSync(new URL('../lib/constants.ts', import.meta.url), 'utf8');
const legacyEntrySource = readFileSync(new URL('./AssetViewModal.tsx', import.meta.url), 'utf8');
const confirmationSource = readFileSync(new URL('./ConfirmationDialog.tsx', import.meta.url), 'utf8');
const actionsSource = readFileSync(new URL('../hooks/useAssetActions.ts', import.meta.url), 'utf8');

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
    expect(creatorSource).toContain('onBookmark={onBookmark}');
    expect(creatorSource).toContain('isBookmarked={bookmarkedAssetIds.includes(asset.id)}');
  });

  it('keeps the legacy entry as a compatibility alias without a second presentation', () => {
    expect(legacyEntrySource).toContain("WorkDetailModal as AssetViewModal");
    expect(legacyEntrySource).not.toContain('return <');
    expect(detailSource).toContain('data-work-detail-presentation="canonical"');
    expect(detailSource).toContain('data-work-detail-source="recovered-final"');
    expect(detailSource).toContain('resolveWorkPresentationContent(asset)');
    expect(detailSource).toContain('data-work-detail-section="short-description"');
    expect(detailSource).toContain('data-work-detail-section="main-content"');
    expect(detailSource).toContain('data-work-detail-section="ui-code"');
    expect(detailSource).toContain('<CodePresentation code={uiCode}');
  });

  it('ports recovered presentation without mounting legacy asset-view sections', () => {
    expect(detailSource).toContain('className="work-detail-grid"');
    expect(detailSource).toContain('`work-detail-cover ${activeImageIndex >= 0');
    expect(detailSource).toContain('className="work-detail-footer"');
    expect(detailSource).not.toContain("from './asset-view/");
  });

  it('keeps production actions and privacy enforcement wired', () => {
    expect(detailSource).toContain("const canRender = Boolean(isOpen && asset && (interactionMode === 'preview' || canViewAssetDetail(asset, isOwner)))");
    expect(detailSource).toContain("canViewAssetDetail(candidate, isOwner && candidate.userId === asset.userId)");
    expect(detailSource).toContain('onEdit(asset)');
    expect(detailSource).toContain('onDelete(asset.id)');
    expect(detailSource).toContain('onBookmark(asset.id)');
    expect(detailSource).toContain('onReport(asset)');
    expect(detailSource).toContain("copyToClipboard(legacyContent, 'content')");
    expect(detailSource).toContain('copyToClipboard(uiCode');
    expect(creatorSource).toContain("onRestore={activeTab === 'trash' ? onRestoreAsset : undefined}");
    expect(creatorSource).toContain("onPermanentDelete={activeTab === 'trash' ? onPermanentDeleteAsset : undefined}");
  });

  it('keeps Edit Work on its originating surface after a successful update', () => {
    const editSaveSource = appSource.match(/if \(editingAssetId\) \{[\s\S]*?return \{ success: false, error: result\.error \|\| 'แก้ไขผลงานไม่สำเร็จ' \};/)?.[0] || '';
    expect(editSaveSource).toContain('if (result.data) {');
    expect(editSaveSource).not.toContain("navigate(getCanonicalProfilePath(currentUser, '?tab=works'))");
    expect(appSource).toContain('const handleCloseEditor = useCallback(() => {');
    expect(appSource).toContain("window.location.pathname.replace(/\\/edit\\/?$/i, '')");
    expect(appSource).toContain('onClose={handleCloseEditor}');
  });

  it('keeps long Work content bounded without changing sandbox semantics', () => {
    expect(detailCss).toMatch(/\.work-detail-modal\s*\{[^}]*max-width:\s*calc\(100vw - 2rem\)/s);
    expect(detailCss).toMatch(/\.work-detail-summary p\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s);
    expect(detailCss).toMatch(/\.work-detail-block > pre\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*auto/s);
    expect(detailCss).toMatch(/\.work-detail-code-panel > pre\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*auto/s);
    expect(detailSource).toContain('<CodePresentation code={uiCode}');
  });

  it('keeps copy actions on meaningful blocks instead of section labels', () => {
    const mainSection = detailSource.match(/data-work-detail-section="main-content"[\s\S]*?<\/section>/)?.[0] || '';
    const collaborationIdentity = detailSource.match(/data-work-detail-section="collaboration-identity"[\s\S]*?<\/section>/)?.[0] || '';
    const mainHeading = mainSection.slice(
      mainSection.indexOf('<div className="work-detail-section-heading">'),
      mainSection.indexOf('<div className="work-detail-blocks">')
    );

    expect(detailSource).toContain('const NON_DATA_LABELS = new Set');
    expect(detailSource).toContain('function isMeaningfulCopyText');
    expect(detailSource).toContain("copyToClipboard(legacyContent, 'content')");
    expect(mainHeading).not.toContain('<CopyButton');
    expect(collaborationIdentity).not.toContain('คัดลอกทั้งหมด');
    expect(detailSource).toContain('isMeaningfulCopyText(item.content, item.title)');
    expect(detailSource).toContain('isMeaningfulCopyText(participantCopy(participant), participant.creatorName)');
  });

  it('renders collaboration code with the same safe preview tabs as UI Code', () => {
    expect(detailSource).toContain('function CodePresentation');
    expect(detailSource).toContain('work-detail-collaboration-code-block');
    expect(detailSource).toContain("item.type === 'code' ? <CodePresentation code={item.content}");
    expect(detailSource).toContain('<SandboxedCodePreview code={code} minHeight="280px"');
    expect(detailSource).toContain("import { SandboxedCodePreview } from './SandboxedCodePreview'");
  });

  it('keeps profile Portfolio compact while preserving the full card elsewhere', () => {
    expect(cardSource).toContain("presentationMode?: 'full' | 'profile-compact'");
    expect(cardSource).toContain("presentationMode === 'profile-compact' ? 'is-profile-compact' : ''");
    expect(creatorSource).toContain('presentationMode="profile-compact"');
    expect(creatorSource).toContain('className="csp-asset-grid csp-portfolio-showcase-grid"');
    expect(detailCss).toMatch(/\.csp-portfolio-showcase-grid \.cv-asset-card\.is-profile-compact \.cv-card-title-row h3[\s\S]*?-webkit-line-clamp:\s*2/s);
    expect(detailCss).toMatch(/\.csp-portfolio-showcase-grid \.cv-asset-card\.is-profile-compact \.cv-card-snippet[\s\S]*?-webkit-line-clamp:\s*2/s);
  });

  it('stacks code preview and raw source at full modal width', () => {
    expect(detailCss).toMatch(/\.work-detail-code-layout\.is-split\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/s);
    expect(detailCss).toMatch(/\.work-detail-code-panel,\s*\.work-detail-code-panel > iframe,\s*\.work-detail-code-panel > pre\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/s);
    expect(detailCss).toMatch(/\.work-detail-code-panel > iframe\s*\{[\s\S]*?min-height:\s*17\.5rem/s);
  });

  it('keeps Prompt body readable and translates audience metadata at render time', () => {
    expect(AUDIENCE_RATING_LABELS).toEqual({ general: 'ทั่วไป', '13_plus': '13+', '16_plus': '16+', '18_plus': '18+' });
    expect(constantsSource).toContain('export const AUDIENCE_RATING_LABELS');
    expect(constantsSource).toContain("general: 'ทั่วไป'");
    expect(constantsSource).toContain("'13_plus': '13+'");
    expect(constantsSource).toContain("'16_plus': '16+'");
    expect(constantsSource).toContain("'18_plus': '18+'");
    expect(detailSource).toContain('const audienceRating = presentationMetadata?.audienceRating');
    expect(detailSource).toContain('AUDIENCE_RATING_LABELS[audienceRating] || audienceRating');
    expect(detailSource).toContain("...(audienceRatingLabel ? [{ label: 'ระดับผู้ชม', value: audienceRatingLabel }] : [])");
    expect(detailCss).toMatch(/\.work-detail-block\.is-prompt\s*>\s*pre\s*\{[\s\S]*?font-size:\s*1rem[\s\S]*?line-height:\s*1\.65/s);
    expect(detailCss).toMatch(/\.work-detail-block\s*>\s*header span\s*\{[\s\S]*?font-size:\s*\.66rem/s);
  });

  it('keeps compact and code-heavy Work Details in one restrained visual system', () => {
    expect(detailCss).toMatch(/\.work-detail-header,\s*\.work-detail-footer\s*\{[^}]*background:\s*var\(--cv-surface-soft\)/s);
    expect(detailCss).toMatch(/\.work-detail-creator\s*\{[^}]*border-left:\s*3px solid var\(--cv-iridescent-border\)[^}]*background:\s*var\(--cv-surface-soft\)/s);
    expect(detailCss).toMatch(/\.work-detail-block\s*\{[^}]*border:\s*0[^}]*border-top:\s*1px solid var\(--cv-line\)/s);
    expect(detailCss).toMatch(/\.work-detail-code\s*\{[^}]*border:\s*1px solid var\(--cv-line\)[^}]*border-radius:\s*\.9rem[^}]*background:\s*var\(--cv-surface-soft\)/s);
    expect(detailCss).toMatch(/\.work-detail-code-tabs button\.is-active\s*\{[^}]*background:\s*var\(--cv-lilac\)[^}]*color:\s*var\(--cv-purple-dark\)/s);
    expect(detailCss).toMatch(/\.work-detail-code-panel > iframe\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
    expect(detailCss).toMatch(/\.work-detail-footer-actions \.is-primary\s*\{[^}]*background:\s*var\(--cv-purple-dark\)/s);
    expect(detailCss).toMatch(/\.work-detail-body\s*\{[^}]*overflow-y:\s*auto/s);
    expect(detailCss).toMatch(/\.work-detail-code-panel > pre\s*\{[^}]*overflow:\s*auto/s);
    expect(detailCss).toMatch(/\.work-detail-footer-actions button\s*\{[^}]*min-height:\s*1\.95rem/s);
    expect(detailCss).toMatch(/\.work-detail-footer-actions button\s*\{[^}]*min-width:\s*max-content/s);
    expect(detailSource).toContain('data-work-detail-section="main-content"');
    expect(detailSource).toContain('data-work-detail-section="ui-code"');
    expect(detailSource).toContain('{uiCode && <section className="work-detail-section work-detail-code"');
    expect(detailSource).toContain('downloadText(markdown, `${safeFilename}.md`');
    expect(detailSource).toContain('downloadText(JSON.stringify(createPublicAssetExport(asset), null, 2)');
    expect(detailSource).toContain('onMoveToFolder(asset)');
    expect(detailSource).toContain('onClick={onClose}');
  });

  it('keeps Image/GIF Work Icons inside square crop frames', () => {
    expect(cardSource).toContain('className="cv-card-icon"');
    expect(detailSource).toContain("className={`work-detail-mark ${asset.icon.type === 'image' ? 'is-media' : ''}`}");
    expect(detailCss).toMatch(/\.cv-card-icon\s*\{[^}]*overflow:\s*hidden[^}]*\}/s);
    expect(detailCss).toMatch(/\.cv-card-icon img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover[^}]*\}/s);
    expect(detailCss).toMatch(/\.work-detail-mark\.is-media\s*\{[^}]*width:\s*3rem[^}]*max-width:\s*3rem[^}]*\}/s);
    expect(detailCss).toMatch(/\.work-detail-mark img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover[^}]*\}/s);
  });

  it('routes Work trash confirmation through the in-app dialog and preserves the existing handler', () => {
    const vaultTrashHandler = appSource.match(/const handleDeleteVaultAsset[\s\S]*?\/\/ Folder CRUD/)?.[0] || '';
    const detailTrashButton = detailSource.match(/\{isOwner && onDelete && <button[\s\S]*?<\/button>\}/)?.[0] || '';
    const cancelButton = confirmationSource.match(/<button ref=\{cancelButtonRef\}[\s\S]*?data-confirmation-cancel>/)?.[0] || '';
    const confirmButton = confirmationSource.match(/<button type="button" onClick=\{handleConfirm\}[\s\S]*?data-confirmation-confirm>/)?.[0] || '';

    expect(vaultTrashHandler).toContain('setTrashConfirmationAsset(asset)');
    expect(vaultTrashHandler).not.toContain('window.confirm');
    expect(appSource).toContain('void handleSoftDeleteAsset(assetId)');
    expect(detailTrashButton).toContain('setIsTrashConfirmationOpen(true)');
    expect(detailTrashButton).not.toContain('window.confirm');
    expect(detailSource).toContain('onDelete(asset.id)');
    expect(confirmationSource).toContain('data-confirmation-dialog');
    expect(confirmationSource).toContain('data-confirmation-cancel');
    expect(confirmationSource).toContain('data-confirmation-confirm');
    expect(cancelButton).toContain('onClick={onCancel}');
    expect(cancelButton).not.toContain('onConfirm');
    expect(confirmButton).toContain('onClick={handleConfirm}');
    expect(confirmationSource).toContain('if (confirmClickRef.current) return;');
    expect(confirmationSource).toContain('closeRef.current();');
    expect(confirmationSource).toContain('onConfirm();');
  });

  it('routes Permanent Delete through the same confirmation dialog without changing deletion semantics', () => {
    const cardPermanentDeleteButton = cardSource.match(/\{isTrashMode && onPermanentDelete && <button[\s\S]*?<\/button>\}/)?.[0] || '';
    const detailPermanentDeleteButton = detailSource.match(/\{onPermanentDelete && <button[\s\S]*?<\/button>\}/)?.[0] || '';

    expect(cardPermanentDeleteButton).toContain('setIsPermanentDeleteConfirmationOpen(true)');
    expect(cardPermanentDeleteButton).not.toContain('window.confirm');
    expect(detailPermanentDeleteButton).toContain('setIsPermanentDeleteConfirmationOpen(true)');
    expect(detailPermanentDeleteButton).not.toContain('window.confirm');
    expect(actionsSource).toContain('const handlePermanentDeleteAsset = useCallback');
    expect(actionsSource).toContain('permanentDeleteAsset(assetId)');
    expect(actionsSource).toContain('onAssetDeleted(assetId)');
    expect(cardSource).toContain('onPermanentDelete(asset.id);');
    expect(detailSource).toContain('onPermanentDelete(asset.id);');
    expect(cardSource).toContain('confirmLabel="ลบถาวร"');
    expect(detailSource).toContain('confirmLabel="ลบถาวร"');
    expect(confirmationSource).toContain('if (confirmClickRef.current) return;');
  });
});
