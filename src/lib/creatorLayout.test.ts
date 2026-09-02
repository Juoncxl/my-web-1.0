import { describe, expect, it } from 'vitest';
import {
  anchorFreeGridCell,
  canAddFreePlacement,
  compactFreeLayout,
  constrainFreePlacementWidth,
  createFreeWidgetInstance,
  estimatePortfolioHeightRows,
  estimateWorkHeightRows,
  getFreePlacementId,
  getFreePlacementWidthOptions,
  getFreePlacementWidthRange,
  getPortfolioGridColumns,
  getPortfolioShowcaseItems,
  getWorkCardSize,
  hydrateFreeWidgetInstances,
  hydrateSavedFreeLayout,
  materializeDerivedHeights,
  materializePortfolioAutoHeight,
  mergeResolvedFreeLayout,
  migrateFreeOrder,
  moveFreePlacement,
  normalizeFreeLayout,
  normalizeFreePlacement,
  placementsOverlap,
  pixelsToFreeGridRows,
  pointerToFreeGridCell,
  removeFreePlacement,
  resolveFreePlacementPosition,
  resizeFreePlacement,
  shouldShowFreePlacementControls,
  updateFreeWidgetInstance
} from './creatorLayout';

describe('Free Layout coordinate model', () => {
  it('normalizes stable id and coordinate bounds', () => {
    expect(normalizeFreePlacement({ id: 'work:1', kind: 'work', refId: '1', x: -4, y: -2, w: 99, h: 0 })).toEqual({ id: 'work:1', kind: 'work', refId: '1', x: 0, y: 0, w: 12, h: 1, heightMode: 'auto' });
    expect(getFreePlacementId('folder', 'folder-1')).toBe('folder:folder-1');
  });

  it('keeps valid manually saved x/y/w authoritative during hydration', () => {
    const layout = normalizeFreeLayout([
      { id: 'widget:a', kind: 'widget', refId: 'a', x: 1, y: 7, w: 5, h: 2 },
      { id: 'widget:b', kind: 'widget', refId: 'b', x: 7, y: 120, w: 3, h: 2 }
    ]);
    expect(layout.find(item => item.id === 'widget:a')).toMatchObject({ x: 1, y: 7, w: 5 });
    expect(layout.find(item => item.id === 'widget:b')).toMatchObject({ x: 7, y: 120, w: 3 });
    expect(layout.some((a, index) => layout.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
    expect(normalizeFreeLayout(layout)).toEqual(layout);
  });

  it('packs adjacent items without unnecessary row gaps and supports jigsaw heights', () => {
    const layout = compactFreeLayout([
      { id: 'tall', kind: 'widget', refId: 'tall', x: 0, y: 0, w: 8, h: 3 },
      { id: 'small-a', kind: 'widget', refId: 'small-a', x: 8, y: 0, w: 4, h: 1 },
      { id: 'small-b', kind: 'widget', refId: 'small-b', x: 8, y: 1, w: 4, h: 1 }
    ]);
    expect(layout).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tall', x: 0, y: 0, w: 8, h: 3 }),
      expect.objectContaining({ id: 'small-a', x: 8, y: 0 }),
      expect.objectContaining({ id: 'small-b', x: 8, y: 1 })
    ]));
    expect(layout.some((a, index) => layout.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
  });

  it('resolves a blocked move deterministically near the requested cell', () => {
    const initial = normalizeFreeLayout([
      { id: 'a', kind: 'widget', refId: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', kind: 'widget', refId: 'b', x: 6, y: 0, w: 6, h: 2 }
    ]);
    const moved = moveFreePlacement(initial, 'b', 5, 0);
    expect(moved.find(item => item.id === 'b')).toMatchObject({ x: 6, y: 0 });
    expect(moved.some((a, index) => moved.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
  });

  it('resizes with collision resolution and preserves unrelated identities', () => {
    const initial = normalizeFreeLayout([
      { id: 'widget:a', kind: 'widget', refId: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'work:1', kind: 'work', refId: '1', x: 4, y: 0, w: 4, h: 2 }
    ]);
    const resized = resizeFreePlacement(initial, 'widget:a', 8, 2);
    expect(resized.find(item => item.id === 'work:1')?.id).toBe('work:1');
    expect(resized.some((a, index) => resized.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
  });

  it('migrates legacy freeOrder to stable placements', () => {
    const migrated = migrateFreeOrder(['folder', 'portfolio', 'status'], { folder: 3, portfolio: 9, status: 4 });
    expect(migrated.map(item => item.id)).toEqual(['widget:folder', 'portfolio:portfolio', 'widget:status']);
    expect(migrated.every(item => item.x >= 0 && item.x + item.w <= 12 && item.y >= 0)).toBe(true);
    expect(migrated.find(item => item.kind === 'portfolio')?.heightMode).toBe('auto');
  });

  it('derives responsive Portfolio wrapping and height from width and showcase count', () => {
    expect(getPortfolioGridColumns(12)).toBe(3);
    expect(getPortfolioGridColumns(8)).toBe(2);
    expect(getPortfolioGridColumns(4)).toBe(1);
    expect(estimatePortfolioHeightRows(9, 6)).toBeLessThan(estimatePortfolioHeightRows(4, 6));
    expect(estimatePortfolioHeightRows(9, 12)).toBeGreaterThan(estimatePortfolioHeightRows(9, 3));
  });

  it('limits only the Portfolio showcase and supports All after public filtering', () => {
    const works = [
      { id: 'public-1', visibility: 'public' },
      { id: 'private-1', visibility: 'private' },
      { id: 'public-2', visibility: 'public' },
      { id: 'public-3', visibility: 'public' },
      { id: 'public-4', visibility: 'public' }
    ];
    expect(getPortfolioShowcaseItems(works, 3).map(item => item.id)).toEqual(['public-1', 'private-1', 'public-2']);
    const visitorWorks = works.filter(item => item.visibility === 'public');
    expect(getPortfolioShowcaseItems(visitorWorks, 'all').map(item => item.id)).toEqual(['public-1', 'public-2', 'public-3', 'public-4']);
    expect(estimatePortfolioHeightRows(9, visitorWorks.length)).toBeLessThan(estimatePortfolioHeightRows(9, works.length + 4));
  });

  it('materializes auto-height Portfolio geometry without blocking usable side columns', () => {
    const layout = materializePortfolioAutoHeight([
      { id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 8, h: 3 },
      { id: 'widget:side', kind: 'widget', refId: 'side', x: 8, y: 0, w: 4, h: 2 },
      { id: 'widget:below', kind: 'widget', refId: 'below', x: 0, y: 3, w: 8, h: 2 }
    ], 10);
    expect(layout.find(item => item.id === 'portfolio:portfolio')).toMatchObject({ x: 0, y: 0, w: 8, h: 10, heightMode: 'auto' });
    expect(layout.find(item => item.id === 'widget:side')).toMatchObject({ x: 8, y: 0 });
    expect(layout.find(item => item.id === 'widget:below')?.y).toBeGreaterThanOrEqual(10);
    expect(layout.some((a, index) => layout.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
  });

  it('repairs a stale fixed Portfolio height as auto-height geometry', () => {
    const portfolio = normalizeFreePlacement({ id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 9, h: 2 });
    expect(portfolio).toMatchObject({ h: 2, heightMode: 'auto' });
    expect(materializePortfolioAutoHeight([portfolio!], 14)[0]).toMatchObject({ h: 14, heightMode: 'auto' });
  });

  it('keeps an Individual Work distinct from Portfolio while deriving both heights', () => {
    const layout = materializeDerivedHeights([
      { id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 8, h: 2 },
      { id: 'work:work-1', kind: 'work', refId: 'work-1', x: 8, y: 0, w: 4, h: 4 }
    ], { 'portfolio:portfolio': 12, 'work:work-1': 7 });

    expect(layout.find(item => item.id === 'portfolio:portfolio')).toMatchObject({ kind: 'portfolio', h: 12, heightMode: 'auto' });
    expect(layout.find(item => item.id === 'work:work-1')).toMatchObject({ kind: 'work', x: 8, y: 0, w: 4, h: 7, heightMode: 'auto' });
  });

  it('accepts x=0 and treats equivalent left/right free regions symmetrically', () => {
    const occupied = normalizeFreeLayout([{ id: 'center', kind: 'widget', refId: 'center', x: 4, y: 0, w: 4, h: 2 }]);
    expect(resolveFreePlacementPosition(occupied, { x: 0, y: 0, w: 4, h: 2 })).toEqual({ x: 0, y: 0 });
    expect(resolveFreePlacementPosition(occupied, { x: 8, y: 0, w: 4, h: 2 })).toEqual({ x: 8, y: 0 });
    expect(moveFreePlacement([...occupied, { id: 'left', kind: 'widget', refId: 'left', x: 8, y: 2, w: 4, h: 2 }], 'left', 0, 0).find(item => item.id === 'left')).toMatchObject({ x: 0, y: 0 });
  });

  it('converts viewport pointers relative to the composition and preserves the drag grab offset', () => {
    const base = { containerLeft: 180, containerTop: 500, containerWidth: 1200, rowHeight: 72, columnGap: 12, rowGap: 12 };
    const cell = pointerToFreeGridCell({ ...base, clientX: 190, clientY: 510 });
    expect(cell).toEqual({ x: 0, y: 0 });
    expect(anchorFreeGridCell({ x: 2, y: 1 }, { x: 2, y: 1 }, 4, 3)).toEqual({ x: 0, y: 0 });
    const afterPageScroll = pointerToFreeGridCell({ ...base, containerTop: 200, clientX: 190, clientY: 210 });
    expect(afterPageScroll).toEqual(cell);
  });

  it('replaces stale auto-height occupancy rather than retaining the previous rectangle', () => {
    const inputs = [
      { id: 'portfolio:portfolio', kind: 'portfolio' as const, refId: 'portfolio', x: 0, y: 0, w: 8, h: 14 },
      { id: 'widget:side', kind: 'widget' as const, refId: 'side', x: 8, y: 0, w: 4, h: 2 }
    ];
    const shrunk = materializeDerivedHeights(inputs, { 'portfolio:portfolio': 4 });
    expect(shrunk.find(item => item.id === 'portfolio:portfolio')?.h).toBe(4);
    expect(resolveFreePlacementPosition(shrunk, { x: 0, y: 4, w: 8, h: 2 })).toEqual({ x: 0, y: 4 });
    expect(materializeDerivedHeights(inputs, { 'portfolio:portfolio': 4 })).toEqual(shrunk);
  });

  it('excludes invisible records from occupancy while preserving them in persistence merge', () => {
    const stored = normalizeFreeLayout([
      { id: 'visible', kind: 'widget', refId: 'visible', x: 4, y: 0, w: 4, h: 2 },
      { id: 'hidden', kind: 'widget', refId: 'hidden', x: 0, y: 0, w: 4, h: 2 }
    ]);
    const visible = materializeDerivedHeights(stored.filter(item => item.id === 'visible'), {});
    expect(resolveFreePlacementPosition(visible, { x: 0, y: 0, w: 4, h: 2 })).toEqual({ x: 0, y: 0 });
    expect(mergeResolvedFreeLayout(stored, visible).map(item => item.id)).toEqual(['visible', 'hidden']);
  });

  it('derives responsive Individual Work presentation and content height from width', () => {
    expect(getWorkCardSize(3)).toBe('narrow');
    expect(getWorkCardSize(6)).toBe('medium');
    expect(getWorkCardSize(12)).toBe('wide');
    expect(estimateWorkHeightRows(3)).toBeGreaterThan(estimateWorkHeightRows(12));
    expect(pixelsToFreeGridRows(504, 72, 12)).toBe(7);
    const layout = materializeDerivedHeights([
      { id: 'work:1', kind: 'work', refId: '1', x: 0, y: 0, w: 4, h: 2 },
      { id: 'widget:below', kind: 'widget', refId: 'below', x: 0, y: 2, w: 4, h: 2 }
    ], { 'work:1': 7 });
    expect(layout.find(item => item.id === 'work:1')).toMatchObject({ h: 7, heightMode: 'auto' });
    expect(layout.find(item => item.id === 'widget:below')).not.toMatchObject({ x: 0, y: 2 });
    expect(layout.some((a, index) => layout.slice(index + 1).some(b => placementsOverlap(a, b)))).toBe(false);
  });

  it('repairs only an invalid colliding record and leaves unrelated saved placements exact', () => {
    const hydrated = normalizeFreeLayout([
      { id: 'widget:first', kind: 'widget', refId: 'first', x: 0, y: 0, w: 4, h: 2 },
      { id: 'widget:colliding', kind: 'widget', refId: 'colliding', x: 0, y: 0, w: 4, h: 2 },
      { id: 'widget:unrelated', kind: 'widget', refId: 'unrelated', x: 9, y: 11, w: 3, h: 2 }
    ]);

    expect(hydrated.find(item => item.id === 'widget:first')).toMatchObject({ x: 0, y: 0, w: 4 });
    expect(hydrated.find(item => item.id === 'widget:colliding')).not.toMatchObject({ x: 0, y: 0 });
    expect(hydrated.find(item => item.id === 'widget:unrelated')).toMatchObject({ x: 9, y: 11, w: 3 });
  });

  it('remeasures auto-height without changing unrelated logical x/y/w', () => {
    const saved = [
      { id: 'portfolio:portfolio', kind: 'portfolio' as const, refId: 'portfolio', x: 0, y: 0, w: 4, h: 3 },
      { id: 'widget:side', kind: 'widget' as const, refId: 'side', x: 4, y: 0, w: 5, h: 2 },
      { id: 'widget:below', kind: 'widget' as const, refId: 'below', x: 0, y: 9, w: 3, h: 2 }
    ];
    const first = materializeDerivedHeights(saved, { 'portfolio:portfolio': 6 });
    const second = materializeDerivedHeights(saved, { 'portfolio:portfolio': 8 });

    for (const layout of [first, second]) {
      expect(layout.find(item => item.id === 'widget:side')).toMatchObject({ x: 4, y: 0, w: 5 });
      expect(layout.find(item => item.id === 'widget:below')).toMatchObject({ x: 0, y: 9, w: 3 });
    }
  });

  it('does not let a stale persisted auto-height move an otherwise exact saved placement during hydration', () => {
    const hydrated = normalizeFreeLayout([
      { id: 'work:one', kind: 'work', refId: 'one', x: 0, y: 3, w: 4, h: 7, heightMode: 'auto' },
      { id: 'widget:decoration-a', kind: 'widget', refId: 'decoration-a', x: 0, y: 9, w: 1, h: 2 }
    ]);

    expect(hydrated.find(item => item.id === 'widget:decoration-a')).toMatchObject({ x: 0, y: 9, w: 1 });
    const measured = materializeDerivedHeights(hydrated, { 'work:one': 6 });
    expect(measured.find(item => item.id === 'widget:decoration-a')).toMatchObject({ x: 0, y: 9, w: 1 });
  });

  it('offers granular one-column widths while enforcing per-kind minimums', () => {
    expect(getFreePlacementWidthRange('widget', 'decoration')).toEqual({ minW: 1, maxW: 12 });
    expect(getFreePlacementWidthOptions('widget', 'decoration')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(getFreePlacementWidthOptions('work')).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(getFreePlacementWidthOptions('portfolio')).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(constrainFreePlacementWidth(1, 'work')).toBe(3);
    expect(constrainFreePlacementWidth(2, 'portfolio')).toBe(4);
    expect(constrainFreePlacementWidth(12, 'widget', 'note')).toBe(12);
  });

  it('supports independent stable instances of the same Widget type', () => {
    const first = createFreeWidgetInstance('decoration', [], 'decoration-instance-001', { text: 'A', opacity: 60 });
    const second = createFreeWidgetInstance('decoration', [first], 'decoration-instance-002', { text: 'B', opacity: 100 });
    const third = createFreeWidgetInstance('decoration', [first, second], 'decoration-instance-002', { text: 'C' });
    const instances = [first, second, third];

    expect(instances.map(instance => instance.id)).toEqual(['decoration-instance-001', 'decoration-instance-002', 'decoration-instance-002-2']);
    const edited = updateFreeWidgetInstance(instances, second.id, { text: 'B edited', opacity: 80 });
    expect(edited.find(instance => instance.id === first.id)?.config).toEqual({ text: 'A', opacity: 60 });
    expect(edited.find(instance => instance.id === second.id)?.config).toEqual({ text: 'B edited', opacity: 80 });
    expect(edited.find(instance => instance.id === third.id)?.config).toEqual({ text: 'C' });

    const renamed = updateFreeWidgetInstance(edited, second.id, { text: 'B edited', opacity: 80 }, 'Sparkle B');
    expect(renamed.find(instance => instance.id === second.id)?.title).toBe('Sparkle B');
    expect(renamed.find(instance => instance.id === second.id)?.config).toEqual({ text: 'B edited', opacity: 80 });
    expect(renamed.find(instance => instance.id === first.id)?.title).toBeUndefined();
  });

  it('hydrates multiple same-type Widget instances without merging their identities or coordinates', () => {
    const placements = normalizeFreeLayout([
      { id: 'widget:decoration-a', kind: 'widget', refId: 'decoration-a', x: 0, y: 0, w: 1, h: 2 },
      { id: 'widget:decoration-b', kind: 'widget', refId: 'decoration-b', x: 5, y: 4, w: 2, h: 2 },
      { id: 'widget:decoration-c', kind: 'widget', refId: 'decoration-c', x: 10, y: 8, w: 1, h: 2 }
    ]);
    const instances = hydrateFreeWidgetInstances(placements, [
      { id: 'decoration-a', widgetType: 'decoration', config: { text: 'A' } },
      { id: 'decoration-b', widgetType: 'decoration', config: { text: 'B' } },
      { id: 'decoration-c', widgetType: 'decoration', config: { text: 'C' } }
    ]);

    expect(instances).toHaveLength(3);
    expect(new Set(instances.map(instance => instance.id)).size).toBe(3);
    expect(placements.map(({ refId, x, y, w }) => ({ refId, x, y, w }))).toEqual([
      { refId: 'decoration-a', x: 0, y: 0, w: 1 },
      { refId: 'decoration-b', x: 5, y: 4, w: 2 },
      { refId: 'decoration-c', x: 10, y: 8, w: 1 }
    ]);
  });

  it('removes one placement without removing sibling Widget instances', () => {
    const placements = normalizeFreeLayout([
      { id: 'widget:decoration-a', kind: 'widget', refId: 'decoration-a', x: 0, y: 0, w: 1, h: 2 },
      { id: 'widget:decoration-b', kind: 'widget', refId: 'decoration-b', x: 2, y: 0, w: 1, h: 2 },
      { id: 'widget:decoration-c', kind: 'widget', refId: 'decoration-c', x: 4, y: 0, w: 1, h: 2 }
    ]);
    const remaining = removeFreePlacement(placements, 'widget:decoration-b');

    expect(remaining.map(item => item.refId)).toEqual(['decoration-a', 'decoration-c']);
    expect(canAddFreePlacement(remaining, 'widget', 'decoration')).toBe(true);
  });

  it('keeps duplicate policy instance-based for Widgets and reference-based for content blocks', () => {
    const placements = normalizeFreeLayout([
      { id: 'work:work-1', kind: 'work', refId: 'work-1', x: 0, y: 0, w: 3, h: 5 },
      { id: 'folder:folder-1', kind: 'folder', refId: 'folder-1', x: 3, y: 0, w: 3, h: 3 },
      { id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 6, y: 0, w: 6, h: 5 }
    ]);

    expect(canAddFreePlacement(placements, 'widget', 'decoration')).toBe(true);
    expect(canAddFreePlacement(placements, 'work', 'work-1')).toBe(false);
    expect(canAddFreePlacement(placements, 'folder', 'folder-1')).toBe(false);
    expect(canAddFreePlacement(placements, 'portfolio', 'portfolio')).toBe(false);
  });

  it('keeps every explicitly removed placement absent, including Portfolio', () => {
    const legacyFallback = migrateFreeOrder(['note', 'portfolio'], { note: 4, portfolio: 8 });
    const hydrated = hydrateSavedFreeLayout([], legacyFallback, 8, 5);

    expect(hydrated).toEqual([]);
  });

  it('restores Portfolio only while migrating a legacy layout without placement data', () => {
    const legacyFallback = migrateFreeOrder(['note'], { note: 4, portfolio: 8 });
    const hydrated = hydrateSavedFreeLayout(undefined, legacyFallback, 8, 5);

    expect(hydrated.filter(item => item.kind === 'portfolio')).toEqual([
      expect.objectContaining({ id: 'portfolio:portfolio', refId: 'portfolio', w: 8 })
    ]);
  });

  it('can remove and re-add the singleton Portfolio without duplicating it', () => {
    const initial = normalizeFreeLayout([
      { id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 8, h: 5 }
    ]);
    const removed = removeFreePlacement(initial, 'portfolio:portfolio');

    expect(canAddFreePlacement(removed, 'portfolio', 'portfolio')).toBe(true);
    const restored = normalizeFreeLayout([
      ...removed,
      { id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 8, h: 5 }
    ]);
    expect(canAddFreePlacement(restored, 'portfolio', 'portfolio')).toBe(false);
    expect(restored.filter(item => item.kind === 'portfolio')).toHaveLength(1);
  });

  it('never exposes placement controls to visitors or outside Customize mode', () => {
    expect(shouldShowFreePlacementControls(true, false, true)).toBe(true);
    expect(shouldShowFreePlacementControls(false, false, true)).toBe(false);
    expect(shouldShowFreePlacementControls(true, true, true)).toBe(false);
    expect(shouldShowFreePlacementControls(true, false, false)).toBe(false);
  });
});
