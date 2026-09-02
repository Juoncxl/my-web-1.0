import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCompactMenuPosition, shouldUseCompactOwnerControls } from './CreatorCompactItemControls';
import { getFreePlacementWidthOptions, removeFreePlacement, updateFreeWidgetInstance } from '../../lib/creatorLayout';

const controlSource = readFileSync(new URL('./CreatorCompactItemControls.tsx', import.meta.url), 'utf8');
const customizeSource = readFileSync(new URL('./CreatorCustomizePanel.tsx', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('responsive narrow Owner controls', () => {
  it('uses compact controls at supported widths 1 and 2 while preserving the existing toolbar at 3+', () => {
    expect(shouldUseCompactOwnerControls('free', 1)).toBe(true);
    expect(shouldUseCompactOwnerControls('free', 2)).toBe(true);
    expect(shouldUseCompactOwnerControls('free', 3)).toBe(false);
    expect(shouldUseCompactOwnerControls('locked', 1)).toBe(false);
    expect(getFreePlacementWidthOptions('widget', 'decoration')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps the fixed portal menu inside the viewport above or below its exact anchor', () => {
    expect(getCompactMenuPosition(
      { top: 100, right: 200, bottom: 130 },
      { width: 160, height: 220 },
      { width: 800, height: 600 }
    )).toEqual({ left: 40, top: 136 });
    expect(getCompactMenuPosition(
      { top: 550, right: 790, bottom: 580 },
      { width: 220, height: 240 },
      { width: 800, height: 600 }
    )).toEqual({ left: 570, top: 304 });
  });

  it('exposes Edit, width, movement, and Remove through one document-body portal menu', () => {
    expect(controlSource).toContain('createPortal(');
    expect(controlSource).toContain('document.body');
    expect(controlSource).toContain('แก้ไข / ตั้งค่า');
    expect(controlSource).toContain('ความกว้าง');
    expect(controlSource).toContain('นำออกจากหน้าโปรไฟล์');
    expect(styles).toMatch(/\.csp-compact-owner-menu\s*\{[^}]*position:\s*fixed;/s);
  });

  it('routes the exact placement instanceId into both trigger and menu without a widgetType lookup', () => {
    expect(customizeSource).toContain('widgetInstanceId={instanceId}');
    expect(creatorSource).toContain('instanceId={placement?.refId}');
    expect(controlSource).toContain('data-widget-instance-id={widgetInstanceId}');
    expect(controlSource).not.toContain('find(instance');
  });

  it('edits and removes only the selected narrow instance while preserving its sibling', () => {
    const instances = [
      { id: 'decoration-a', widgetType: 'decoration', title: 'A', config: { text: 'A content' } },
      { id: 'decoration-b', widgetType: 'decoration', title: 'B', config: { text: 'B content' } }
    ];
    const edited = updateFreeWidgetInstance(instances, 'decoration-a', { text: 'A updated' }, 'A renamed');
    expect(edited.find(instance => instance.id === 'decoration-a')).toMatchObject({ title: 'A renamed', config: { text: 'A updated' } });
    expect(edited.find(instance => instance.id === 'decoration-b')).toEqual(instances[1]);

    const placements = [
      { id: 'widget:decoration-a', kind: 'widget' as const, refId: 'decoration-a', x: 0, y: 0, w: 1, h: 2 },
      { id: 'widget:decoration-b', kind: 'widget' as const, refId: 'decoration-b', x: 2, y: 0, w: 2, h: 2 }
    ];
    expect(removeFreePlacement(placements, 'widget:decoration-a')).toEqual([placements[1]]);
  });

  it('keeps compact Owner controls behind the existing Owner Customize rendering guard', () => {
    expect(creatorSource).toContain('{editing && <CreatorWidgetControls');
    expect(creatorSource).toContain('editing={isCustomizeOpen}');
    expect(customizeSource).toContain("if (shouldUseCompactOwnerControls(layout, span))");
  });
});
