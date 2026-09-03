import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(new URL('./ProfileEditModal.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');

describe('Profile Edit Social Link layout', () => {
  it('keeps the shared Social Link renderer and existing value/state contracts', () => {
    expect(modalSource).toContain('socialLinks.map((link, index) => (');
    expect(modalSource).toContain('className="cv-profile-social-row"');
    expect(modalSource).toContain('placeholder="ชื่อช่องทาง"');
    expect(modalSource).toContain('placeholder="https://..."');
    expect(modalSource).toContain('className="cv-profile-social-url-input w-full pl-8"');
    expect(modalSource).toContain('updateSocialLink(index, { label: event.target.value })');
    expect(modalSource).toContain('updateSocialLink(index, { url: event.target.value })');
    expect(modalSource).toContain('checked={link.visible}');
  });

  it('reserves a separate mobile row for the URL field and trailing visibility action', () => {
    expect(cssSource).toMatch(/\.cv-profile-social-url-field\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/s);
    expect(cssSource).toMatch(/\.cv-profile-social-url-input\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/s);
    expect(cssSource).toMatch(/\.cv-profile-social-row > label\.sr-only\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
    expect(cssSource).toMatch(/\.cv-profile-social-row > \.cv-profile-social-url-field\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*2/s);
    expect(cssSource).toMatch(/\.cv-profile-social-row \.cv-profile-social-visible\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*2/s);
    expect(cssSource).not.toMatch(/\.cv-profile-social-row > label\s*\{\s*grid-column:\s*1\s*\/\s*-1\s*;\s*\}/s);
  });

  it('reserves explicit clearance after the centered URL icon and keeps long values bounded', () => {
    expect(modalSource).toContain('<Link2 className="pointer-events-none absolute left-2.5 top-2.5');
    expect(cssSource).toMatch(/\.cv-profile-social-row input\s*\{[^}]*box-sizing:\s*border-box[^}]*min-width:\s*0[^}]*min-height:\s*2rem/s);
    expect(cssSource).toMatch(/\.cv-profile-social-url-field > svg\s*\{[^}]*top:\s*50%\s*!important[^}]*transform:\s*translateY\(-50%\)/s);
    expect(cssSource).toMatch(/\.cv-profile-social-url-input\s*\{[^}]*width:\s*100%[^}]*padding-left:\s*2\.75rem\s*!important/s);
  });

  it('keeps Profile identity and Edit Profile anatomy while applying scoped visual polish', () => {
    expect(profileSource).toContain('className="csp-profile-header"');
    expect(profileSource).toContain('className="csp-cover"');
    expect(profileSource).toContain('className="csp-avatar"');
    expect(profileSource).toContain('className="csp-name-row"');
    expect(profileSource).toContain('className="csp-username"');
    expect(profileSource).toContain('className="csp-bio"');
    expect(profileSource).toContain('className="csp-desktop-stats"');
    expect(profileSource).toContain('className="csp-social-links"');
    expect(profileSource).toContain('className="csp-profile-actions"');
    expect(profileSource).toContain('className="csp-tabs"');
    expect(profileSource).toContain('<ProfileEditModal');

    expect(modalSource).toContain('className="cv-modal-panel cv-profile-edit-modal');
    expect(modalSource).toContain('className="cv-profile-media-editor grid');
    expect(modalSource).toContain('className="cv-profile-media-heading"');
    expect(modalSource).toContain('ProfileAvatarPicker');
    expect(modalSource).toContain('className="cv-profile-cover-controls space-y-3');
    expect(modalSource).toContain('ProfileFields');
    expect(modalSource).toContain('className="cv-profile-details-fields grid');
    expect(modalSource).toContain('onClick={onClose} className="rounded-xl');
    expect(modalSource).toContain('บันทึกโปรไฟล์');

    expect(cssSource).toContain('.csp-profile-header > .csp-cover');
    expect(cssSource).toContain('.csp-profile-header > .csp-profile-surface');
    expect(cssSource).toContain('.csp-profile-header > .csp-tabs');
    expect(cssSource).toContain('.cv-profile-edit-modal > .cv-modal-heading');
    expect(cssSource).toContain('.cv-profile-edit-modal > form > .cv-profile-media-editor');
    expect(cssSource).toContain('.cv-profile-edit-modal .cv-profile-social-row');
    expect(cssSource).toContain('@media (max-width: 420px)');
  });
});
