import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Globe2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  CLOCK_DATE_FORMATS, CLOCK_DIAL_MARKERS, CLOCK_FLIP_ANIMATIONS, CLOCK_HAND_STYLES, CLOCK_MODES, CLOCK_STYLES, CLOCK_TEXT_ALIGNS, CLOCK_TIME_FORMATS, CLOCK_TIME_SIZES, CLOCK_TIMEZONE_MODES,
  DEFAULT_CLOCK_CITIES, DEFAULT_CLOCK_DISPLAY_NAME, DEFAULT_CLOCK_GREETINGS, DEFAULT_CLOCK_TIMEZONE,
  getClockPresentation, isValidClockTimeZone, normalizeClockCity, validateClockConfig,
  type ClockCity, type ClockDateFormat, type ClockDialMarker, type ClockFlipAnimation, type ClockHandStyle, type ClockMode, type ClockStyle, type ClockTextAlign, type ClockTimeFormat, type ClockTimeSize, type ClockTimeZoneMode, type CreatorWidgetConfig
} from './creatorWidgetModel';

interface CreatorClockEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

const styleLabels: Record<ClockStyle, string> = { digital: 'Minimal Digital', analog: 'Analog', flip: 'Retro Flip', cute: 'Cute / Aura', world: 'World Clock Duo' };
const modeLabels: Record<ClockMode, string> = { local: '🏠 Local Clock', world: '🌏 World Clock' };
const dateLabels: Record<ClockDateFormat, string> = { 'weekday-date': 'วันและวันที่', long: 'วันที่แบบเต็ม', short: 'วันที่แบบสั้น', hidden: 'ซ่อนวันที่' };
const formatLabels: Record<ClockTimeFormat, string> = { '12h': '12 Hours (AM/PM)', '24h': '24 Hours' };
const timeSizeLabels: Record<ClockTimeSize, string> = { small: 'เล็ก', medium: 'กลาง', large: 'ใหญ่' };

function createDraft(config: CreatorWidgetConfig, displayName?: string) {
  const clock = getClockPresentation(config, displayName);
  const cities = (Array.isArray(config.clockCities) && config.clockCities.length ? config.clockCities : DEFAULT_CLOCK_CITIES).map(normalizeClockCity).slice(0, 4);
  return {
    displayName: clock.displayName,
    config: {
      ...config,
      clockMode: clock.mode,
      clockStyle: clock.style,
      clockTimeZoneMode: clock.timeZoneMode,
      clockTimeZone: config.clockTimeZone || DEFAULT_CLOCK_TIMEZONE,
      clockCities: cities,
      clockTimeFormat: clock.timeFormat,
      clockDateFormat: clock.dateFormat,
      clockShowTime: clock.showTime,
      clockShowSeconds: clock.showSeconds,
      clockShowDate: clock.showDate,
      clockShowCity: clock.showCity,
      clockShowTimeZone: clock.showTimeZone,
      clockShowGreeting: clock.showGreeting,
      clockGreetings: { ...DEFAULT_CLOCK_GREETINGS, ...clock.greetings },
      clockTextAlign: clock.textAlign,
      clockTimeSize: clock.timeSize,
      clockDialMarker: clock.dialMarker,
      clockHandStyle: clock.handStyle,
      clockFlipAnimation: clock.flipAnimation,
      clockFlipSound: clock.flipSound
    } as CreatorWidgetConfig
  };
}

