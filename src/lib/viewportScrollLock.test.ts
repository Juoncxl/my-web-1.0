import { describe, expect, it } from 'vitest';
import { acquireViewportScrollLock, getViewportScrollLockCount } from './viewportScrollLock';

function makeDocument() {
  const bodyStyle = { overflow: 'auto', paddingRight: '3px' };
  const rootStyle = { overflow: 'clip' };
  const documentRef = {
    body: { style: bodyStyle },
    documentElement: { style: rootStyle, clientWidth: 1180 },
    defaultView: {
      innerWidth: 1200,
      getComputedStyle: () => ({ paddingRight: '3px' })
    }
  } as unknown as Document;
  return { documentRef, bodyStyle, rootStyle };
}

describe('viewport scroll lock lifecycle', () => {
  it('locks body and document scroll, compensates the scrollbar, and restores exact styles', () => {
    const { documentRef, bodyStyle, rootStyle } = makeDocument();
    const release = acquireViewportScrollLock(documentRef);

    expect(bodyStyle).toEqual({ overflow: 'hidden', paddingRight: '23px' });
    expect(rootStyle.overflow).toBe('hidden');
    expect(getViewportScrollLockCount(documentRef)).toBe(1);

    release();
    expect(bodyStyle).toEqual({ overflow: 'auto', paddingRight: '3px' });
    expect(rootStyle.overflow).toBe('clip');
    expect(getViewportScrollLockCount(documentRef)).toBe(0);
  });

  it('keeps a shared lock until the final modal releases and makes cleanup idempotent', () => {
    const { documentRef, bodyStyle } = makeDocument();
    const releaseParent = acquireViewportScrollLock(documentRef);
    const releaseChild = acquireViewportScrollLock(documentRef);

    expect(getViewportScrollLockCount(documentRef)).toBe(2);
    releaseParent();
    releaseParent();
    expect(getViewportScrollLockCount(documentRef)).toBe(1);
    expect(bodyStyle.overflow).toBe('hidden');

    releaseChild();
    expect(getViewportScrollLockCount(documentRef)).toBe(0);
    expect(bodyStyle.overflow).toBe('auto');
  });
});
