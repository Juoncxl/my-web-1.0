import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const creatorSource = readFileSync(new URL('../../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const customizeSource = readFileSync(new URL('./CreatorCustomizePanel.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./CreatorWidgetEditor.tsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('./CreatorCompactItemControls.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('Creator Widget UI visual contracts', () => {
  it('keeps one WidgetCard frame and the complete active renderer map', () => {
    expect(creatorSource).toContain('const WidgetCard: React.FC<WidgetCardProps>');
    expect(creatorSource).toContain('className={`csp-widget ${layout === \'free\' ? \'csp-layout-block\' : \'\'}`}');
    expect(creatorSource).toContain('<CreatorWidgetControls');
    expect(creatorSource).toContain('<div className="csp-widget-heading">');
    expect(creatorSource).toContain('<div className="csp-widget-body">');

    for (const widgetType of ['folder', 'playlist', 'todo', 'status', 'note', 'links', 'goal', 'gallery', 'clock', 'calendar', 'single_image', 'decoration']) {
      expect(creatorSource).toContain(`${widgetType}:`);
    }
  });

  it('keeps Customize Mode, layout choices, and Add Item categories intact', () => {
    expect(customizeSource).toContain('CUSTOMIZE MODE');
    expect(customizeSource).toContain('เสร็จสิ้น');
    expect(customizeSource).toContain('Locked A');
    expect(customizeSource).toContain('Locked B');
    expect(customizeSource).toContain('Locked C');
    expect(customizeSource).toContain('Free Layout');
    expect(creatorSource).toContain('aria-label="เพิ่มรายการใน Free Layout"');
    for (const category of ['Portfolio', 'Widget', 'Work', 'Folder']) {
      expect(creatorSource).toContain(`>${category}</button>`);
    }
    expect(creatorSource).toContain('canAddFreePlacement');
    expect(styles).toMatch(/\.csp-add-item-dialog\s*\{/);
    expect(styles).toMatch(/\.csp-layout-options button\.is-active\s*\{/);
  });

  it('styles the editing chrome and preserves the existing simple editor contracts', () => {
    expect(creatorSource).toContain('onMove={direction => placement ? moveFreeBlock(placement.id, direction) : moveWidget(type, direction)}');
    expect(creatorSource).toContain('onEdit={() => setEditingWidget');
    expect(creatorSource).toContain('onRemove={() => placement ? removeCompositionPlacement(placement.id) : removeWidget(type)}');
    expect(controlsSource).toContain('ความกว้าง');
    expect(controlsSource).toContain('นำออกจากหน้าโปรไฟล์');
    expect(editorSource).toContain('Display Name');
    expect(editorSource).toContain('onClick={onClose}');
    expect(editorSource).toContain('className={`csp-widget-editor ${contextual ? \'is-contextual\' : \'\'}`}');
    expect(styles).toMatch(/\.csp-widget-edit-bar\s*,\s*\.csp-portfolio-edit-bar\s*\{/);
    expect(styles).toMatch(/\.csp-widget-editor\s*\{/);
  });

  it('covers widget-specific content states while keeping canonical Work and Portfolio reuse', () => {
    for (const className of [
      'csp-folder-list',
      'csp-status-widget',
      'csp-note-widget',
      'csp-links-widget',
      'csp-playlist-widget',
      'csp-todo-list',
      'csp-goal-widget',
      'csp-gallery-widget',
      'csp-clock-widget',
      'csp-calendar-widget',
      'csp-single-image',
      'csp-decoration-widget',
      'csp-widget-empty'
    ]) {
      expect(creatorSource).toContain(className);
      expect(styles).toMatch(new RegExp(`\\.${className}\\s*(?:,|\\{)`));
    }
    expect(creatorSource).toContain('renderPortfolio');
    expect(creatorSource).toContain('<AssetCard asset={asset}');
    expect(creatorSource).toContain('className="csp-free-work-content"');
    const itemNineStyles = styles.slice(styles.indexOf('/* Phase 1.5N UI Item 9:'));
    expect(itemNineStyles).toContain('.csp-free-work-content');
    expect(itemNineStyles).not.toContain('.cv-asset-card');
  });

  it('keeps user-selected Free Layout placement and responsive safeguards presentation-only', () => {
    expect(creatorSource).toContain('gridColumn: `${placement.x + 1} / span ${placement.w}`');
    expect(creatorSource).toContain('gridRow: `${placement.y + 1} / span ${placement.h}`');
    expect(creatorSource).toContain('writeCreatorSpaceSettings');
    expect(creatorSource).toContain('style={placementStyle}');
    expect(styles).toMatch(/\.csp-widget\s*\{[^}]*container-type:\s*inline-size;/s);
    expect(styles).toMatch(/@container \(max-width: 16rem\)/);
    expect(styles).toMatch(/@media \(max-width: 767px\)/);
    expect(styles).toMatch(/@media \(max-width: 420px\)/);
    expect(styles).toMatch(/\.csp-gallery-tile img\s*\{[^}]*object-fit:\s*cover;/s);
    expect(styles).toMatch(/\.csp-decoration-widget\s*\{[^}]*overflow:\s*hidden;/s);
  });
});
