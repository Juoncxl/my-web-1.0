import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('./Header.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');

describe('responsive layout safety contracts', () => {
  it('keeps the global header controls reachable at very narrow widths', () => {
    expect(headerSource).toContain('className="cv-shell-header sticky');
    expect(headerSource).toContain('className="cv-shell-input w-full');
    expect(styles).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.cv-shell-header > div > \.flex \{[\s\S]*?flex-wrap: wrap;/);
    expect(styles).toMatch(/\.cv-shell-header > div > \.flex > \.flex-1 \{[\s\S]*?width: 100%;[\s\S]*?flex: 1 1 100%;/);
  });

  it('wraps active Creator profile controls without changing content order', () => {
    expect(creatorSource).toContain('className="csp-section-heading"');
    expect(creatorSource).toContain('className="csp-viewer-toolbar"');
    expect(styles).toContain('.csp-section-heading {\n    align-items: flex-start;\n    flex-direction: column;');
    expect(styles).toContain('.csp-viewer-toolbar small {\n    flex: 1 1 100%;');
    expect(styles).toContain('.csp-profile-header .csp-social-links a {\n    max-width: 100%;');
  });

  it('keeps responsive modal actions and form content inside their containers', () => {
    expect(styles).toMatch(/\.work-detail-footer-actions \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(styles).toContain('.work-detail-footer-actions button {\n    width: 100%;\n    min-width: 0;');
    expect(styles).toContain('.cv-profile-edit-modal .cv-profile-social-visible {\n    min-width: 0;');
    expect(styles).toContain('.csp-folder-sort-label {\n    flex: 1 1 100%;');
  });

  it('does not add responsive rules that mutate Free Layout placement or spans', () => {
    expect(styles).toContain('user-controlled Free Layout placement');
    expect(styles).not.toContain('.csp-free-canvas > * {\n    grid-column:');
    expect(styles).not.toContain('.csp-free-placement {\n    grid-column:');
  });
});
