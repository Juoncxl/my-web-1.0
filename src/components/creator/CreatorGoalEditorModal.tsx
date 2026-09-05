import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, CircleDollarSign, ClipboardList, FilePenLine, Plus, Target, Trash2, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DEFAULT_GOAL_DESCRIPTION,
  DEFAULT_GOAL_DISPLAY_NAME,
  DEFAULT_GOAL_TITLE,
  GOAL_ICON_PRESETS,
  GOAL_STYLES,
  GOAL_TYPES,
  getGoalPresentation,
  type CreatorWidgetConfig,
  type GoalStyle,
  type GoalType
} from './creatorWidgetModel';

interface CreatorGoalEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

function createDraft(config: CreatorWidgetConfig, displayName?: string) {
  return {
    displayName: displayName?.trim() || config.title?.trim() || DEFAULT_GOAL_DISPLAY_NAME,
    config: {
      ...config,
      goalType: GOAL_TYPES.includes(config.goalType as GoalType) ? config.goalType : 'number' as GoalType,
      goalStyle: GOAL_STYLES.includes(config.goalStyle as GoalStyle) ? config.goalStyle : 'bar' as GoalStyle,
      goalTitle: config.goalTitle?.trim() || DEFAULT_GOAL_TITLE,
      goalDescription: config.goalDescription?.trim() || config.description?.trim() || DEFAULT_GOAL_DESCRIPTION,
      goalIcon: config.goalIcon?.trim() || '🎯',
      goalCurrent: config.goalCurrent ?? config.goal ?? 0,
      goalTarget: config.goalTarget ?? (config.goalCurrent === undefined && config.goal !== undefined ? 100 : 1),
      goalUnit: config.goalUnit?.trim() || (config.goalCurrent === undefined && config.goal !== undefined ? '%' : 'items'),
      goalItems: config.goalItems || [],
      goalStartDate: config.goalStartDate || '',
      goalDeadline: config.goalDeadline || '',
      showPercent: config.showPercent !== false,
      showFraction: config.showFraction !== false,
      showRemaining: config.showRemaining !== false
    } as CreatorWidgetConfig
  };
}

const GoalTypeIcon: Record<GoalType, React.ElementType> = { number: Target, money: CircleDollarSign, checklist: ClipboardList, date: CalendarDays };

