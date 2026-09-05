export const FREE_LAYOUT_COLUMNS = 12;
export const FREE_LAYOUT_MAX_ROWS = 240;

export type FreePlacementKind = 'widget' | 'portfolio' | 'work' | 'folder';

export interface FreeLayoutPlacement {
  id: string;
  kind: FreePlacementKind;
  refId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  heightMode?: 'auto';
}

export interface FreeWidgetInstance {
  id: string;
  widgetType: string;
  title?: string;
  config: Record<string, unknown>;
}

export interface FreePlacementWidthRange {
  minW: number;
  maxW: number;
}

export type PortfolioDisplayLimit = 3 | 6 | 9 | 12 | 'all';
export type WorkCardSize = 'narrow' | 'medium' | 'wide';

export interface FreeGridPointerMetrics {
  clientX: number;
  clientY: number;
  containerLeft: number;
  containerTop: number;
  containerWidth: number;
  rowHeight: number;
  columnGap: number;
  rowGap: number;
}

export function getPortfolioShowcaseItems<T>(items: readonly T[], limit: PortfolioDisplayLimit): T[] {
  return limit === 'all' ? [...items] : items.slice(0, limit);
}

export function getFreePlacementId(kind: FreePlacementKind, refId: string): string {
  return `${kind}:${refId}`;
}

const WIDGET_MIN_WIDTHS: Readonly<Record<string, number>> = {
  decoration: 1,
  single_image: 1,
  folder: 2,
  playlist: 2,
  status: 2,
  note: 2,
  links: 2,
  goal: 2,
  gallery: 2,
  clock: 2,
  weather: 2,
  todo: 3,
  calendar: 3
};

export function getFreePlacementWidthRange(kind: FreePlacementKind, widgetType?: string): FreePlacementWidthRange {
  if (kind === 'portfolio') return { minW: 4, maxW: FREE_LAYOUT_COLUMNS };
  if (kind === 'work') return { minW: 3, maxW: FREE_LAYOUT_COLUMNS };
  if (kind === 'folder') return { minW: 2, maxW: FREE_LAYOUT_COLUMNS };
  return { minW: WIDGET_MIN_WIDTHS[widgetType || ''] || 2, maxW: FREE_LAYOUT_COLUMNS };
}

export function getFreePlacementWidthOptions(kind: FreePlacementKind, widgetType?: string): number[] {
  const { minW, maxW } = getFreePlacementWidthRange(kind, widgetType);
  return Array.from({ length: maxW - minW + 1 }, (_, index) => minW + index);
}

export function constrainFreePlacementWidth(width: number, kind: FreePlacementKind, widgetType?: string): number {
  const { minW, maxW } = getFreePlacementWidthRange(kind, widgetType);
  return Math.min(maxW, Math.max(minW, Math.round(asFiniteNumber(width, minW))));
}

export function normalizeFreeWidgetInstances(inputs: Array<Partial<FreeWidgetInstance>>): FreeWidgetInstance[] {
  const accepted: FreeWidgetInstance[] = [];
  for (const input of inputs) {
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    const widgetType = typeof input.widgetType === 'string' ? input.widgetType.trim() : '';
    if (!id || !widgetType || accepted.some(instance => instance.id === id)) continue;
    accepted.push({
      id,
      widgetType,
      ...(typeof input.title === 'string' ? { title: input.title } : {}),
      config: input.config && typeof input.config === 'object' && !Array.isArray(input.config) ? { ...input.config } : {}
    });
  }
  return accepted;
}

