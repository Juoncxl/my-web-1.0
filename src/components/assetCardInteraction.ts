const CARD_INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[data-card-action]'
].join(', ');

/** Keep card navigation on its visual/body surfaces while allowing child controls to act independently. */
export function shouldOpenAssetCardFromTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return true;

  const element = target as {
    closest?: (selectors: string) => unknown;
    parentElement?: { closest?: (selectors: string) => unknown } | null;
  };
  const closest = element.closest || element.parentElement?.closest;
  const context = element.closest ? element : element.parentElement;

  if (!closest || !context) return true;
  return !closest.call(context, CARD_INTERACTIVE_TARGET_SELECTOR);
}
