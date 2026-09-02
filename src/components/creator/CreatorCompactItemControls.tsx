import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, EllipsisVertical, Settings2, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RectLike {
  top: number;
  right: number;
  bottom: number;
}

interface SizeLike {
  width: number;
  height: number;
}

interface ViewportLike {
  width: number;
  height: number;
}

export interface CompactMenuPosition {
  left: number;
  top: number;
}

export function shouldUseCompactOwnerControls(layout: 'locked' | 'free', span: number): boolean {
  return layout === 'free' && span <= 2;
}

export function getCompactMenuPosition(anchor: RectLike, menu: SizeLike, viewport: ViewportLike): CompactMenuPosition {
  const edge = 8;
  const gap = 6;
  const left = Math.min(
    Math.max(edge, anchor.right - menu.width),
    Math.max(edge, viewport.width - menu.width - edge)
  );
  const fitsBelow = anchor.bottom + gap + menu.height <= viewport.height - edge;
  const top = fitsBelow
    ? anchor.bottom + gap
    : Math.max(edge, anchor.top - menu.height - gap);
  return { left, top };
}

interface CreatorCompactItemControlsProps {
  label: string;
  itemId: string;
  widgetInstanceId?: string;
  span: number;
  widthOptions: number[];
  height?: number;
  heightOptions?: number[];
  onSpan: (span: number) => void;
  onHeight?: (height: number) => void;
  onMove?: (direction: -1 | 1) => void;
  onEdit?: () => void;
  onRemove: () => void;
}

export const CreatorCompactItemControls: React.FC<CreatorCompactItemControlsProps> = ({
  label,
  itemId,
  widgetInstanceId,
  span,
  widthOptions,
  height,
  heightOptions = [],
  onSpan,
  onHeight,
  onMove,
  onEdit,
  onRemove
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CompactMenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const placeMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const anchorRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const next = getCompactMenuPosition(
        anchorRect,
        { width: menuRect.width, height: menuRect.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPosition(previous => previous?.left === next.left && previous.top === next.top ? previous : next);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    placeMenu();
    menuRef.current?.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const invoke = (action: (() => void) | undefined) => {
    setIsOpen(false);
    action?.();
  };

  const menu = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className="csp-compact-owner-menu"
      role="menu"
      aria-label={`จัดการ ${label}`}
      data-compact-owner-menu-for={itemId}
      data-widget-instance-id={widgetInstanceId}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <div className="csp-compact-owner-menu-heading"><strong>{label}</strong><span>{span} / 12</span></div>
      {onEdit && <button type="button" role="menuitem" onClick={() => invoke(onEdit)}><Settings2 className="h-3.5 w-3.5" />แก้ไข / ตั้งค่า</button>}
      <label className="csp-compact-owner-menu-field">ความกว้าง<select value={span} onChange={event => onSpan(Number(event.target.value))} aria-label={`ความกว้าง ${label}`}>{widthOptions.map(value => <option value={value} key={value}>{value} / 12 คอลัมน์</option>)}</select></label>
      {height !== undefined && onHeight && heightOptions.length > 0 && <label className="csp-compact-owner-menu-field">ความสูง<select value={height} onChange={event => onHeight(Number(event.target.value))} aria-label={`ความสูง ${label}`}>{heightOptions.map(value => <option value={value} key={value}>{value} แถว</option>)}</select></label>}
      {onMove && <div className="csp-compact-owner-menu-row"><button type="button" role="menuitem" onClick={() => invoke(() => onMove(-1))}><ChevronUp className="h-3.5 w-3.5" />ย้ายขึ้น</button><button type="button" role="menuitem" onClick={() => invoke(() => onMove(1))}><ChevronDown className="h-3.5 w-3.5" />ย้ายลง</button></div>}
      <button type="button" role="menuitem" className="is-danger" onClick={() => invoke(onRemove)}><Trash2 className="h-3.5 w-3.5" />นำออกจากหน้าโปรไฟล์</button>
    </div>,
    document.body
  ) : null;

  return <>
    <div className="csp-widget-edit-bar csp-compact-owner-bar" data-compact-owner-controls data-item-id={itemId} data-widget-instance-id={widgetInstanceId}>
      <button
        ref={triggerRef}
        type="button"
        className="csp-compact-owner-trigger"
        aria-label={`เปิดเมนูจัดการ ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); setPosition(null); setIsOpen(value => !value); }}
      ><EllipsisVertical className="h-4 w-4" /></button>
    </div>
    {menu}
  </>;
};