export function createFreeWidgetInstance(
  widgetType: string,
  existing: readonly FreeWidgetInstance[],
  preferredId?: string,
  config: Record<string, unknown> = {}
): FreeWidgetInstance {
  const cleanType = widgetType.trim() || 'widget';
  const baseId = preferredId?.trim() || `${cleanType}-${Date.now().toString(36)}`;
  const ids = new Set(existing.map(instance => instance.id));
  let id = baseId;
  let suffix = 2;
  while (ids.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return { id, widgetType: cleanType, config: { ...config } };
}

export function updateFreeWidgetInstance(
  instances: readonly FreeWidgetInstance[],
  id: string,
  config: Record<string, unknown>,
  title?: string
): FreeWidgetInstance[] {
  return instances.map(instance => instance.id === id ? { ...instance, config: { ...config }, ...(title === undefined ? {} : { title }) } : instance);
}

/** Widgets are instance-based; content-backed and system blocks remain unique. */
export function canAddFreePlacement(placements: readonly FreeLayoutPlacement[], kind: FreePlacementKind, refId: string): boolean {
  if (kind === 'widget') return true;
  if (kind === 'portfolio') return !placements.some(item => item.kind === 'portfolio');
  return !placements.some(item => item.kind === kind && item.refId === refId);
}

export function shouldShowFreePlacementControls(isOwner: boolean, isPublicView: boolean, isCustomizeOpen: boolean): boolean {
  return isOwner && !isPublicView && isCustomizeOpen;
}

/**
 * Migrates legacy type-keyed Widget placements into explicit instance records.
 * A legacy refId remains the first stable instance id, so existing layouts do
 * not move or lose their settings during the model upgrade.
 */
export function hydrateFreeWidgetInstances(
  placements: readonly FreeLayoutPlacement[],
  savedInstances: Array<Partial<FreeWidgetInstance>> = [],
  legacyConfigs: Readonly<Record<string, Record<string, unknown>>> = {},
  legacyTitles: Readonly<Record<string, string>> = {}
): FreeWidgetInstance[] {
  const instances = normalizeFreeWidgetInstances(savedInstances);
  const known = new Set(instances.map(instance => instance.id));
  for (const placement of placements) {
    if (placement.kind !== 'widget' || known.has(placement.refId)) continue;
    const legacyType = placement.refId;
    instances.push({
      id: placement.refId,
      widgetType: legacyType,
      ...(legacyTitles[legacyType] ? { title: legacyTitles[legacyType] } : {}),
      config: { ...(legacyConfigs[legacyType] || {}) }
    });
    known.add(placement.refId);
  }
  return instances;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeFreePlacement(input: Partial<FreeLayoutPlacement>): FreeLayoutPlacement | null {
  if (!input || typeof input.id !== 'string' || !input.id || typeof input.kind !== 'string' || typeof input.refId !== 'string' || !input.refId) return null;
  if (!['widget', 'portfolio', 'work', 'folder'].includes(input.kind)) return null;
  const w = Math.min(FREE_LAYOUT_COLUMNS, Math.max(1, Math.round(asFiniteNumber(input.w, 4))));
  const autoHeight = input.kind === 'portfolio' || input.kind === 'work' || input.heightMode === 'auto';
  const maxHeight = autoHeight ? FREE_LAYOUT_MAX_ROWS : 24;
  const h = Math.min(maxHeight, Math.max(1, Math.round(asFiniteNumber(input.h, 2))));
  const x = Math.min(FREE_LAYOUT_COLUMNS - w, Math.max(0, Math.round(asFiniteNumber(input.x, 0))));
  const y = Math.min(FREE_LAYOUT_MAX_ROWS - h, Math.max(0, Math.round(asFiniteNumber(input.y, 0))));
  return {
    id: input.id,
    kind: input.kind as FreePlacementKind,
    refId: input.refId,
    x,
    y,
    w,
    h,
    ...(autoHeight ? { heightMode: 'auto' as const } : {})
  };
}

/** Responsive showcase columns derived from the Portfolio's 12-column width. */
export function getPortfolioGridColumns(width: number): 1 | 2 | 3 | 4 {
  const normalizedWidth = Math.min(FREE_LAYOUT_COLUMNS, Math.max(1, Math.round(asFiniteNumber(width, 1))));
  if (normalizedWidth >= 9) return 4;
  if (normalizedWidth >= 6) return 2;
  return 1;
}

/**
 * Safe first-paint height before the DOM measurement is available. The live
 * ResizeObserver refines this value without mutating persisted layout state.
 */
export function estimatePortfolioHeightRows(width: number, itemCount: number, showControls = false): number {
  const columns = getPortfolioGridColumns(width);
  const cardRows = Math.ceil(Math.max(0, Math.round(asFiniteNumber(itemCount, 0))) / columns);
  const chromeRows = showControls ? 4 : 3;
  return Math.min(FREE_LAYOUT_MAX_ROWS, Math.max(3, chromeRows + Math.max(1, cardRows) * 5));
}

export function getWorkCardSize(width: number): WorkCardSize {
  const normalizedWidth = Math.min(FREE_LAYOUT_COLUMNS, Math.max(1, Math.round(asFiniteNumber(width, 1))));
  if (normalizedWidth <= 4) return 'narrow';
  if (normalizedWidth <= 8) return 'medium';
  return 'wide';
}

/** Conservative first paint only; the live Work content measurement replaces it. */
export function estimateWorkHeightRows(width: number, showControls = false): number {
  const controls = showControls ? 1 : 0;
  const size = getWorkCardSize(width);
  if (size === 'narrow') return 7 + controls;
  if (size === 'medium') return 6 + controls;
  return 5 + controls;
}

/** Convert viewport pointer coordinates to a composition-local grid cell. */
export function pointerToFreeGridCell(metrics: FreeGridPointerMetrics): { x: number; y: number } {
  const columnGap = Math.max(0, asFiniteNumber(metrics.columnGap, 0));
  const rowGap = Math.max(0, asFiniteNumber(metrics.rowGap, 0));
  const containerWidth = Math.max(1, asFiniteNumber(metrics.containerWidth, 1));
  const columnWidth = Math.max(1, (containerWidth - columnGap * (FREE_LAYOUT_COLUMNS - 1)) / FREE_LAYOUT_COLUMNS);
  const columnStep = Math.max(1, columnWidth + columnGap);
  const rowStep = Math.max(1, asFiniteNumber(metrics.rowHeight, 72) + rowGap);
  const localX = asFiniteNumber(metrics.clientX, 0) - asFiniteNumber(metrics.containerLeft, 0);
  const localY = asFiniteNumber(metrics.clientY, 0) - asFiniteNumber(metrics.containerTop, 0);
  return {
    x: Math.min(FREE_LAYOUT_COLUMNS - 1, Math.max(0, Math.floor(localX / columnStep))),
    y: Math.min(FREE_LAYOUT_MAX_ROWS - 1, Math.max(0, Math.floor(localY / rowStep)))
  };
}

export function anchorFreeGridCell(pointerCell: { x: number; y: number }, grabOffset: { x: number; y: number }, itemWidth: number, itemHeight: number): { x: number; y: number } {
  const width = Math.min(FREE_LAYOUT_COLUMNS, Math.max(1, Math.round(asFiniteNumber(itemWidth, 1))));
  const height = Math.min(FREE_LAYOUT_MAX_ROWS, Math.max(1, Math.round(asFiniteNumber(itemHeight, 1))));
  return {
    x: Math.min(FREE_LAYOUT_COLUMNS - width, Math.max(0, Math.round(asFiniteNumber(pointerCell.x, 0) - asFiniteNumber(grabOffset.x, 0)))),
    y: Math.min(FREE_LAYOUT_MAX_ROWS - height, Math.max(0, Math.round(asFiniteNumber(pointerCell.y, 0) - asFiniteNumber(grabOffset.y, 0))))
  };
}

export function pixelsToFreeGridRows(contentHeight: number, rowHeight: number, rowGap: number): number {
  const safeHeight = Math.max(0, asFiniteNumber(contentHeight, 0));
  const safeRowHeight = Math.max(1, asFiniteNumber(rowHeight, 72));
  const safeGap = Math.max(0, asFiniteNumber(rowGap, 0));
  return Math.max(1, Math.min(FREE_LAYOUT_MAX_ROWS, Math.ceil((safeHeight + safeGap) / (safeRowHeight + safeGap))));
}

export function placementsOverlap(a: Pick<FreeLayoutPlacement, 'x' | 'y' | 'w' | 'h'>, b: Pick<FreeLayoutPlacement, 'x' | 'y' | 'w' | 'h'>): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function firstAvailablePosition(placements: FreeLayoutPlacement[], candidate: Pick<FreeLayoutPlacement, 'x' | 'y' | 'w' | 'h'>, ignoreId?: string): { x: number; y: number } {
  const maxY = Math.min(FREE_LAYOUT_MAX_ROWS - candidate.h, Math.max(candidate.y + 24, ...placements.map(item => item.y + item.h + 2), 2));
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= FREE_LAYOUT_COLUMNS - candidate.w; x += 1) {
      const next = { ...candidate, x, y };
      if (!placements.some(item => item.id !== ignoreId && placementsOverlap(next, item))) return { x, y };
    }
  }
  return { x: 0, y: Math.min(maxY, FREE_LAYOUT_MAX_ROWS - candidate.h) };
}

