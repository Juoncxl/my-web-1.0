import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const itemTenStyles = styles.slice(styles.indexOf('/* Phase 1.5N UI Item 10:'));
const settingsSource = readFileSync(new URL('./SettingsModal.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('./ProfileEditModal.tsx', import.meta.url), 'utf8');
const folderManagerSource = readFileSync(new URL('./FolderManagerModal.tsx', import.meta.url), 'utf8');
const folderDetailSource = readFileSync(new URL('./FolderDetailModal.tsx', import.meta.url), 'utf8');
const workDetailSource = readFileSync(new URL('./WorkDetailModal.tsx', import.meta.url), 'utf8');
const confirmationSource = readFileSync(new URL('./ConfirmationDialog.tsx', import.meta.url), 'utf8');
const moveSource = readFileSync(new URL('./MoveToFolderModal.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./creator/CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');

describe('active modal typography and spacing contracts', () => {
  it('covers the active dialog families with shared CXL surface and backdrop selectors', () => {
    for (const className of [
      'cv-modal-backdrop',
      'cv-settings-backdrop',
      'csp-modal-backdrop',
      'work-detail-backdrop',
      'csp-folder-detail-backdrop',
      'csp-nested-modal',
      'cv-modal-panel',
      'cv-settings-modal',
      'work-detail-modal',
      'csp-folder-detail-modal',
      'csp-nested-modal-card'
    ]) {
      expect(itemTenStyles).toContain(`.${className}`);
    }
    expect(settingsSource).toContain('className="cv-settings-modal"');
    expect(profileSource).toContain('className="cv-modal-panel cv-profile-edit-modal');
    expect(folderManagerSource).toContain('className="cv-modal-panel cv-folder-manager-modal');
    expect(folderDetailSource).toContain('className="cv-modal-panel csp-folder-detail-modal"');
    expect(workDetailSource).toContain('className="work-detail-modal"');
    expect(confirmationSource).toContain('data-confirmation-dialog');
    expect(moveSource).toContain('data-move-to-folder-dialog');
    expect(workspaceSource).toContain('className="csp-work-modal"');
  });

  it('normalizes header, close, footer, and focus language without making modal geometry identical', () => {
    expect(itemTenStyles).toMatch(/\.cv-modal-heading,[\s\S]*\.csp-folder-detail-header\s*\{/);
    expect(itemTenStyles).toMatch(/\.cv-modal-close,[\s\S]*\.work-detail-header-actions button\s*\{/);
    expect(itemTenStyles).toMatch(/\.cv-modal-footer,[\s\S]*\.work-detail-footer\s*\{/);
    expect(itemTenStyles).toContain('outline: 3px solid color-mix(in srgb, var(--cv-ocean) 28%, transparent);');
    expect(itemTenStyles).toContain('border-radius: 1.1rem;');
    expect(itemTenStyles).not.toContain('width: min(51.25rem');
    expect(itemTenStyles).not.toContain('height: min(56rem');
  });

  it('aligns active form controls and helper text while preserving their existing fields', () => {
    expect(itemTenStyles).toContain('.cv-settings-input');
    expect(itemTenStyles).toContain('.cv-profile-edit-modal input:not([type=\'checkbox\']):not([type=\'file\'])');
    expect(itemTenStyles).toContain('.cv-folder-manager-modal .cv-folder-form-field input');
    expect(itemTenStyles).toContain('.csp-work-modal .csp-field input');
    expect(itemTenStyles).toContain('.csp-widget-editor input:not([type=\'checkbox\']):not([type=\'range\'])');
    expect(itemTenStyles).toContain('min-height: 2.3rem;');
    expect(itemTenStyles).toContain('box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-purple) 14%, transparent);');
    expect(settingsSource).toContain('onDisplayNameChange={setDisplayName}');
    expect(profileSource).toContain('updateSocialLink');
    expect(folderManagerSource).toContain('<FolderForm');
    expect(workspaceSource).toContain('<label className="csp-field">ชื่อผลงาน');
  });

  it('keeps semantic primary, secondary, and destructive action hooks intact', () => {
    expect(confirmationSource).toContain('data-confirmation-cancel');
    expect(confirmationSource).toContain('data-confirmation-confirm');
    expect(confirmationSource).toContain('onClick={handleConfirm}');
    expect(moveSource).toContain('onClick={handleSave}');
    expect(profileSource).toContain('type="submit" disabled={isSaving}');
    expect(workDetailSource).toContain('onClick={onClose}');
    expect(itemTenStyles).toContain('.cv-confirm-dialog-backdrop [data-confirmation-confirm]');
    expect(itemTenStyles).toContain('.cv-modal-footer > button:first-child');
    expect(itemTenStyles).toContain('.cv-settings-primary-button');
  });

  it('keeps compact mobile rhythm scoped to active dialog surfaces', () => {
    expect(itemTenStyles).toContain('@media (max-width: 767px)');
    expect(itemTenStyles).toContain('@media (max-width: 420px)');
    expect(itemTenStyles).toContain('.cv-folder-manager-content');
    expect(itemTenStyles).toContain('.csp-nested-modal-body');
    expect(itemTenStyles).toContain('flex: 1 1 9rem;');
  });
});
