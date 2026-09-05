import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Circle, Plus, Trash2, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  CALENDAR_EVENT_COLORS, CALENDAR_EVENT_MODES, CALENDAR_MAX_EVENTS, CALENDAR_START_WEEKS, CALENDAR_TODAY_STYLES, CALENDAR_VIEWS,
  DEFAULT_CALENDAR_CAPTION, DEFAULT_CALENDAR_DISPLAY_NAME, DEFAULT_CALENDAR_EVENTS,
  getCalendarPresentation, normalizeCalendarEvent, validateCalendarConfig,
  type CalendarEventColor, type CalendarEventMode, type CalendarStartWeek, type CalendarTodayStyle, type CalendarView, type CreatorWidgetConfig
} from './creatorWidgetModel';

interface Props {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (config: CreatorWidgetConfig, displayName: string) => void;
  onCancel: () => void;
}

const viewLabels: Record<CalendarView, string> = { mini: 'Mini', month: 'Month', week: 'Week', upcoming: 'Upcoming' };
const todayLabels: Record<CalendarTodayStyle, string> = { circle: 'Circle', fill: 'Fill', outline: 'Outline', underline: 'Underline' };
const eventModeLabels: Record<CalendarEventMode, string> = { dot: 'Dot', label: 'Label', count: 'Count' };

function draftFrom(config: CreatorWidgetConfig, displayName?: string) {
  const presentation = getCalendarPresentation(config, displayName);
  const events = (Array.isArray(config.calendarEvents) ? config.calendarEvents : presentation.validEvents.length ? presentation.validEvents : DEFAULT_CALENDAR_EVENTS).map(normalizeCalendarEvent);
  return {
    displayName: presentation.displayName,
    config: {
      ...config,
      calendarView: presentation.view,
      calendarStartWeek: presentation.startWeek,
      calendarTodayStyle: presentation.todayStyle,
      calendarCaption: presentation.caption,
      calendarEvents: events,
      calendarEventMode: presentation.eventMode,
      calendarMaxEventsPerDay: presentation.maxEventsPerDay,
      calendarShowMonthYear: presentation.showMonthYear,
      calendarShowToday: presentation.showToday,
      calendarShowWeekends: presentation.showWeekends,
      calendarShowWeekNumbers: presentation.showWeekNumbers,
      calendarShowEvents: presentation.showEvents,
      calendarShowUpcoming: presentation.showUpcoming,
      calendarShowCaption: presentation.showCaption,
      calendarSource: 'manual'
    } as CreatorWidgetConfig
  };
}

