import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Grid2X2, ImagePlus, Move, Palette, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import type { Asset } from '../../types';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DEFAULT_GALLERY_CAPTION, DEFAULT_GALLERY_DISPLAY_NAME, GALLERY_COLLAGE_LAYOUTS, GALLERY_FOCUS_POINTS, GALLERY_GAPS, GALLERY_IMAGE_FITS, GALLERY_TEMPLATES, GALLERY_TYPES,
  getGalleryPresentation, isSafeGallerySource, validateGalleryConfig, type CreatorWidgetConfig, type GalleryCollageLayout, type GalleryFocusPoint, type GalleryGap, type GalleryImageFit, type GalleryItem, type GalleryTemplate, type GalleryType
} from './creatorWidgetModel';

interface CreatorGalleryEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  assets: Asset[];
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

const MAX_ITEMS = 12;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const templateLabels: Record<GalleryTemplate, string> = { minimal: 'Minimal', magazine: 'Magazine', polaroid: 'Polaroid', 'film-strip': 'Film Strip', grid: 'Grid' };
const typeLabels: Record<GalleryType, string> = { single: 'Single', template: 'Template', collage: 'Collage', gif: 'GIF' };
const fitLabels: Record<GalleryImageFit, string> = { cover: 'Cover', contain: 'Contain', natural: 'Natural' };

function itemsFromAssets(assets: Asset[]): GalleryItem[] {
  return assets.flatMap(asset => asset.previewImages?.[0] ? [{ id: `asset-${asset.id}`, src: asset.previewImages[0], alt: asset.title, caption: asset.title, source: 'asset' as const, assetId: asset.id }] : []);
}

function createDraft(config: CreatorWidgetConfig, displayName?: string, assets: Asset[] = []) {
  const galleryItems = Array.isArray(config.galleryItems)
    ? config.galleryItems.map(item => ({ ...item }))
    : config.imageUrl
      ? [{ id: 'legacy-image', src: config.imageUrl, alt: config.galleryTitle || DEFAULT_GALLERY_DISPLAY_NAME, source: 'url' as const }]
      : itemsFromAssets(assets);
  return {
    displayName: displayName?.trim() || config.title?.trim() || config.galleryTitle?.trim() || DEFAULT_GALLERY_DISPLAY_NAME,
    config: {
      ...config,
      galleryType: GALLERY_TYPES.includes(config.galleryType as GalleryType) ? config.galleryType : 'collage' as GalleryType,
      galleryTitle: config.galleryTitle?.trim() || displayName?.trim() || config.title?.trim() || DEFAULT_GALLERY_DISPLAY_NAME,
      galleryCaption: config.galleryCaption?.trim() || config.description?.trim() || DEFAULT_GALLERY_CAPTION,
      galleryItems,
      galleryTemplate: GALLERY_TEMPLATES.includes(config.galleryTemplate as GalleryTemplate) ? config.galleryTemplate : 'magazine' as GalleryTemplate,
      galleryCollageLayout: GALLERY_COLLAGE_LAYOUTS.includes(config.galleryCollageLayout as GalleryCollageLayout) ? config.galleryCollageLayout : 'three' as GalleryCollageLayout,
      galleryGap: GALLERY_GAPS.includes(config.galleryGap as GalleryGap) ? config.galleryGap : 8 as GalleryGap,
      galleryImageFit: GALLERY_IMAGE_FITS.includes(config.galleryImageFit as GalleryImageFit) ? config.galleryImageFit : 'cover' as GalleryImageFit,
      galleryOuterRadius: config.galleryOuterRadius ?? 16,
      galleryInnerRadius: config.galleryInnerRadius ?? 8,
      galleryFocusPoint: GALLERY_FOCUS_POINTS.includes(config.galleryFocusPoint as GalleryFocusPoint) ? config.galleryFocusPoint : 'center' as GalleryFocusPoint,
      galleryShowCaption: config.galleryShowCaption !== false,
      galleryShowCounter: config.galleryShowCounter !== false,
      galleryShowSourceLabel: Boolean(config.galleryShowSourceLabel),
      galleryAutoplay: config.galleryAutoplay !== false,
      galleryLoop: config.galleryLoop !== false,
      galleryPauseOnHover: Boolean(config.galleryPauseOnHover)
    } as CreatorWidgetConfig
  };
}