/** Resolve a pointer/requested position to the nearest deterministic free cell. */
export function resolveFreePlacementPosition(placements: FreeLayoutPlacement[], candidate: Pick<FreeLayoutPlacement, 'x' | 'y' | 'w' | 'h'>, ignoreId?: string): { x: number; y: number } {
  const w = Math.min(FREE_LAYOUT_COLUMNS, Math.max(1, Math.round(asFiniteNumber(candidate.w, 4))));
  const h = Math.min(FREE_LAYOUT_MAX_ROWS, Math.max(1, Math.round(asFiniteNumber(candidate.h, 2))));
  const current = {
    x: Math.min(FREE_LAYOUT_COLUMNS - w, Math.max(0, Math.round(asFiniteNumber(candidate.x, 0)))),
    y: Math.min(FREE_LAYOUT_MAX_ROWS - h, Math.max(0, Math.round(asFiniteNumber(candidate.y, 0)))),
    w,
    h
  };
  if (!placements.some(item => item.id !== ignoreId && placementsOverlap(current, item))) return { x: current.x, y: current.y };

  // Search by Manhattan distance, then top-to-bottom/left-to-right. This keeps
  // a blocked drop close to the user's pointer instead of reordering the page.
  const maxRadius = FREE_LAYOUT_COLUMNS + 24;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    const options: Array<{ x: number; y: number; distance: number }> = [];
    for (let y = Math.max(0, current.y - radius); y <= Math.min(FREE_LAYOUT_MAX_ROWS - current.h, current.y + radius); y += 1) {
      for (let x = Math.max(0, current.x - radius); x <= Math.min(FREE_LAYOUT_COLUMNS - current.w, current.x + radius); x += 1) {
        const distance = Math.abs(x - current.x) + Math.abs(y - current.y);
        if (Math.max(Math.abs(x - current.x), Math.abs(y - current.y)) === radius) options.push({ x, y, distance });
      }
    }
    options.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const available = options.find(option => !placements.some(item => item.id !== ignoreId && placementsOverlap({ ...current, x: option.x, y: option.y }, item)));
    if (available) return { x: available.x, y: available.y };
  }
  return firstAvailablePosition(placements, current, ignoreId);
}

