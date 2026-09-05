import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(new URL('./SettingsModal.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('./settings/SettingsProfileSection.tsx', import.meta.url), 'utf8');
const securitySource = readFileSync(new URL('./settings/SettingsSecuritySection.tsx', import.meta.url), 'utf8');
const backupSource = readFileSync(new URL('./settings/SettingsBackupSection.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const oceanStyles = styles.slice(styles.indexOf('/* Phase 1.5N Item 12 — Settings Ocean reference fidelity pass.'));

describe('Settings Ocean reference fidelity contracts', () => {
  it('uses the reference composition while keeping Settings chrome locally scoped', () => {
    expect(modalSource).toContain('className="cv-settings-chrome"');
    expect(modalSource).toContain('data-settings-tab={activeTab}');
    expect(profileSource).toContain('className="cv-settings-avatar-panel"');
    expect(profileSource).toContain('className="cv-settings-action-bar"');
    expect(profileSource).not.toContain('>PROFILE<');
    expect(oceanStyles).toContain('--cvs-ink: #01162b;');
    expect(oceanStyles).toContain('width: min(43.125rem, 100%);');
    expect(oceanStyles).toContain('border-radius: 2rem;');
    expect(oceanStyles).toContain('.dark .cv-settings-modal');
  });

  it('keeps profile upload and submit behavior without restoring fake avatar controls', () => {
    expect(modalSource).toContain('onAvatarUpload={handleAvatarUpload}');
    expect(modalSource).toContain('onSubmit={handleProfileSubmit}');
    expect(profileSource).toContain('type="file"');
    expect(profileSource).toContain('type="submit"');
    expect(profileSource).toContain('onChange={onAvatarUpload}');
    expect(profileSource).not.toContain('PRESET_AVATARS');
    expect(profileSource).not.toContain('cv-settings-preset');
    expect(profileSource).not.toContain('online');
    expect(profileSource).not.toContain('verified');
  });

  it('shows informational field context without adding profile validation rules', () => {
    expect(profileSource).toContain('displayName.length');
    expect(profileSource).toContain('cv-settings-field-count');
    expect(profileSource).toContain('cv-settings-field-help');
    expect(profileSource).not.toContain('maxLength');
    expect(profileSource).toContain('value={email} disabled');
    expect(profileSource).toContain('cv-settings-input-status');
  });

  it('keeps Password and Backup callbacks connected to their existing actions', () => {
    expect(modalSource).toContain('onSubmit={handlePasswordSubmit}');
    expect(modalSource).toContain('onExport={() => void handleExportFullVault()}');
    expect(modalSource).toContain('onImportLegacy={() => void handleImportLegacyGuestData()}');
    expect(securitySource).toContain('onCurrentPasswordChange(e.target.value)');
    expect(securitySource).toContain('className="cv-settings-action-bar"');
    expect(backupSource).toContain('onClick={onExport}');
    expect(backupSource).toContain('onClick={onImportLegacy}');
  });

  it('keeps the Ocean action and responsive rules inside Settings selectors', () => {
    expect(oceanStyles).toContain('.cv-settings-action-bar');
    expect(oceanStyles).toContain('min-height: 3rem;');
    expect(oceanStyles).toContain('linear-gradient(90deg, #507d9f, #6a90b4, #8f6b98)');
    expect(oceanStyles).toContain('@media (max-width: 767px)');
    expect(oceanStyles).toContain('max-height: calc(100dvh - 1.2rem);');
    expect(oceanStyles).toContain('flex-direction: column;');
  });

  it('keeps the follow-up glass tuning restrained while preserving opaque controls', () => {
    expect(oceanStyles).toContain('--cvs-panel: rgba(255, 255, 255, .78);');
    expect(oceanStyles).toContain('--cvs-panel: rgba(6, 20, 40, .68);');
    expect(oceanStyles).toContain('backdrop-filter: blur(30px) saturate(112%);');
    expect(oceanStyles).toContain('background: rgba(1, 22, 43, .24);');
    expect(oceanStyles).toContain('--cvs-line-soft: rgba(210, 219, 235, .32);');
    expect(oceanStyles).toContain('background: color-mix(in srgb, var(--cvs-control) 82%, var(--cvs-tonal));');
    expect(oceanStyles).toContain('color: var(--cvs-accent);');
    expect(oceanStyles).toContain('.cv-settings-avatar-panel');
  });
});
