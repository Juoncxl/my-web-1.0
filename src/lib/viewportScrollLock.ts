interface ScrollLockSnapshot {
  count: number;
  bodyOverflow: string;
  bodyPaddingRight: string;
  rootOverflow: string;
}

const activeLocks = new WeakMap<Document, ScrollLockSnapshot>();

/**
 * Lock viewport scrolling without losing the caller's pre-existing inline
 * styles. Multiple viewport modals share one lock and release it only after
 * the final modal unmounts.
 */
export function acquireViewportScrollLock(documentRef: Document): () => void {
  const existing = activeLocks.get(documentRef);
  if (existing) {
    existing.count += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      existing.count -= 1;
      if (existing.count === 0) restoreViewportScroll(documentRef, existing);
    };
  }

  const { body, documentElement } = documentRef;
  const snapshot: ScrollLockSnapshot = {
    count: 1,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    rootOverflow: documentElement.style.overflow
  };
  activeLocks.set(documentRef, snapshot);

  const viewport = documentRef.defaultView;
  const scrollbarWidth = viewport ? Math.max(0, viewport.innerWidth - documentElement.clientWidth) : 0;
  const currentPadding = viewport ? Number.parseFloat(viewport.getComputedStyle(body).paddingRight) || 0 : 0;

  body.style.overflow = 'hidden';
  documentElement.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    snapshot.count -= 1;
    if (snapshot.count === 0) restoreViewportScroll(documentRef, snapshot);
  };
}

function restoreViewportScroll(documentRef: Document, snapshot: ScrollLockSnapshot): void {
  documentRef.body.style.overflow = snapshot.bodyOverflow;
  documentRef.body.style.paddingRight = snapshot.bodyPaddingRight;
  documentRef.documentElement.style.overflow = snapshot.rootOverflow;
  activeLocks.delete(documentRef);
}

export function getViewportScrollLockCount(documentRef: Document): number {
  return activeLocks.get(documentRef)?.count || 0;
}
