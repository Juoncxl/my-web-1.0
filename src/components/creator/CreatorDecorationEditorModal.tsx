import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, Cloud, Flower2, Frame, Heart, ImagePlus, Orbit, Ribbon, Sparkles, UploadCloud, WandSparkles, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DECORATION_ALIGNS, DECORATION_ANIMATIONS, DECORATION_ANIMATION_SPEEDS, DECORATION_DENSITIES, DECORATION_DIVIDER_STYLES, DECORATION_DIVIDER_THICKNESSES, DECORATION_DIVIDER_WIDTHS, DECORATION_PATTERNS, DECORATION_STICKER_ICONS, DECORATION_TEXT_SIZES, DECORATION_TEXT_STYLES, DECORATION_TYPES,
  DEFAULT_DECORATION_DISPLAY_NAME, DEFAULT_DECORATION_DIVIDER_TEXT, DEFAULT_DECORATION_TEXT,
  getDecorationPresentation, validateDecorationConfig, type CreatorWidgetConfig, type DecorationAlign, type DecorationAnimation, type DecorationAnimationSpeed, type DecorationDensity, type DecorationDividerStyle, type DecorationDividerThickness, type DecorationDividerWidth, type DecorationPattern, type DecorationStickerIcon, type DecorationTextSize, type DecorationTextStyle, type DecorationType
} from './creatorWidgetModel';

interface CreatorDecorationEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const iconLabels: Record<DecorationStickerIcon, string> = { sparkles: 'Sparkles', heart: 'Heart', flower: 'Flower', cloud: 'Cloud', bow: 'Bow', frame: 'Frame', orbit: 'Orbit' };
const stickerIcons: Record<DecorationStickerIcon, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = { sparkles: Sparkles, heart: Heart, flower: Flower2, cloud: Cloud, bow: Ribbon, frame: Frame, orbit: Orbit };
const typeLabels: Record<DecorationType, string> = { sticker: 'Sticker', text: 'Text', pattern: 'Pattern', divider: 'Divider', animated: 'Animated' };
const alignIcons: Record<DecorationAlign, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = { left: AlignLeft, center: AlignCenter, right: AlignRight };
const animationIcons: Record<DecorationAnimation, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = { drift: Orbit, pulse: Sparkles, sparkle: WandSparkles, 'falling-stars': Sparkles };

function createDraft(config: CreatorWidgetConfig, displayName?: string) {
  const decoration = getDecorationPresentation(config, displayName);
  return {
    displayName: decoration.displayName,
    config: {
      ...config,
      decorationType: decoration.type,
      decorationStickerIcon: decoration.stickerIcon,
      decorationStickerUrl: decoration.stickerUrl || undefined,
      decorationSize: decoration.size,
      decorationRotation: decoration.rotation,
      decorationAlign: decoration.align,
      decorationOpacity: decoration.opacity,
      decorationText: decoration.text,
      decorationTextStyle: decoration.textStyle,
      decorationTextSize: decoration.textSize,
      decorationPattern: decoration.pattern,
      decorationDensity: decoration.density,
      decorationScale: decoration.scale,
      decorationDividerStyle: decoration.dividerStyle,
      decorationDividerText: decoration.dividerText,
      decorationDividerWidth: decoration.dividerWidth,
      decorationDividerThickness: decoration.dividerThickness,
      decorationAnimation: decoration.animation,
      decorationAnimationSpeed: decoration.animationSpeed,
      decorationLoop: decoration.loop,
      decorationPauseOnHover: decoration.pauseOnHover
    } as CreatorWidgetConfig
  };
}