/**
 * Replace configured auto heights with current rendered heights. Derived items
 * are treated as anchors; only records that now genuinely collide are moved.
 * Every unrelated valid x/y/w therefore remains authoritative.
 */
export function materializeDerivedHeights(inputs: Array<Partial<FreeLayoutPlacement>>, derivedHeights: Readonly<Record<string, number>>): FreeLayoutPlacement[] {
  const normalized = inputs
    .map(input => normalizeFreePlacement({ ...input, h: derivedHeights[input.id || ''] ?? input.h }))
    .filter((item): item is FreeLayoutPlacement => Boolean(item));
  const ordered = [...normalized].sort((a, b) => {
    const aDerived = Object.prototype.hasOwnProperty.call(derivedHeights, a.id) ? 0 : 1;
    const bDerived = Object.prototype.hasOwnProperty.call(derivedHeights, b.id) ? 0 : 1;
    return aDerived - bDerived || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
  });
  const accepted: FreeLayoutPlacement[] = [];

  for (const item of ordered) {
    const position = resolveFreePlacementPosition(accepted, item, item.id);
    accepted.push({ ...item, ...position });
  }

  const byId = new Map(accepted.map(item => [item.id, item]));
  return normalized.map(item => byId.get(item.id) || item);
}

export function materializePortfolioAutoHeight(inputs: Array<Partial<FreeLayoutPlacement>>, heightRows: number): FreeLayoutPlacement[] {
  const portfolioId = inputs.find(item => item.kind === 'portfolio')?.id;
  return materializeDerivedHeights(inputs, portfolioId ? { [portfolioId]: heightRows } : {});
}

/** Replace only currently-rendered records; hidden records stay persisted but never occupy cells. */
export function mergeResolvedFreeLayout(stored: FreeLayoutPlacement[], resolvedVisible: FreeLayoutPlacement[]): FreeLayoutPlacement[] {
  const resolvedById = new Map(resolvedVisible.map(item => [item.id, item]));
  let changed = false;
  const merged = stored.map(item => {
    const resolved = resolvedById.get(item.id);
    if (!resolved) return item;
    const same = item.x === resolved.x && item.y === resolved.y && item.w === resolved.w && item.h === resolved.h && item.heightMode === resolved.heightMode;
    if (same) return item;
    changed = true;
    return resolved;
  });
  return changed ? merged : stored;
}