export const CreatorGoalEditorModal: React.FC<CreatorGoalEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 6, previewDisplayName, onSave, onCancel }) => {
  const initialDraft = useRef(createDraft(config, displayName));
  const [draftTitle, setDraftTitle] = useState(initialDraft.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initialDraft.current.config);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [customIcon, setCustomIcon] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  const initialSerialized = useRef(JSON.stringify(initialDraft.current));
  const isDirtyRef = useRef(false);
  const showDiscardRef = useRef(false);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  const isDirty = JSON.stringify({ displayName: draftTitle, config: draftConfig }) !== initialSerialized.current;
  const type = (draftConfig.goalType || 'number') as GoalType;
  const presentation = useMemo(() => getGoalPresentation(draftConfig, draftTitle), [draftConfig, draftTitle]);
  const dateInvalid = type === 'date' && !presentation.validDateRange;
  const targetInvalid = (type === 'number' || type === 'money') && Number(draftConfig.goalTarget) <= 0;
  const canSave = isDirty && !dateInvalid && !targetInvalid;

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { showDiscardRef.current = showDiscardPrompt; }, [showDiscardPrompt]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScroll = acquireViewportScrollLock(document);
    const frame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showDiscardRef.current) setShowDiscardPrompt(false);
        else if (isDirtyRef.current) setShowDiscardPrompt(true);
        else onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); releaseScroll(); opener?.focus(); };
  }, []);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraftConfig(previous => ({ ...previous, ...patch }));
  const requestCancel = () => isDirty ? setShowDiscardPrompt(true) : onCancel();
  const selectType = (nextType: GoalType) => {
    if (nextType !== 'date' || (draftConfig.goalStartDate && draftConfig.goalDeadline)) {
      set({ goalType: nextType });
      return;
    }
    const now = new Date();
    set({ goalType: nextType, goalStartDate: formatDateInput(now), goalDeadline: formatDateInput(addDays(now, 30)) });
  };
  const addChecklistItem = () => set({ goalItems: [...(draftConfig.goalItems || []), { label: '', done: false }] });
  const updateChecklistItem = (index: number, patch: Partial<{ label: string; done: boolean }>) => set({ goalItems: (draftConfig.goalItems || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const removeChecklistItem = (index: number) => set({ goalItems: (draftConfig.goalItems || []).filter((_, itemIndex) => itemIndex !== index) });
  const applyCustomIcon = () => {
    const icon = Array.from(customIcon.trim())[0];
    if (icon) { set({ goalIcon: icon }); setCustomIcon(''); }
  };

  return <div className="csp-goal-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-goal-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-goal-editor-title" aria-describedby="csp-goal-editor-description">
      <header className="csp-goal-editor-header">
        <div className="csp-goal-editor-title-mark"><Target aria-hidden="true" /></div>
        <div><div className="csp-goal-editor-title-line"><h2 id="csp-goal-editor-title">แก้ไข Goal / Progress</h2><span>• Diffused Lilac Mist</span></div><p id="csp-goal-editor-description">ตั้งค่าเป้าหมายและความคืบหน้า พร้อมดูผลบนการ์ดแบบเรียลไทม์</p></div>
        <small className="csp-goal-editor-storage">บันทึกไว้ในเบราว์เซอร์เครื่องนี้ · ยังไม่ซิงก์กับฐานข้อมูล</small>
        <button type="button" className="csp-goal-editor-close" onClick={requestCancel} aria-label="ปิด Goal editor"><X aria-hidden="true" /></button>
      </header>

      <form className="csp-goal-editor-form" onSubmit={event => { event.preventDefault(); if (canSave) onSave(draftConfig, draftTitle.trim() || DEFAULT_GOAL_DISPLAY_NAME); }}>
        <div className="csp-goal-editor-body">
          <section className="csp-goal-editor-column csp-goal-editor-core" aria-label="ข้อมูล Goal">
            <div className="csp-goal-editor-section-title"><Target aria-hidden="true" />ประเภทเป้าหมาย <small>GOAL TYPE</small></div>
            <div className="csp-goal-type-picker">{GOAL_TYPES.map(goalType => { const Icon = GoalTypeIcon[goalType]; const label = goalType === 'number' ? 'Number' : goalType === 'money' ? 'Money' : goalType === 'checklist' ? 'Checklist' : 'Date'; return <button type="button" key={goalType} className={type === goalType ? 'is-selected' : ''} onClick={() => selectType(goalType)} aria-pressed={type === goalType}><Icon aria-hidden="true" /><span>{label}</span></button>; })}</div>

            <label className="csp-goal-editor-field"><span>ชื่อวิดเจ็ต <small>Display Name</small></span><input ref={titleInputRef} maxLength={36} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} /></label>
            <label className="csp-goal-editor-field"><span>หัวข้อเป้าหมาย <small>Goal Title</small></span><div className="csp-goal-title-input"><span aria-hidden="true">{draftConfig.goalIcon || '🎯'}</span><input maxLength={60} value={draftConfig.goalTitle || ''} onChange={event => set({ goalTitle: event.target.value })} /></div></label>
            <div className="csp-goal-icon-picker" aria-label="เลือกไอคอนเป้าหมาย">{GOAL_ICON_PRESETS.map(icon => <button type="button" key={icon} className={draftConfig.goalIcon === icon ? 'is-selected' : ''} onClick={() => set({ goalIcon: icon })} aria-pressed={draftConfig.goalIcon === icon}>{icon}</button>)}<label><span className="sr-only">ใส่อีโมจิอื่น</span><input value={customIcon} onChange={event => setCustomIcon(event.target.value)} onBlur={applyCustomIcon} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyCustomIcon(); } }} placeholder="+" maxLength={4} /></label></div>
            <label className="csp-goal-editor-field"><span>คำอธิบาย <small>Description</small></span><textarea rows={2} maxLength={160} value={draftConfig.goalDescription || ''} onChange={event => set({ goalDescription: event.target.value })} /></label>

            {type === 'checklist' ? <div className="csp-goal-checklist-editor"><div><strong>รายการเช็ก</strong><small>{presentation.current} / {presentation.target} เสร็จแล้ว</small></div>{(draftConfig.goalItems || []).map((item, index) => <div className="csp-goal-checklist-edit-row" key={`goal-item-${index}`}><input type="checkbox" checked={item.done} onChange={event => updateChecklistItem(index, { done: event.target.checked })} aria-label={`ทำรายการ ${index + 1} เสร็จแล้ว`} /><input value={item.label} onChange={event => updateChecklistItem(index, { label: event.target.value })} placeholder={`รายการที่ ${index + 1}`} /><button type="button" onClick={() => removeChecklistItem(index)} aria-label={`ลบรายการที่ ${index + 1}`}><Trash2 aria-hidden="true" /></button></div>)}{(draftConfig.goalItems || []).length === 0 && <p className="csp-goal-checklist-empty">เพิ่มรายการเพื่อเริ่มนับความคืบหน้าอัตโนมัติ</p>}<button type="button" className="csp-goal-add-item" onClick={addChecklistItem}><Plus aria-hidden="true" />เพิ่มรายการ</button></div> : type === 'date' ? <div className="csp-goal-date-fields"><label className="csp-goal-editor-field"><span>วันเริ่มต้น</span><input type="date" value={draftConfig.goalStartDate || ''} onChange={event => set({ goalStartDate: event.target.value })} /></label><label className="csp-goal-editor-field"><span>Deadline</span><input type="date" value={draftConfig.goalDeadline || ''} onChange={event => set({ goalDeadline: event.target.value })} /></label>{dateInvalid && <p role="alert">Deadline ต้องเป็นวันเดียวกับหรือหลังวันเริ่มต้น</p>}</div> : <div className="csp-goal-progress-inputs"><div className="csp-goal-editor-section-title"><ClipboardList aria-hidden="true" />สถิติความคืบหน้า <small>{presentation.percent}%</small></div><div className="csp-goal-numeric-grid"><label className="csp-goal-editor-field"><span>ปัจจุบัน</span><input type="number" min="0" value={draftConfig.goalCurrent ?? 0} onChange={event => set({ goalCurrent: Number(event.target.value) })} /></label><label className="csp-goal-editor-field"><span>เป้าหมาย</span><input type="number" min="1" value={draftConfig.goalTarget ?? 1} onChange={event => set({ goalTarget: Number(event.target.value) })} /></label><label className="csp-goal-editor-field"><span>หน่วย</span><select value={draftConfig.goalUnit || 'items'} onChange={event => set({ goalUnit: event.target.value })}>{(type === 'money' ? ['฿', '$', '€', '¥'] : ['items', 'books', 'pages', 'hours', 'tasks', '%']).map(unit => <option value={unit} key={unit}>{unit}</option>)}</select></label></div>{targetInvalid && <p role="alert">เป้าหมายต้องมากกว่า 0</p>}</div>}

            {type !== 'date' && <label className="csp-goal-deadline-optional"><CalendarDays aria-hidden="true" />Deadline <input type="date" value={draftConfig.goalDeadline || ''} onChange={event => set({ goalDeadline: event.target.value })} /></label>}
          </section>

          <section className="csp-goal-editor-column csp-goal-editor-style" aria-label="รูปแบบการแสดงผล">
            <div className="csp-goal-editor-section-title"><FilePenLine aria-hidden="true" />รูปแบบการแสดงผล <small>PROGRESS STYLE</small></div>
            <div className="csp-goal-style-picker">{GOAL_STYLES.map(style => <button type="button" key={style} className={draftConfig.goalStyle === style ? 'is-selected' : ''} onClick={() => set({ goalStyle: style })} aria-pressed={draftConfig.goalStyle === style}><span className={`csp-goal-style-sample is-${style}`} aria-hidden="true">{style === 'bar' ? <><i /><i /></> : style === 'ring' ? '67%' : style === 'counter' ? '8 / 12' : '★ ★ ★'}</span><strong>{style === 'bar' ? 'Bar แถบสีนุ่ม' : style === 'ring' ? 'Ring วงแหวน' : style === 'counter' ? 'Counter เลขเด่น' : 'Cute โทนอุ่น'}</strong><small>{style === 'bar' ? 'แถบไล่เฉดนุ่มละมุน' : style === 'ring' ? 'วงแหวนแสดงเปอร์เซ็นต์' : style === 'counter' ? 'เน้นตัวเลขความคืบหน้า' : 'จังหวะที่อ่านง่ายและอบอุ่น'}</small></button>)}</div>
            <div className="csp-goal-lilac-summary"><span>✦</span><div><strong>ธีม Diffused Lilac Mist</strong><p>ล็อก palette ให้การ์ด Goal เป็นชุดเดียวกับเรฟ</p></div><em>FIXED</em></div>
            <fieldset className="csp-goal-visibility-options"><legend>ข้อมูลที่แสดงบนการ์ด</legend><label><input type="checkbox" checked={draftConfig.showPercent !== false} onChange={event => set({ showPercent: event.target.checked })} />แสดงเปอร์เซ็นต์</label><label><input type="checkbox" checked={draftConfig.showFraction !== false} onChange={event => set({ showFraction: event.target.checked })} />แสดงตัวเลขความคืบหน้า</label><label><input type="checkbox" checked={draftConfig.showRemaining !== false} onChange={event => set({ showRemaining: event.target.checked })} />แสดงจำนวนที่เหลือ</label></fieldset>
          </section>

          <aside className="csp-goal-editor-column csp-goal-editor-preview" aria-label="พรีวิว Goal Widget">
            <div className="csp-goal-editor-preview-heading"><span>▣ Notion Live OS Preview</span><small>6-Col Wide</small></div>
            <div className="csp-goal-preview-page"><div className="csp-goal-preview-page-header"><span>Life OS · Goal Studio</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div><div className="csp-goal-preview-widget csp-widget is-goal-widget-shell" data-widget-type="goal"><div className="csp-widget-body is-goal-widget-body"><CreatorWidgetRenderer type="goal" config={draftConfig} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div></div></div>
            <div className="csp-goal-editor-preview-note"><strong>Live preview</strong><p>ตัวเลข, รายการเช็ก และวันกำหนดส่งจะสะท้อนผลบนการ์ดทันที</p></div>
          </aside>
        </div>
        <footer className="csp-goal-editor-actions"><span>{isDirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestCancel}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check aria-hidden="true" />บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {showDiscardPrompt && <div className="csp-goal-discard-dialog" role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งการเปลี่ยนแปลง"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Goal ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setShowDiscardPrompt(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