export const CreatorDecorationEditorModal: React.FC<CreatorDecorationEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, onSave, onCancel }) => {
  const initial = useRef(createDraft(config, displayName));
  const [draftTitle, setDraftTitle] = useState(initial.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initial.current.config);
  const [uploadError, setUploadError] = useState('');
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const initialSerialized = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: draftTitle, config: draftConfig }) !== initialSerialized.current;
  const presentation = useMemo(() => getDecorationPresentation(draftConfig, draftTitle), [draftConfig, draftTitle]);
  const errors = useMemo(() => validateDecorationConfig({ ...draftConfig, title: draftTitle }, draftTitle), [draftConfig, draftTitle]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (showDiscardPrompt) setShowDiscardPrompt(false); else if (dirty) setShowDiscardPrompt(true); else onCancel(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); release(); opener?.focus(); };
  }, [dirty, onCancel, showDiscardPrompt]);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraftConfig(previous => ({ ...previous, ...patch }));
  const requestCancel = () => dirty ? setShowDiscardPrompt(true) : onCancel();
  const selectType = (type: DecorationType) => set({ decorationType: type });
  const updateUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError('');
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) { setUploadError('รองรับเฉพาะ PNG, JPG, WebP และ GIF'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError('ไฟล์ต้องมีขนาดไม่เกิน 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') set({ decorationStickerUrl: reader.result }); };
    reader.readAsDataURL(file);
  };

  return <div className="csp-decoration-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-decoration-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-decoration-editor-title" aria-describedby="csp-decoration-editor-description">
      <header className="csp-decoration-editor-header">
        <div className="csp-decoration-editor-mark"><Sparkles aria-hidden="true" /></div>
        <div className="csp-decoration-editor-title"><div><h2 id="csp-decoration-editor-title">แก้ไข Decoration</h2><span>Bioluminescent Abyss</span></div><p id="csp-decoration-editor-description">เพิ่มบรรยากาศและจังหวะให้หน้าโปรไฟล์ โดยคงพื้นหลังของโปรไฟล์ไว้</p></div>
        <div className="csp-decoration-editor-notice">● บันทึกไว้ในเบราว์เซอร์เครื่องนี้ · ยังไม่ซิงก์กับฐานข้อมูล</div>
        <button type="button" className="csp-decoration-editor-close" onClick={requestCancel} aria-label="ปิด Decoration editor"><X aria-hidden="true" /></button>
      </header>
      <form className="csp-decoration-editor-form" onSubmit={event => { event.preventDefault(); if (canSave) onSave(draftConfig, draftTitle.trim() || DEFAULT_DECORATION_DISPLAY_NAME); }}>
        <div className="csp-decoration-editor-body">
          <section className="csp-decoration-editor-controls" aria-label="ตั้งค่า Decoration">
            <div className="csp-decoration-editor-section"><span>01 · CONTENT &amp; TYPE</span><small>กำหนดบทบาทของการตกแต่ง</small></div>
            <label className="csp-decoration-field"><b>ชื่อแสดง Widget</b><input ref={titleInputRef} maxLength={48} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />{errors.displayName && <em role="alert">{errors.displayName}</em>}</label>
            <div className="csp-decoration-field"><b>ประเภท Decoration</b><div className="csp-decoration-type-picker">{DECORATION_TYPES.map(type => <button key={type} type="button" className={presentation.type === type ? 'is-selected' : ''} onClick={() => selectType(type)} aria-pressed={presentation.type === type}>{typeLabels[type]}</button>)}</div></div>
            {presentation.type === 'sticker' && <>
              <div className="csp-decoration-detail-title">Sticker controls <small>SPEC #01</small></div>
              <div className="csp-decoration-icon-picker">{DECORATION_STICKER_ICONS.map(icon => { const Icon = stickerIcons[icon]; return <button type="button" key={icon} className={presentation.stickerIcon === icon ? 'is-selected' : ''} onClick={() => set({ decorationStickerIcon: icon })} aria-label={`เลือก ${iconLabels[icon]}`}><Icon aria-hidden={true} /></button>; })}</div>
              <label className="csp-decoration-upload"><UploadCloud aria-hidden="true" /><span><b>อัปโหลด Sticker</b><small>PNG, JPG, WebP หรือ GIF · ไม่เกิน 2MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => updateUpload(event.target.files)} /></label>
              {presentation.stickerUrl && <button type="button" className="csp-decoration-clear-upload" onClick={() => set({ decorationStickerUrl: undefined })}><ImagePlus aria-hidden="true" />ล้างไฟล์ที่เลือก</button>}
              {uploadError && <p className="csp-decoration-error" role="alert">{uploadError}</p>}{errors.decorationStickerUrl && <p className="csp-decoration-error" role="alert">{errors.decorationStickerUrl}</p>}
              <div className="csp-decoration-range-grid"><label>ขนาด <b>{presentation.size}px</b><input type="range" min="32" max="120" value={presentation.size} onChange={event => set({ decorationSize: Number(event.target.value) })} /></label><label>หมุน <b>{presentation.rotation}°</b><input type="range" min="-30" max="30" value={presentation.rotation} onChange={event => set({ decorationRotation: Number(event.target.value) })} /></label><label>Opacity <b>{presentation.opacity}%</b><input type="range" min="20" max="100" value={presentation.opacity} onChange={event => set({ decorationOpacity: Number(event.target.value) })} /></label></div>
              <div className="csp-decoration-field"><b>ตำแหน่ง</b><div className="csp-decoration-segmented">{DECORATION_ALIGNS.map(align => { const Icon = alignIcons[align]; return <button type="button" key={align} className={presentation.align === align ? 'is-selected' : ''} onClick={() => set({ decorationAlign: align })}><Icon aria-hidden={true} />{align}</button>; })}</div></div>
            </>}
            {presentation.type === 'text' && <>
              <div className="csp-decoration-detail-title">Poetic text <small>TYPE #02</small></div>
              <label className="csp-decoration-field"><b>ข้อความ</b><textarea maxLength={140} rows={3} value={draftConfig.decorationText || ''} onChange={event => set({ decorationText: event.target.value })} placeholder={DEFAULT_DECORATION_TEXT} />{errors.decorationText && <em role="alert">{errors.decorationText}</em>}</label>
              <div className="csp-decoration-control-grid"><label className="csp-decoration-field"><b>Treatment</b><select value={presentation.textStyle} onChange={event => set({ decorationTextStyle: event.target.value as DecorationTextStyle })}>{DECORATION_TEXT_STYLES.map(style => <option key={style} value={style}>{style}</option>)}</select></label><label className="csp-decoration-field"><b>Text size</b><select value={presentation.textSize} onChange={event => set({ decorationTextSize: event.target.value as DecorationTextSize })}>{DECORATION_TEXT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
              <div className="csp-decoration-field"><b>ตำแหน่ง</b><div className="csp-decoration-segmented">{DECORATION_ALIGNS.map(align => { const Icon = alignIcons[align]; return <button type="button" key={align} className={presentation.align === align ? 'is-selected' : ''} onClick={() => set({ decorationAlign: align })}><Icon aria-hidden={true} />{align}</button>; })}</div></div>
            </>}
            {presentation.type === 'pattern' && <>
              <div className="csp-decoration-detail-title">Bioluminescent pattern <small>TYPE #03</small></div>
              <div className="csp-decoration-option-grid">{DECORATION_PATTERNS.map(pattern => <button type="button" key={pattern} className={presentation.pattern === pattern ? 'is-selected' : ''} onClick={() => set({ decorationPattern: pattern })}>{pattern}</button>)}</div>
              <div className="csp-decoration-control-grid"><label className="csp-decoration-field"><b>Density</b><select value={presentation.density} onChange={event => set({ decorationDensity: event.target.value as DecorationDensity })}>{DECORATION_DENSITIES.map(density => <option key={density} value={density}>{density}</option>)}</select></label><label className="csp-decoration-field"><b>Scale <small>{presentation.scale}%</small></b><input type="range" min="60" max="160" value={presentation.scale} onChange={event => set({ decorationScale: Number(event.target.value) })} /></label></div>
            </>}
            {presentation.type === 'divider' && <>
              <div className="csp-decoration-detail-title">Subsea divider <small>TYPE #04</small></div>
              <div className="csp-decoration-option-grid">{DECORATION_DIVIDER_STYLES.map(style => <button type="button" key={style} className={presentation.dividerStyle === style ? 'is-selected' : ''} onClick={() => set({ decorationDividerStyle: style })}>{style}</button>)}</div>
              <label className="csp-decoration-field"><b>ข้อความตรงกลาง</b><input maxLength={80} value={draftConfig.decorationDividerText || ''} onChange={event => set({ decorationDividerText: event.target.value })} placeholder={DEFAULT_DECORATION_DIVIDER_TEXT} /></label>
              <div className="csp-decoration-control-grid"><label className="csp-decoration-field"><b>ความกว้าง</b><select value={presentation.dividerWidth} onChange={event => set({ decorationDividerWidth: Number(event.target.value) as DecorationDividerWidth })}>{DECORATION_DIVIDER_WIDTHS.map(width => <option key={width} value={width}>{width}%</option>)}</select></label><label className="csp-decoration-field"><b>ความหนา</b><select value={presentation.dividerThickness} onChange={event => set({ decorationDividerThickness: event.target.value as DecorationDividerThickness })}>{DECORATION_DIVIDER_THICKNESSES.map(thickness => <option key={thickness} value={thickness}>{thickness}</option>)}</select></label></div>
            </>}
            {presentation.type === 'animated' && <>
              <div className="csp-decoration-detail-title">Ethereal ambient loop <small>TYPE #05</small></div>
              <div className="csp-decoration-animation-grid">{DECORATION_ANIMATIONS.map(animation => { const Icon = animationIcons[animation]; return <button type="button" key={animation} className={presentation.animation === animation ? 'is-selected' : ''} onClick={() => set({ decorationAnimation: animation })}><Icon aria-hidden={true} /><span>{animation}</span></button>; })}</div>
              <label className="csp-decoration-field"><b>ความเร็ว</b><div className="csp-decoration-segmented">{DECORATION_ANIMATION_SPEEDS.map(speed => <button type="button" key={speed} className={presentation.animationSpeed === speed ? 'is-selected' : ''} onClick={() => set({ decorationAnimationSpeed: speed as DecorationAnimationSpeed })}>{speed}</button>)}</div></label>
              <div className="csp-decoration-check-row"><label><input type="checkbox" checked={presentation.loop} onChange={event => set({ decorationLoop: event.target.checked })} />เล่นวนซ้ำ</label><label><input type="checkbox" checked={presentation.pauseOnHover} onChange={event => set({ decorationPauseOnHover: event.target.checked })} />หยุดเมื่อ hover</label></div>
            </>}
          </section>
          <aside className="csp-decoration-editor-preview" aria-label="Notion live preview">
            <div className="csp-decoration-preview-heading"><span><Cloud aria-hidden="true" />Workspace Preview / Notion 12-Column Grid</span><b>Live Interactive</b></div>
            <div className="csp-decoration-preview-frame"><div className="csp-decoration-preview-topbar"><span>✦ Sanctuary 2025</span><small>Col Width: 12 cols</small></div><div className="csp-decoration-preview-canvas"><div className="csp-decoration-preview-labels"><span>c1</span><span>c2</span><span>c3</span><span>c4</span><span>c5</span><span>c6</span></div><div className="csp-decoration-preview-widget"><CreatorWidgetRenderer type="decoration" config={draftConfig} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div></div><div className="csp-decoration-preview-footer"><span>TYPE: {presentation.type.toUpperCase()} · ABYSSAL</span><span>DEPTH 3,800m</span></div></div>
            <div className="csp-decoration-preview-tip"><Sparkles aria-hidden="true" /><span>พื้นหลังของ Decoration โปร่งใสเสมอ — Deep Ocean ทำหน้าที่เป็น glow และ accent เท่านั้น</span></div>
          </aside>
        </div>
        <footer className="csp-decoration-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestCancel}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check aria-hidden="true" />บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {showDiscardPrompt && <div className="csp-decoration-discard-dialog" role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งการเปลี่ยนแปลง"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Decoration ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setShowDiscardPrompt(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