export const CreatorGalleryEditorModal: React.FC<CreatorGalleryEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 6, previewDisplayName, assets, onSave, onCancel }) => {
  const initial = useRef(createDraft(config, displayName, assets));
  const [draftTitle, setDraftTitle] = useState(initial.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initial.current.config);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const initialSerialized = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: draftTitle, config: draftConfig }) !== initialSerialized.current;
  const presentation = useMemo(() => getGalleryPresentation(draftConfig, draftTitle), [draftConfig, draftTitle]);
  const errors: Record<string, string> = useMemo(() => ({
    ...validateGalleryConfig({ ...draftConfig, title: draftTitle }),
    ...(draftTitle.trim() ? {} : { displayName: 'กรุณาใส่ชื่อแกลเลอรี' })
  }), [draftConfig, draftTitle]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (showDiscardPrompt) setShowDiscardPrompt(false); else if (dirty) setShowDiscardPrompt(true); else onCancel(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); release(); opener?.focus(); };
  }, [dirty, onCancel, showDiscardPrompt]);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraftConfig(previous => ({ ...previous, ...patch }));
  const requestCancel = () => dirty ? setShowDiscardPrompt(true) : onCancel();
  const removeItem = (index: number) => set({ galleryItems: (draftConfig.galleryItems || []).filter((_, itemIndex) => itemIndex !== index) });
  const reorderItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...(draftConfig.galleryItems || [])];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ galleryItems: next });
  };
  const addAsset = (asset: Asset) => {
    const src = asset.previewImages?.[0];
    if (!src || (draftConfig.galleryItems || []).some(item => item.assetId === asset.id)) return;
    if ((draftConfig.galleryItems || []).length >= MAX_ITEMS) { setUploadError(`เพิ่มได้สูงสุด ${MAX_ITEMS} ภาพ`); return; }
    set({ galleryItems: [...(draftConfig.galleryItems || []), { id: `asset-${asset.id}`, src, alt: asset.title, caption: asset.title, source: 'asset', assetId: asset.id }] });
  };
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setUploadError('');
    Array.from(files).slice(0, MAX_ITEMS - (draftConfig.galleryItems || []).length).forEach(file => {
      if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) { setUploadError('รองรับเฉพาะ PNG, JPG, WebP และ GIF'); return; }
      if (file.size > MAX_FILE_BYTES) { setUploadError('ไฟล์ต้องมีขนาดไม่เกิน 5MB'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        setDraftConfig(previous => ({ ...previous, galleryItems: [...(previous.galleryItems || []), { id: `upload-${Date.now()}-${file.name}`, src: reader.result as string, alt: file.name, caption: file.name, source: 'upload', mimeType: file.type }] }));
        if (file.type === 'image/gif') setDraftConfig(previous => ({ ...previous, galleryGifUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    });
  };

  return <div className="csp-gallery-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-gallery-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-gallery-editor-title" aria-describedby="csp-gallery-editor-description">
      <header className="csp-gallery-editor-header"><div className="csp-gallery-editor-title-mark"><Grid2X2 aria-hidden="true" /></div><div><div className="csp-gallery-editor-title-line"><h2 id="csp-gallery-editor-title">แก้ไข Gallery Widget</h2><span>弥散渐变 Romantic Mist</span></div><p id="csp-gallery-editor-description">จัดการชุดภาพ การจัดวาง และดูผลบน Notion แบบเรียลไทม์</p></div><div className="csp-gallery-editor-notice">● การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</div><button type="button" className="csp-gallery-editor-close" onClick={requestCancel} aria-label="ปิด Gallery editor"><X aria-hidden="true" /></button></header>
      <form className="csp-gallery-editor-form" onSubmit={event => { event.preventDefault(); if (canSave) onSave(draftConfig, draftTitle.trim() || DEFAULT_GALLERY_DISPLAY_NAME); }}>
        <div className="csp-gallery-editor-body">
          <section className="csp-gallery-editor-column csp-gallery-editor-source" aria-label="แหล่งภาพและข้อมูล">
            <div className="csp-gallery-section-title"><ImagePlus aria-hidden="true" />01 แหล่งภาพ &amp; ข้อมูล <small>CONTENT</small></div>
            <label className="csp-gallery-field"><span>Display Name <small>ชื่อแกลเลอรี · ไม่เกิน 48 ตัวอักษร</small></span><input ref={titleInputRef} maxLength={48} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />{errors.displayName && <em role="alert">{errors.displayName}</em>}</label>
            <div className="csp-gallery-field"><span>Gallery Type <small>ประเภทการแสดงผล</small></span><div className="csp-gallery-type-picker">{GALLERY_TYPES.map(type => <button type="button" key={type} className={presentation.type === type ? 'is-selected' : ''} onClick={() => set({ galleryType: type })} aria-pressed={presentation.type === type}>{typeLabels[type]}</button>)}</div></div>
            <label className="csp-gallery-upload"><UploadCloud aria-hidden="true" /><strong>+ อัปโหลดรูปภาพใหม่</strong><span>PNG, JPG, WebP หรือ GIF · ไม่เกิน 5MB ต่อไฟล์</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={event => handleFiles(event.target.files)} /></label>
            {uploadError && <p className="csp-gallery-error" role="alert">{uploadError}</p>}
            <div className="csp-gallery-asset-picker"><div><strong>เลือกจากผลงานเดิม</strong><small>{assets.filter(asset => asset.previewImages?.[0]).length} ภาพที่ใช้ได้</small></div><div>{assets.filter(asset => asset.previewImages?.[0]).slice(0, 12).map(asset => <button type="button" key={asset.id} onClick={() => addAsset(asset)} aria-label={`เพิ่ม ${asset.title}`}><img src={asset.previewImages?.[0]} alt="" /></button>)}</div></div>
            <div className="csp-gallery-item-heading"><span>เรียงลำดับชุดภาพ <small>Drag to reorder</small></span><b>{presentation.allItems.length} / {MAX_ITEMS}</b></div>
            <div className="csp-gallery-item-list">{(draftConfig.galleryItems || []).map((item, index) => <div className="csp-gallery-item-row" key={item.id || index} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedIndex !== null) reorderItem(draggedIndex, index); setDraggedIndex(null); }}><Move aria-hidden="true" /><img src={isSafeGallerySource(item.src) ? item.src : ''} alt="" /><span><strong>{item.alt || `Image ${index + 1}`}</strong><small>{item.source === 'asset' ? 'จากผลงานเดิม' : item.source === 'upload' ? 'อัปโหลดใน session' : 'URL image'}</small></span><button type="button" onClick={() => removeItem(index)} aria-label={`ลบภาพที่ ${index + 1}`}><Trash2 aria-hidden="true" /></button></div>)}{!(draftConfig.galleryItems || []).length && <p className="csp-gallery-empty">ยังไม่มีภาพ เลือกจากผลงานหรืออัปโหลดภาพใหม่</p>}</div>
            <label className="csp-gallery-field"><span>Default Caption <small>คำบรรยายใต้ภาพ</small></span><input maxLength={140} value={draftConfig.galleryCaption || ''} onChange={event => set({ galleryCaption: event.target.value })} /></label>
            {presentation.type === 'gif' && <div className="csp-gallery-gif-config"><label className="csp-gallery-field"><span>GIF URL</span><input value={draftConfig.galleryGifUrl || ''} onChange={event => set({ galleryGifUrl: event.target.value })} placeholder="https://.../source.gif" />{errors.galleryGifUrl && <em role="alert">{errors.galleryGifUrl}</em>}</label><div className="csp-gallery-check-row"><label><input type="checkbox" checked={draftConfig.galleryAutoplay !== false} onChange={event => set({ galleryAutoplay: event.target.checked })} /> Autoplay</label><label><input type="checkbox" checked={draftConfig.galleryLoop !== false} onChange={event => set({ galleryLoop: event.target.checked })} /> Loop</label><label><input type="checkbox" checked={Boolean(draftConfig.galleryPauseOnHover)} onChange={event => set({ galleryPauseOnHover: event.target.checked })} /> Pause hover</label></div></div>}
            {errors.galleryItems && presentation.type !== 'gif' && <p className="csp-gallery-error" role="alert">{errors.galleryItems}</p>}
          </section>
          <section className="csp-gallery-editor-column csp-gallery-editor-style" aria-label="การจัดวางและสไตล์">
            <div className="csp-gallery-section-title"><Palette aria-hidden="true" />02 การจัดวาง &amp; สไตล์ <small>APPEARANCE</small></div>
            <div className="csp-gallery-locked-theme"><span />ธีมที่ใช้งาน: <strong>弥散渐变 Romantic Mist</strong><b>FIXED</b></div>
            {presentation.type === 'template' && <div className="csp-gallery-field"><span>Template สำเร็จรูปยอดนิยม</span><div className="csp-gallery-template-grid">{GALLERY_TEMPLATES.map(template => <button type="button" key={template} className={presentation.template === template ? 'is-selected' : ''} onClick={() => set({ galleryTemplate: template })} aria-pressed={presentation.template === template}><span>{template === 'minimal' ? '[ A B ]' : template === 'magazine' ? '[ A/B/C ]' : template === 'polaroid' ? 'POL' : template === 'film-strip' ? '▣ —' : '▦ ABC'}</span><strong>{templateLabels[template]}</strong></button>)}</div></div>}
            {presentation.type === 'collage' && <div className="csp-gallery-field"><span>Collage Layout Presets <small>ผังภาพรวม</small></span><div className="csp-gallery-layout-grid">{GALLERY_COLLAGE_LAYOUTS.map(layout => <button type="button" key={layout} className={presentation.collageLayout === layout ? 'is-selected' : ''} onClick={() => set({ galleryCollageLayout: layout })} aria-pressed={presentation.collageLayout === layout}><strong>{layout === 'two' ? '2 รูปภาพ' : layout === 'three' ? '3 รูปภาพ ★' : '4 รูปภาพ'}</strong><span>{layout === 'two' ? '▥ ▥' : layout === 'three' ? '▦ ▤' : '▦ ▦'}</span></button>)}</div></div>}
            <div className="csp-gallery-control-grid"><label className="csp-gallery-field"><span>Widget Gap <b>{presentation.gap}px</b></span><div className="csp-gallery-segmented">{GALLERY_GAPS.map(gap => <button type="button" key={gap} className={presentation.gap === gap ? 'is-selected' : ''} onClick={() => set({ galleryGap: gap })}>{gap}</button>)}</div></label><label className="csp-gallery-field"><span>Image Fit</span><div className="csp-gallery-segmented">{GALLERY_IMAGE_FITS.map(fit => <button type="button" key={fit} className={presentation.imageFit === fit ? 'is-selected' : ''} onClick={() => set({ galleryImageFit: fit })}>{fitLabels[fit]}</button>)}</div></label></div>
            <div className="csp-gallery-range-card"><label>Outer Corner Radius <b>{presentation.outerRadius}px</b><input type="range" min="8" max="32" step="1" value={presentation.outerRadius} onChange={event => set({ galleryOuterRadius: Number(event.target.value) })} /></label><label>Inner Elements Radius <b>{presentation.innerRadius}px</b><input type="range" min="0" max="24" step="1" value={presentation.innerRadius} onChange={event => set({ galleryInnerRadius: Number(event.target.value) })} /></label></div>
            {(presentation.type === 'single' || presentation.type === 'collage' || presentation.type === 'template') && <div className="csp-gallery-focus-card"><div><strong>Focus Point Calibration</strong><small>ปรับจุดสนใจของภาพ</small></div><div className="csp-gallery-focus-grid">{GALLERY_FOCUS_POINTS.map(point => <button type="button" key={point} className={presentation.focusPoint === point ? 'is-selected' : ''} onClick={() => set({ galleryFocusPoint: point })} aria-label={`จุดโฟกัส ${point}`} />)}</div></div>}
            <fieldset className="csp-gallery-options"><legend>ข้อมูลที่แสดงบนการ์ด</legend><label><input type="checkbox" checked={draftConfig.galleryShowCaption !== false} onChange={event => set({ galleryShowCaption: event.target.checked })} /> Show caption</label><label><input type="checkbox" checked={draftConfig.galleryShowCounter !== false} onChange={event => set({ galleryShowCounter: event.target.checked })} /> Show image counter</label><label><input type="checkbox" checked={Boolean(draftConfig.galleryShowSourceLabel)} onChange={event => set({ galleryShowSourceLabel: event.target.checked })} /> Show source label</label></fieldset>
            {errors.galleryLayout && <p className="csp-gallery-error" role="alert">{errors.galleryLayout}</p>}
          </section>
          <aside className="csp-gallery-editor-column csp-gallery-editor-preview" aria-label="Notion Live Preview"><div className="csp-gallery-preview-heading"><span><i />03 Notion Live Preview</span><b>Live Sync</b></div><div className="csp-gallery-preview-frame"><div className="csp-gallery-preview-topbar"><span>● ● ●</span><small>notion.so/workspace/gallery</small><em>12-COL GRID</em></div><div className="csp-gallery-preview-page"><h3>✨ Personal Atelier &amp; Moodboard</h3><p>Updated just now · Romantic Mist</p><div className="csp-gallery-preview-widget"><CreatorWidgetRenderer type="gallery" config={draftConfig} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={true} /></div></div></div><div className="csp-gallery-preview-tip"><Eye aria-hidden="true" /><span>เปลี่ยน type, preset, gap หรือภาพแล้วดูผลบนการ์ดทันที</span></div></aside>
        </div>
        <footer className="csp-gallery-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestCancel}>ยกเลิก</button><button type="submit" disabled={!canSave}>✓ บันทึกการแก้ไข</button></div></footer>
      </form>
      {showDiscardPrompt && <div className="csp-gallery-discard-dialog" role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งการเปลี่ยนแปลง"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Gallery ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setShowDiscardPrompt(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