export const CreatorClockEditorModal: React.FC<CreatorClockEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, onSave, onCancel }) => {
  const initial = useRef(createDraft(config, displayName));
  const [draftTitle, setDraftTitle] = useState(initial.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initial.current.config);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const initialSerialized = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: draftTitle, config: draftConfig }) !== initialSerialized.current;
  const presentation = useMemo(() => getClockPresentation({ ...draftConfig, title: draftTitle }, draftTitle), [draftConfig, draftTitle]);
  const errors = useMemo(() => validateClockConfig({ ...draftConfig, title: draftTitle }), [draftConfig, draftTitle]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (showDiscardPrompt) setShowDiscardPrompt(false); else if (dirty) setShowDiscardPrompt(true); else onCancel(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
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
  const updateCity = (index: number, patch: Partial<ClockCity>) => set({ clockCities: (draftConfig.clockCities || []).map((city, cityIndex) => cityIndex === index ? { ...city, ...patch } : city) });
  const addCity = () => { if ((draftConfig.clockCities || []).length >= 4) return; set({ clockCities: [...(draftConfig.clockCities || []), { id: `city-${Date.now()}`, name: 'New City', timeZone: DEFAULT_CLOCK_TIMEZONE }] }); };
  const removeCity = (index: number) => set({ clockCities: (draftConfig.clockCities || []).filter((_, cityIndex) => cityIndex !== index) });
  const setGreeting = (key: keyof typeof DEFAULT_CLOCK_GREETINGS, value: string) => set({ clockGreetings: { ...DEFAULT_CLOCK_GREETINGS, ...(draftConfig.clockGreetings || {}), [key]: value } });
  const toggle = (key: keyof CreatorWidgetConfig) => set({ [key]: !Boolean(draftConfig[key]) });

  return <div className="csp-clock-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-clock-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-clock-editor-title" aria-describedby="csp-clock-editor-description">
      <div className="csp-clock-editor-ribbon"><span><i />การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</span><small>Dreamy Pastel / Aura Warm</small></div>
      <header className="csp-clock-editor-header">
        <div className="csp-clock-editor-mark"><Clock3 aria-hidden="true" /></div>
        <div className="csp-clock-editor-title"><div><h2 id="csp-clock-editor-title">แก้ไขนาฬิกา (Interactive Clock Lab)</h2><span>Dreamy Pastel · Studio v2</span></div><p id="csp-clock-editor-description">ปรับรูปแบบเวลา โซนเวลา และข้อความต้อนรับให้เข้ากับ Notion Workspace ของคุณ</p></div>
        <button type="button" className="csp-clock-editor-close" onClick={requestCancel} aria-label="ปิด Clock editor"><X aria-hidden="true" /></button>
      </header>
      <form className="csp-clock-editor-form" onSubmit={event => { event.preventDefault(); if (canSave) onSave({ ...draftConfig, title: draftTitle.trim() || DEFAULT_CLOCK_DISPLAY_NAME }, draftTitle.trim() || DEFAULT_CLOCK_DISPLAY_NAME); }}>
        <div className="csp-clock-editor-body">
          <section className="csp-clock-editor-column csp-clock-editor-content" aria-label="รูปแบบและโซนเวลา">
            <div className="csp-clock-editor-section-heading"><span>01 · รูปแบบ &amp; โซนเวลา</span><small>เลือกข้อมูลหลักของ Clock</small></div>
            <label className="csp-clock-field"><span>Display Name (ชื่อวิดเจ็ต)</span><input ref={titleInputRef} maxLength={48} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />{errors.displayName && <em role="alert">{errors.displayName}</em>}</label>
            <div className="csp-clock-field"><span>Clock Mode (โหมดการทำงาน)</span><div className="csp-clock-segmented">{CLOCK_MODES.map(mode => <button type="button" key={mode} className={presentation.mode === mode ? 'is-selected' : ''} onClick={() => set({ clockMode: mode })}>{modeLabels[mode]}</button>)}</div></div>
            <div className="csp-clock-field"><span>Timezone Detection</span><div className="csp-clock-segmented">{CLOCK_TIMEZONE_MODES.map(mode => <button type="button" key={mode} className={presentation.timeZoneMode === mode ? 'is-selected' : ''} onClick={() => set({ clockTimeZoneMode: mode })}>{mode === 'auto' ? 'Auto Device' : 'Custom'}</button>)}</div></div>
            {presentation.timeZoneMode === 'custom' && <label className="csp-clock-field"><span>Custom timezone</span><input value={draftConfig.clockTimeZone || ''} onChange={event => set({ clockTimeZone: event.target.value })} placeholder="Asia/Bangkok" />{errors.clockTimeZone && <em role="alert">{errors.clockTimeZone}</em>}</label>}
            <div className="csp-clock-field"><span>เมืองใน World Clock <small>{(draftConfig.clockCities || []).length}/4</small></span><div className="csp-clock-city-editor">{(draftConfig.clockCities || []).map((city, index) => <div className="csp-clock-city-row" key={city.id || index}><MapPin aria-hidden="true" /><input aria-label={`ชื่อเมือง ${index + 1}`} value={city.name} onChange={event => updateCity(index, { name: event.target.value })} /><input aria-label={`Timezone ${index + 1}`} value={city.timeZone} onChange={event => updateCity(index, { timeZone: event.target.value })} /><button type="button" onClick={() => removeCity(index)} aria-label={`ลบ ${city.name}`}><Trash2 aria-hidden="true" /></button>{!isValidClockTimeZone(city.timeZone) && <em role="alert">timezone ไม่ถูกต้อง</em>}</div>)}<button type="button" className="csp-clock-add-city" onClick={addCity} disabled={(draftConfig.clockCities || []).length >= 4}><Plus aria-hidden="true" />เพิ่มเมือง</button></div></div>
            <div className="csp-clock-field"><span>Time Format</span><div className="csp-clock-segmented">{CLOCK_TIME_FORMATS.map(format => <button type="button" key={format} className={presentation.timeFormat === format ? 'is-selected' : ''} onClick={() => set({ clockTimeFormat: format })}>{formatLabels[format]}</button>)}</div></div>
            <label className="csp-clock-field"><span>Date Format</span><div className="csp-clock-select-wrap"><select value={presentation.dateFormat} onChange={event => set({ clockDateFormat: event.target.value as ClockDateFormat })}>{CLOCK_DATE_FORMATS.map(format => <option key={format} value={format}>{dateLabels[format]}</option>)}</select><ChevronDown aria-hidden="true" /></div></label>
          </section>
          <section className="csp-clock-editor-column csp-clock-editor-display" aria-label="การแสดงผลและ greeting">
            <div className="csp-clock-editor-section-heading"><span>02 · ปรับแต่งการแสดงผล &amp; กรีตติ้ง</span><small>Live controls</small></div>
            <div className="csp-clock-style-grid">{CLOCK_STYLES.map(style => <button type="button" key={style} className={presentation.style === style ? 'is-selected' : ''} onClick={() => set({ clockStyle: style })}><strong>{styleLabels[style]}</strong><small>{style === 'digital' ? 'ตัวเลขอ่านง่าย' : style === 'analog' ? 'หน้าปัดวงกลม' : style === 'flip' ? 'Retro split flap' : style === 'cute' ? 'Aura greeting' : 'หลาย timezone'}</small></button>)}</div>
            <fieldset className="csp-clock-options"><legend>Display Options</legend>{[['clockShowTime','เวลา (Time)'], ['clockShowDate','วันที่ (Date)'], ['clockShowSeconds','วินาที (Seconds)'], ['clockShowCity','ชื่อเมือง (City)'], ['clockShowTimeZone','Timezone Tag'], ['clockShowGreeting','Sweet Greeting']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draftConfig[key as keyof CreatorWidgetConfig] ?? true)} onChange={() => toggle(key as keyof CreatorWidgetConfig)} />{label}</label>)}</fieldset>
            <div className="csp-clock-greeting-editor"><div className="csp-clock-detail-heading"><span>💬 Dynamic Greeting Editor</span><small>เปลี่ยนตามเวลาจริง</small></div>{(['morning', 'afternoon', 'evening', 'night'] as const).map(key => <label key={key}><span>{key === 'morning' ? '🌅 เช้า' : key === 'afternoon' ? '☀️ บ่าย' : key === 'evening' ? '🌇 เย็น' : '🌙 ดึก'}</span><input value={draftConfig.clockGreetings?.[key] || ''} onChange={event => setGreeting(key, event.target.value)} /></label>)}</div>
            <div className="csp-clock-control-grid"><div className="csp-clock-field"><span>Alignment</span><div className="csp-clock-segmented">{CLOCK_TEXT_ALIGNS.map(value => <button type="button" key={value} className={presentation.textAlign === value ? 'is-selected' : ''} onClick={() => set({ clockTextAlign: value as ClockTextAlign })}>{value}</button>)}</div></div><div className="csp-clock-field"><span>Time Size</span><div className="csp-clock-segmented">{CLOCK_TIME_SIZES.map(value => <button type="button" key={value} className={presentation.timeSize === value ? 'is-selected' : ''} onClick={() => set({ clockTimeSize: value as ClockTimeSize })}>{timeSizeLabels[value]}</button>)}</div></div></div>
            {presentation.style === 'analog' && <div className="csp-clock-micro-controls"><strong>Analog Dial Controls</strong><label>Face Dial Marker<select value={presentation.dialMarker} onChange={event => set({ clockDialMarker: event.target.value as ClockDialMarker })}>{CLOCK_DIAL_MARKERS.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Hands Shape<select value={presentation.handStyle} onChange={event => set({ clockHandStyle: event.target.value as ClockHandStyle })}>{CLOCK_HAND_STYLES.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>}
            {presentation.style === 'flip' && <div className="csp-clock-micro-controls"><strong>Retro Flip Controls</strong><label>Flip Animation<select value={presentation.flipAnimation} onChange={event => set({ clockFlipAnimation: event.target.value as ClockFlipAnimation })}>{CLOCK_FLIP_ANIMATIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><input type="checkbox" checked={presentation.flipSound} onChange={() => toggle('clockFlipSound')} />Flip sound FX</label></div>}
            <div className="csp-clock-locked-style"><Globe2 aria-hidden="true" /><span><strong>Dreamy Pastel / Aura Warm</strong><small>Visual system locked ให้เหมือนการ์ดจริง</small></span></div>
          </section>
          <aside className="csp-clock-editor-column csp-clock-editor-preview" aria-label="Notion live preview">
            <div className="csp-clock-preview-heading"><span><Clock3 aria-hidden="true" />Notion Live Preview</span><b>Realtime Sync</b></div>
            <div className="csp-clock-preview-frame"><div className="csp-clock-preview-topbar"><span>✦ study space 2024 / dashboard</span><small>12-Column Grid</small></div><div className="csp-clock-preview-canvas"><div className="csp-clock-preview-widget"><CreatorWidgetRenderer type="clock" config={{ ...draftConfig, title: draftTitle }} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div><div className="csp-clock-preview-neighbors"><span><Check aria-hidden="true" />TODO TODAY</span><span><Clock3 aria-hidden="true" />PLAYLIST</span></div></div></div>
            <div className="csp-clock-preview-tip"><Clock3 aria-hidden="true" /><span>เวลาจะอัปเดตทุกวินาทีตาม timezone ที่เลือก และ preview ใช้ renderer เดียวกับหน้าโปรไฟล์</span></div>
          </aside>
        </div>
        <footer className="csp-clock-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestCancel}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check aria-hidden="true" />บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {showDiscardPrompt && <div className="csp-clock-discard-dialog" role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งการเปลี่ยนแปลง"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Clock ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setShowDiscardPrompt(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
