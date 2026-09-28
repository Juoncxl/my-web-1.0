import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { shouldOpenAssetCardFromTarget } from './assetCardInteraction';

const cardSource = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function targetInside(interactiveSelector?: string) {
  return {
    closest: vi.fn((selectors: string) => interactiveSelector && selectors.split(', ').includes(interactiveSelector)
      ? { nodeName: 'INTERACTIVE' }
      : null)
  } as unknown as EventTarget;
}

describe('AssetCard hit target and child actions', () => {
  it.each([
    ['card body', 'className="cv-card-body" onClick={handleCardSurfaceClick}'],
    ['cover and preview', 'className="cv-card-visual" onClick={handleCardSurfaceClick}']
  ])('%s opens the same Work Detail callback', (_surface, sourceMarker) => {
    const onClick = vi.fn();
    expect(cardSource).toContain(sourceMarker);
    if (shouldOpenAssetCardFromTarget(targetInside())) onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[data-card-action]'
  ])('does not open Detail for interactive child target %s', selector => {
    const onClick = vi.fn();
    const target = targetInside(selector) as EventTarget & { closest: ReturnType<typeof vi.fn> };
    expect(shouldOpenAssetCardFromTarget(target)).toBe(false);
    expect(target.closest).toHaveBeenCalledWith(expect.stringContaining(selector));
    if (shouldOpenAssetCardFromTarget(target)) onClick();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps bookmark, overflow, category, creator-preview, and menu actions as child controls', () => {
    for (const marker of [
      'onClick={handleLike}',
      'onClick={handleBookmark}',
      'onClick={handleMenuToggle}',
      'onClick={handleCategoryClick}',
      'onClick={handleCreatorPreview}',
      'className="cv-card-menu" onClick={event => event.stopPropagation()}',
      'onClick={handleMenuAction('
    ]) expect(cardSource).toContain(marker);
    expect(cardSource).toContain('const handleBookmark = (event: React.MouseEvent) => {');
    expect(cardSource).toMatch(/const handleBookmark = \(event: React\.MouseEvent\) => \{\s*event\.stopPropagation\(\);\s*if \(interactionMode === 'live'\) onBookmark\?\.\(asset\.id\);/);
  });

  it('preserves Enter/Space activation, focus styling, and existing card visuals', () => {
    expect(cardSource).toContain("if (event.key === 'Enter' || event.key === ' ')");
    expect(cardSource).toContain('tabIndex={0}');
    expect(cardSource).toContain('aria-label={`เปิดผลงาน ${cardTitle}`}');
    expect(cssSource).toMatch(/\.cv-asset-card\s*\{[^}]*cursor:\s*pointer/s);
    expect(cssSource).toMatch(/\.cv-asset-card:hover,\s*\.cv-asset-card:focus-visible\s*\{[^}]*box-shadow:/s);
    expect(cardSource).not.toContain('<button\n      onClick={handleCardSurfaceClick}');
  });
});