export function normalizeFreeLayout(inputs: Array<Partial<FreeLayoutPlacement>>): FreeLayoutPlacement[] {
  const accepted: FreeLayoutPlacement[] = [];
  for (const input of inputs) {
    const normalized = normalizeFreePlacement(input);
    if (!normalized || accepted.some(existing => existing.id === normalized.id)) continue;
    const colliders = accepted.filter(existing => placementsOverlap(existing, normalized));
    // A persisted h for content-driven items is only a first-paint hint. It
    // must not invalidate authoritative x/y/w during hydration. Live derived
    // geometry resolves a genuine collision once content has been measured.
    if (normalized.heightMode === 'auto' || colliders.some(existing => existing.heightMode === 'auto')) {
      accepted.push(normalized);
      continue;
    }
    const position = resolveFreePlacementPosition(accepted, normalized);
    accepted.push({ ...normalized, ...position });
  }
  return accepted;
}

/**
 * Saved placements are authoritative, including an intentionally empty list.
 * Portfolio is restored only while migrating a legacy layout that has no
 * placement payload. Once placements exist, every removal stays removed.
 */
export function hydrateSavedFreeLayout(
  savedPlacements: Array<Partial<FreeLayoutPlacement>> | undefined,
  legacyFallback: Array<Partial<FreeLayoutPlacement>>,
  portfolioWidth = 9,
  portfolioHeight = 5
): FreeLayoutPlacement[] {
  if (Array.isArray(savedPlacements)) return normalizeFreeLayout(savedPlacements);
  const base = normalizeFreeLayout(legacyFallback);
  if (base.some(item => item.kind === 'portfolio')) return base;
  const portfolio = normalizeFreePlacement({
    id: getFreePlacementId('portfolio', 'portfolio'),
    kind: 'portfolio',
    refId: 'portfolio',
    x: 0,
    y: 0,
    w: constrainFreePlacementWidth(portfolioWidth, 'portfolio'),
    h: portfolioHeight,
    heightMode: 'auto'
  });
  if (!portfolio) return base;
  const position = resolveFreePlacementPosition(base, portfolio, portfolio.id);
  return [...base, { ...portfolio, ...position }];
}

export function compactFreeLayout(inputs: Array<Partial<FreeLayoutPlacement>>): FreeLayoutPlacement[] {
  const normalized = inputs.map(normalizeFreePlacement).filter((item): item is FreeLayoutPlacement => Boolean(item));
  normalized.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const packed: FreeLayoutPlacement[] = [];
  for (const item of normalized) {
    const position = firstAvailablePosition(packed, { ...item, x: 0, y: 0 });
    packed.push({ ...item, ...position });
  }
  return packed;
}

export function moveFreePlacement(inputs: FreeLayoutPlacement[], id: string, x: number, y: number): FreeLayoutPlacement[] {
  const current = inputs.find(item => item.id === id);
  if (!current) return inputs;
  const desired = normalizeFreePlacement({ ...current, x, y });
  if (!desired) return inputs;
  const position = resolveFreePlacementPosition(inputs, desired, id);
  return inputs.map(item => item.id === id ? { ...item, ...position } : item);
}

export function resizeFreePlacement(inputs: FreeLayoutPlacement[], id: string, w: number, h: number): FreeLayoutPlacement[] {
  const current = inputs.find(item => item.id === id);
  if (!current) return inputs;
  const resized = normalizeFreePlacement({ ...current, w, h });
  if (!resized) return inputs;
  const position = resolveFreePlacementPosition(inputs, resized, id);
  return inputs.map(item => item.id === id ? { ...resized, ...position } : item);
}

export function removeFreePlacement(inputs: FreeLayoutPlacement[], id: string): FreeLayoutPlacement[] {
  return inputs.filter(item => item.id !== id);
}

export function migrateFreeOrder(order: string[], spans: Record<string, number>): FreeLayoutPlacement[] {
  const inputs: FreeLayoutPlacement[] = order.map((entry, index) => {
    const kind: FreePlacementKind = entry === 'portfolio' ? 'portfolio' : 'widget';
    const refId = entry;
    return { id: getFreePlacementId(kind, refId), kind, refId, x: 0, y: index * 2, w: spans[entry] || 4, h: entry === 'portfolio' ? 5 : 2, ...(kind === 'portfolio' ? { heightMode: 'auto' as const } : {}) };
  });
  return compactFreeLayout(inputs);
}