export const CreatorCalendarEditorModal: React.FC<Props> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, onSave, onCancel }) => {
  const initial = useRef(draftFrom(config, displayName));
  const [draftTitle, setDraftTitle] = useState(initial.current.displayName);
  const [draft, setDraft] = useState<CreatorWidgetConfig>(initial.current.config);
  const [monthOffset, setMonthOffset] = useState(0);
  const [discard, setDiscard] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const initialJSON = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: draftTitle, config: draft }) !== initialJSON.current;
  const dirtyRef = useRef(dirty);
  const discardRef = useRef(discard);
  const cancelRef = useRef(onCancel);
  dirtyRef.current = dirty;
  discardRef.current = discard;
  cancelRef.current = onCancel;
  const errors = useMemo(() => validateCalendarConfig({ ...draft, title: draftTitle }, draftTitle), [draft, draftTitle]);
  const preview = useMemo(() => {
    const base = new Date();
    const month = new Date(Date.UTC(base.getFullYear(), base.getMonth() + monthOffset, 1));
    return getCalendarPresentation({ ...draft, title: draftTitle }, draftTitle, base, month);
  }, [draft, draftTitle, monthOffset]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (discardRef.current) setDiscard(false); else if (dirtyRef.current) setDiscard(true); else cancelRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'));
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); release(); opener?.focus(); };
  }, []);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraft(previous => ({ ...previous, ...patch }));
  const events = draft.calendarEvents || [];
  const updateEvent = (index: number, patch: Partial<ReturnType<typeof normalizeCalendarEvent>>) => set({ calendarEvents: events.map((event, eventIndex) => eventIndex === index ? { ...event, ...patch } : event) });
  const addEvent = () => { if (events.length < 50) set({ calendarEvents: [...events, { id: `calendar-event-${Date.now()}`, date: new Date().toISOString().slice(0, 10), title: '', color: 'pink' }] }); };
  const requestClose = () => dirty ? setDiscard(true) : onCancel();

  return <div className="csp-calendar-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-calendar-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-calendar-editor-title">
      <div className="csp-calendar-editor-ribbon"><span><i />บันทึกไว้ในเบราว์เซอร์เครื่องนี้ · ยังไม่ซิงก์กับฐานข้อมูล</span><small>Cherry Blossom Milk Frosting</small></div>
      <header className="csp-calendar-editor-header"><div className="csp-calendar-editor-mark"><CalendarDays aria-hidden="true" /></div><div><h2 id="csp-calendar-editor-title">แก้ไขปฏิทิน (Calendar Studio)</h2><p>จัดตารางเดือน งานสำคัญ และดูผลบน Notion แบบเรียลไทม์</p></div><button type="button" onClick={requestClose} aria-label="ปิด Calendar editor"><X /></button></header>
      <form onSubmit={event => { event.preventDefault(); if (canSave) onSave({ ...draft, title: draftTitle.trim() || DEFAULT_CALENDAR_DISPLAY_NAME }, draftTitle.trim() || DEFAULT_CALENDAR_DISPLAY_NAME); }}>
        <div className="csp-calendar-editor-layout">
          <section className="csp-calendar-editor-column csp-calendar-inspector" aria-label="Calendar Inspector">
            <div className="csp-calendar-section-title"><Circle aria-hidden="true" />01 ข้อมูลทั่วไป &amp; มุมมอง <small>GENERAL &amp; VIEWS</small></div>
            <label className="csp-calendar-field">ชื่อที่แสดง (Display Name)<input ref={titleRef} maxLength={48} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />{errors.displayName && <em>{errors.displayName}</em>}</label>
            <div className="csp-calendar-field"><span>มุมมองปฏิทิน</span><div className="csp-calendar-segmented">{CALENDAR_VIEWS.map(view => <button type="button" key={view} className={preview.view === view ? 'is-selected' : ''} onClick={() => set({ calendarView: view })}>{viewLabels[view]}</button>)}</div></div>
            <div className="csp-calendar-field"><span>วันเริ่มต้นสัปดาห์</span><div className="csp-calendar-segmented">{CALENDAR_START_WEEKS.map(value => <button type="button" key={value} className={preview.startWeek === value ? 'is-selected' : ''} onClick={() => set({ calendarStartWeek: value as CalendarStartWeek })}>{value === 'monday' ? 'Monday (จ.)' : 'Sunday (อา.)'}</button>)}</div></div>

            <div className="csp-calendar-section-title"><Circle aria-hidden="true" />02 การแสดงผล &amp; ไฮไลต์ <small>DISPLAY &amp; HIGHLIGHTS</small></div>
            <fieldset className="csp-calendar-options"><legend>ตัวเลือกการแสดงผล</legend>{[['calendarShowMonthYear', 'แสดงเดือน / ปี'], ['calendarShowToday', 'ไฮไลต์วันนี้'], ['calendarShowWeekends', 'แสดงวันหยุดสุดสัปดาห์'], ['calendarShowWeekNumbers', 'แสดงเลขสัปดาห์'], ['calendarShowEvents', 'แสดง Events & Dots'], ['calendarShowUpcoming', 'แสดง Upcoming List'], ['calendarShowCaption', 'แสดงคำบรรยาย']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key as keyof CreatorWidgetConfig])} onChange={event => set({ [key]: event.target.checked })} />{label}</label>)}</fieldset>
            <div className="csp-calendar-field"><span>รูปแบบไฮไลต์วันนี้</span><div className="csp-calendar-style-grid">{CALENDAR_TODAY_STYLES.map(style => <button type="button" key={style} className={preview.todayStyle === style ? 'is-selected' : ''} onClick={() => set({ calendarTodayStyle: style })}>{todayLabels[style]}</button>)}</div></div>

            <div className="csp-calendar-section-title"><Circle aria-hidden="true" />03 Events &amp; Special Dates <small>{events.length} / 50</small></div>
            <div className="csp-calendar-events-head"><span>เพิ่มงานสำคัญและวันพิเศษ</span><button type="button" onClick={addEvent} disabled={events.length >= 50}><Plus />เพิ่ม event</button></div>
            <div className="csp-calendar-event-list">{events.map((event, index) => <div className="csp-calendar-event-row" key={event.id || index}><input type="date" value={event.date} onChange={change => updateEvent(index, { date: change.target.value })} aria-label="วันที่ event" /><input value={event.title} placeholder="ชื่อ event" onChange={change => updateEvent(index, { title: change.target.value })} aria-label="ชื่อ event" /><input value={event.icon || ''} placeholder="ไอคอน" maxLength={4} onChange={change => updateEvent(index, { icon: change.target.value })} aria-label="ไอคอน event" /><input value={event.time || ''} placeholder="เวลา (ถ้ามี)" onChange={change => updateEvent(index, { time: change.target.value })} aria-label="เวลา event" /><select value={event.color || 'pink'} onChange={change => updateEvent(index, { color: change.target.value as CalendarEventColor })}>{CALENDAR_EVENT_COLORS.map(color => <option key={color} value={color}>{color}</option>)}</select><button type="button" onClick={() => set({ calendarEvents: events.filter((_, eventIndex) => eventIndex !== index) })} aria-label="ลบ event"><Trash2 /></button>{errors[`calendar-event-${index}-date`] && <em>{errors[`calendar-event-${index}-date`]}</em>}{errors[`calendar-event-${index}-title`] && <em>{errors[`calendar-event-${index}-title`]}</em>}</div>)}{!events.length && <p className="csp-calendar-editor-empty">ยังไม่มี event — เพิ่มวันพิเศษเพื่อให้แสดงจุดบนปฏิทิน</p>}</div>
            <div className="csp-calendar-field"><span>รูปแบบ marker</span><div className="csp-calendar-segmented">{CALENDAR_EVENT_MODES.map(mode => <button type="button" key={mode} className={preview.eventMode === mode ? 'is-selected' : ''} onClick={() => set({ calendarEventMode: mode })}>{eventModeLabels[mode]}</button>)}</div></div>
            <div className="csp-calendar-field"><span>จำนวน Events สูงสุดต่อวัน</span><div className="csp-calendar-segmented">{CALENDAR_MAX_EVENTS.map(value => <button type="button" key={value} className={preview.maxEventsPerDay === value ? 'is-selected' : ''} onClick={() => set({ calendarMaxEventsPerDay: value })}>{value}</button>)}</div></div>

            <div className="csp-calendar-section-title"><Circle aria-hidden="true" />04 Appearance <small>LOCKED STYLE</small></div>
            <div className="csp-calendar-locked"><span /><div><strong>Cherry Blossom Milk Frosting</strong><small>Warm cream · cherry blossom pink · sky blue</small></div><b>FIXED</b></div>
            <label className="csp-calendar-field">Calendar Caption<input maxLength={120} value={draft.calendarCaption || ''} onChange={event => set({ calendarCaption: event.target.value })} placeholder={DEFAULT_CALENDAR_CAPTION} />{errors.calendarCaption && <em>{errors.calendarCaption}</em>}</label>
          </section>
          <aside className="csp-calendar-editor-column csp-calendar-editor-preview" aria-label="Notion Live Preview">
            <div className="csp-calendar-preview-heading"><span><i />Notion Live Preview</span><b>Live Sync</b></div>
            <div className="csp-calendar-preview-frame"><div className="csp-calendar-preview-topbar"><span>● ● ●</span><small>My Cozy Desk 2026 / Weekly Dashboard</small><em>12-COL CANVAS</em></div><div className="csp-calendar-preview-page"><div className="csp-calendar-preview-banner"><span>NOTION LIVE SIMULATION</span><small>12 Columns Responsive Layout</small></div><h3><span>🌸</span> {draftTitle || DEFAULT_CALENDAR_DISPLAY_NAME}</h3><p>ปฏิทินส่วนตัวและ Daily Tasks แห่งสัปดาห์</p><div className="csp-calendar-preview-widget"><CreatorWidgetRenderer type="calendar" config={{ ...draft, title: draftTitle }} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div><div className="csp-calendar-preview-neighbors"><span>✓ Daily Tasks <b>2/3 Done</b></span><span>✦ Today's Focus <b>Sep 16</b></span></div></div></div>
            <div className="csp-calendar-preview-tip"><CalendarDays aria-hidden="true" /><span>เปลี่ยน view, start week, marker หรือ event แล้วดูผลบนปฏิทินทันที</span></div>
          </aside>
        </div>
        <footer className="csp-calendar-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestClose}>ยกเลิก</button><button type="submit" disabled={!canSave}>✓ บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {discard && <div className="csp-calendar-discard" role="alertdialog" aria-modal="true"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Calendar ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setDiscard(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
