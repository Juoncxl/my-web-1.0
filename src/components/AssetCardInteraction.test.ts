import React, { useState, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCard } from './AssetCard';
import type { Asset, User } from '../types';

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: vi.fn(initial => [initial, vi.fn()]),
  useEffect: vi.fn(),
  useRef: vi.fn(() => ({ current: null }))
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock('./ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));

type Element = ReactElement<Record<string, any>>;
const asset = { id: 'asset_test', title: 'Card test', category: 'prompts', content: 'Description',
  previewImage: '/api/cxl/media?scope=owner', createdAt: '2026-09-28', userId: 'owner', tags: [] } as unknown as Asset;

function findPath(node: Element, predicate: (element: Element) => boolean): Element[] | null {
  if (predicate(node)) return [node];
  for (const child of React.Children.toArray(node.props.children)) {
    if (!React.isValidElement(child)) continue;
    const result = findPath(child as Element, predicate);
    if (result) return [node, ...result];
  }
  return null;
}
function matches(node: Element, selector: string) {
  if (selector === '[data-card-action]') return node.props['data-card-action'] !== undefined;
  const role = selector.match(/^\[role="(.+)"\]$/)?.[1];
  return role ? node.props.role === role : node.type === selector;
}
// Exercise actual component handlers in capture then bubble order, with ancestor-aware closest().
function click(path: Element[]) {
  const target = { closest: (selectors: string) => [...path].reverse().find(node =>
    selectors.split(', ').some(selector => matches(node, selector))) || null };
  let stopped = false;
  const event = { target, currentTarget: target, stopPropagation: () => { stopped = true; }, preventDefault: vi.fn() };
  for (const node of path) { node.props.onClickCapture?.(event); if (stopped) return; }
  for (const node of [...path].reverse()) { node.props.onClick?.(event); if (stopped) return; }
}
function render(overrides: Record<string, unknown> = {}) {
  const actions = { onClick: vi.fn(), onBookmark: vi.fn(), onLike: vi.fn(), onSelectCategory: vi.fn(),
    onPreviewCreator: vi.fn(), onEdit: vi.fn() };
  const tree = AssetCard({ asset, ...actions, isOwner: true,
    creatorProfile: { id: 'owner', displayName: 'Owner' } as User, ...overrides }) as Element;
  const article = findPath(tree, node => node.type === 'article')!.at(-1)!;
  return { article, actions };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string, public detail: unknown) {} });
});

describe('AssetCard article capture navigation', () => {
  it.each(['cv-card-cover-image', 'cv-card-cover', 'cv-card-body', 'cv-card-snippet'])('opens once from %s', className => {
    const { article, actions } = render();
    click(findPath(article, node => String(node.props.className || '').split(' ').includes(className))!);
    expect(actions.onClick).toHaveBeenCalledExactlyOnceWith(asset);
  });
  it('opens once from nested fallback artwork and title', () => {
    const { article, actions } = render({ asset: { ...asset, previewImage: '' } });
    click(findPath(article, node => node.props.className === 'cv-fallback-mark')!);
    expect(actions.onClick).toHaveBeenCalledOnce();
    actions.onClick.mockClear();
    click(findPath(article, node => node.type === 'h3')!);
    expect(actions.onClick).toHaveBeenCalledOnce();
  });
  it.each([
    ['cv-bookmark-button', 'onBookmark'], ['cv-like-button', 'onLike'],
    ['cv-cover-category', 'onSelectCategory'], ['cv-card-author-preview', 'onPreviewCreator'],
    ['cv-more-button', null]
  ])('keeps %s independent during capture', (className, action) => {
    const { article, actions } = render();
    const path = findPath(article, node => String(node.props.className || '').split(' ').includes(className!))!;
    // Clicking a nested icon/text still resolves to its interactive parent.
    click([...path, React.createElement('span')]);
    expect(actions.onClick).not.toHaveBeenCalled();
    if (action) expect(actions[action as keyof typeof actions]).toHaveBeenCalledOnce();
  });
  it('keeps open menu items independent', () => {
    vi.mocked(useState).mockReturnValueOnce([true, vi.fn()]);
    const { article, actions } = render();
    const menuPath = findPath(article, node => node.props.className === 'cv-card-menu')!;
    click(menuPath);
    expect(actions.onClick).not.toHaveBeenCalled();
    const buttonPath = findPath(menuPath.at(-1)!, node => node.type === 'button')!;
    click([...menuPath.slice(0, -1), ...buttonPath]);
    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onClick).not.toHaveBeenCalled();
  });
  it.each(['a', 'input', 'select', 'textarea', 'button', 'summary', 'role-button', 'role-link', 'data-action'])(
    'excludes %s descendants before child bubble handlers run', kind => {
      const { article, actions } = render();
      const props = kind.startsWith('role-') ? { role: kind.slice(5) } : kind === 'data-action' ? { 'data-card-action': '' } : {};
      const node = React.createElement(kind.includes('-') ? 'span' : kind, props);
      click([article, node, React.createElement('span')]);
      expect(actions.onClick).not.toHaveBeenCalled();
    });
  it.each(['Enter', ' '])('opens exactly once with %s only when the article has focus', key => {
    const { article, actions } = render();
    const target = {};
    const preventDefault = vi.fn();
    article.props.onKeyDown({ target, currentTarget: target, key, preventDefault });
    expect(actions.onClick).toHaveBeenCalledExactlyOnceWith(asset);
    expect(preventDefault).toHaveBeenCalledOnce();
    article.props.onKeyDown({ target: {}, currentTarget: target, key, preventDefault });
    expect(actions.onClick).toHaveBeenCalledOnce();
  });
  it('uses one article capture handler without surface handlers or nested buttons', () => {
    const { article } = render();
    expect(article.props.onClickCapture).toBeTypeOf('function');
    expect(article.props.onClick).toBeUndefined();
    expect(article.props.tabIndex).toBe(0);
    for (const className of ['cv-card-visual', 'cv-card-body']) {
      const node = findPath(article, item => item.props.className === className)!.at(-1)!;
      expect(node.props.onClick).toBeUndefined();
      expect(node.props.onClickCapture).toBeUndefined();
    }
    function check(node: Element, buttonAncestor = false) {
      if (node.type === 'button') expect(buttonAncestor).toBe(false);
      for (const child of React.Children.toArray(node.props.children)) {
        if (React.isValidElement(child)) check(child as Element, buttonAncestor || node.type === 'button');
      }
    }
    check(article);
  });
});
