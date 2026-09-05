import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, MoreHorizontal, RefreshCcw, Star, Trash2 } from 'lucide-react';
import {
  CREATOR_MEDIA_MAX_ITEMS,
  reorderMediaItem,
  type CreatorMediaDraft,
  type CreatorMediaItem
} from './creatorMediaModel';

export interface CreatorMediaCollectionProps {
  draft: CreatorMediaDraft;
  onUpload: (files: File[]) => void;
  onReplace: (itemId: string, file: File) => void;
  onSetCover: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onReorder: (itemId: string, targetId: string) => void;
  onDimensions: (itemId: string, naturalWidth: number, naturalHeight: number) => void;
}

function mediaTypeLabel(item: CreatorMediaItem): string {
  return item.kind === 'gif' ? 'GIF' : 'รูปภาพ';
}

export const CreatorMediaCollection: React.FC<CreatorMediaCollectionProps> = ({
  draft,
  onUpload,
  onReplace,
  onSetCover,
  onRemove,
  onReorder,
  onDimensions
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeActionMenuRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<{ itemId: string; pointerId: number; targetId: string | null; holdTimer: number | null; startX: number; startY: number }>({ itemId: '', pointerId: 0, targetId: null, holdTimer: null, startX: 0, startY: 0 });
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const countLabel = `${draft.items.length} / ${CREATOR_MEDIA_MAX_ITEMS} รูป`;
  // Preview the candidate order during a drag. The Composer draft is only
  // updated on pointer release, so cancelling a drag is always non-destructive.
  const renderedItems = draggingItemId && dragTargetId
    ? reorderMediaItem(draft, draggingItemId, dragTargetId).items
    : draft.items;

  useEffect(() => {
    if (!openMenuId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && activeActionMenuRef.current?.contains(event.target)) return;
      setOpenMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuId]);

  const clearPointerDrag = () => {
    if (pointerDragRef.current.holdTimer !== null) window.clearTimeout(pointerDragRef.current.holdTimer);
    pointerDragRef.current = { itemId: '', pointerId: 0, targetId: null, holdTimer: null, startX: 0, startY: 0 };
    setDraggingItemId(null);
    setDragTargetId(null);
  };

  const startDragging = (itemId: string) => setDraggingItemId(itemId);

  // Pointer events on the ellipsis often originate from its SVG/path rather
  // than the summary element itself. Element covers both HTML and SVG nodes.
  const isInteractiveTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('button, summary, input'));

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) onUpload(files);
    event.target.value = '';
  };

  const handleReplaceChange = (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onReplace(itemId, file);
    event.target.value = '';
  };

  return <section className="csp-work-section csp-media-collection" aria-labelledby="csp-media-collection-title">
    <div className="csp-section-heading csp-media-collection-heading">
      <div>
        <h2 id="csp-media-collection-title">สื่อของผลงาน</h2>
        <p>เพิ่มรูปสำหรับผลงาน และเลือกหนึ่งรายการเป็นภาพปก</p>
      </div>
      <span className="csp-media-count" aria-label={`สื่อ ${countLabel}`}>{countLabel}</span>
    </div>

    <input ref={uploadInputRef} className="csp-visually-hidden-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleUploadChange} />
    <button type="button" className="csp-secondary-button csp-media-upload-button" onClick={() => uploadInputRef.current?.click()} disabled={draft.items.length >= CREATOR_MEDIA_MAX_ITEMS}>
      <ImagePlus className="h-4 w-4" />เพิ่มรูป
    </button>

    {draft.items.length === 0 ? <div className="csp-media-empty-state">
      <strong>ยังไม่มีสื่อในผลงาน</strong>
      <p>เพิ่มรูปเพื่อใช้เป็นภาพปกหรือแกลเลอรีของผลงาน</p>
      <button type="button" className="csp-primary-button" onClick={() => uploadInputRef.current?.click()}>+ เพิ่มรูป</button>
    </div> : <div className="csp-media-grid" aria-label="รายการสื่อของผลงาน">
      {renderedItems.map((item, index) => {
        const isCover = draft.coverId === item.id;
        return <article
          className={`csp-media-item ${isCover ? 'is-cover' : ''} ${draggingItemId === item.id ? 'is-dragging' : ''} ${dragTargetId === item.id ? 'is-drag-target' : ''}`}
          key={item.id}
          data-media-id={item.id}
          onPointerDown={event => {
            if (isInteractiveTarget(event.target)) return;
            pointerDragRef.current = { itemId: item.id, pointerId: event.pointerId, targetId: item.id, holdTimer: null, startX: event.clientX, startY: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
            if (event.pointerType === 'touch') {
              pointerDragRef.current.holdTimer = window.setTimeout(() => startDragging(item.id), 260);
            } else startDragging(item.id);
          }}
          onPointerMove={event => {
            const active = pointerDragRef.current;
            if (active.pointerId !== event.pointerId) return;
            if (!draggingItemId && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 8) {
              if (active.holdTimer !== null) window.clearTimeout(active.holdTimer);
              active.holdTimer = null;
              return;
            }
            if (!draggingItemId) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-media-id]')?.dataset.mediaId || null;
            active.targetId = target;
            setDragTargetId(target && target !== active.itemId ? target : null);
          }}
          onPointerUp={event => {
            const active = pointerDragRef.current;
            if (active.pointerId === event.pointerId && draggingItemId && active.targetId && active.targetId !== active.itemId) onReorder(active.itemId, active.targetId);
            clearPointerDrag();
          }}
          onPointerCancel={clearPointerDrag}
        >
          <div className="csp-media-thumbnail-wrap">
            <img className="csp-media-thumbnail" src={item.src} alt={`สื่อ ${index + 1} ${mediaTypeLabel(item)}`} onLoad={event => onDimensions(item.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
            <span className="csp-media-type-badge">{mediaTypeLabel(item)}</span>
            {isCover && <span className="csp-media-cover-badge"><Star className="h-3 w-3" />ภาพปก</span>}
          </div>
          <div className="csp-media-item-actions">
            <div ref={openMenuId === item.id ? activeActionMenuRef : undefined} className={`csp-media-action-menu ${openMenuId === item.id ? 'is-open' : ''}`}>
              <button
                type="button"
                className="csp-media-menu-trigger"
                aria-label={`จัดการสื่อ ${index + 1}`}
                aria-haspopup="menu"
                aria-expanded={openMenuId === item.id}
                title="จัดการรูป"
                onClick={() => setOpenMenuId(previous => previous === item.id ? null : item.id)}
              ><MoreHorizontal className="h-4 w-4" /></button>
              {openMenuId === item.id && <div className="csp-media-action-popover" role="menu">
                {!isCover && <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onSetCover(item.id); }}><Star className="h-3.5 w-3.5" />ตั้งเป็นภาพปก</button>}
                <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); replaceInputRefs.current[item.id]?.click(); }}><RefreshCcw className="h-3.5 w-3.5" />แทนที่รูป</button>
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpenMenuId(null); onRemove(item.id); }}><Trash2 className="h-3.5 w-3.5" />ลบรูป</button>
              </div>}
            </div>
            <input ref={input => { replaceInputRefs.current[item.id] = input; }} className="csp-visually-hidden-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleReplaceChange(item.id, event)} />
          </div>
        </article>;
      })}
    </div>}
  </section>;
};
