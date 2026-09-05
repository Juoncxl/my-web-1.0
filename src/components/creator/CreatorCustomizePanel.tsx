import React from 'react';
import { ChevronDown, ChevronUp, Grid2X2, Plus, Settings2, Sparkles, X } from 'lucide-react';
import { getFreePlacementWidthOptions } from '../../lib/creatorLayout';
import { CreatorCompactItemControls, shouldUseCompactOwnerControls } from './CreatorCompactItemControls';

export type CreatorLayout = 'locked' | 'free';
export type LockedPreset = 'left' | 'right' | 'split';
export type CreatorWidgetType = 'folder' | 'playlist' | 'todo' | 'status' | 'note' | 'links' | 'goal' | 'gallery' | 'clock' | 'weather' | 'calendar' | 'single_image' | 'decoration';

export interface CreatorCustomizePanelProps {
  layout: CreatorLayout;
  lockedPreset: LockedPreset;
  widgets: CreatorWidgetType[];
  widgetRail: Record<CreatorWidgetType, 'left' | 'right'>;
  spans: Record<string, number>;
  onLayoutChange: (layout: CreatorLayout) => void;
  onLockedPresetChange: (preset: LockedPreset) => void;
  onAddWidget: (type: CreatorWidgetType, rail?: 'left' | 'right') => void;
  onRemoveWidget: (type: CreatorWidgetType) => void;
  onMoveWidget: (type: CreatorWidgetType, direction: -1 | 1) => void;
  onMoveRail: (type: CreatorWidgetType, rail: 'left' | 'right') => void;
  onSpanChange: (type: string, span: number) => void;
  onClose: () => void;
}

const WIDGET_LIBRARY: Array<{ group: string; items: Array<{ type: CreatorWidgetType; icon: string; label: string }> }> = [
  { group: 'จัดระเบียบ', items: [{ type: 'folder', icon: '📁', label: 'โฟลเดอร์' }, { type: 'todo', icon: '✅', label: 'สิ่งที่ต้องทำ' }, { type: 'goal', icon: '🎯', label: 'เป้าหมาย / ความคืบหน้า' }, { type: 'calendar', icon: '📅', label: 'ปฏิทิน' }] },
  { group: 'ตัวตน', items: [{ type: 'status', icon: '💭', label: 'สถานะ' }, { type: 'note', icon: '📝', label: 'โน้ต' }, { type: 'links', icon: '🔗', label: 'ลิงก์ของฉัน' }] },
  { group: 'สื่อและ Utility', items: [{ type: 'playlist', icon: '🎵', label: 'Playlist' }, { type: 'single_image', icon: '🌄', label: 'รูปภาพเดี่ยว' }, { type: 'gallery', icon: '🖼️', label: 'แกลเลอรี' }, { type: 'decoration', icon: '✦', label: 'Decoration' }, { type: 'clock', icon: '🕒', label: 'นาฬิกา' }, { type: 'weather', icon: '☁️', label: 'สภาพอากาศ' }] }
];

export const CREATOR_WIDGET_LABELS: Record<CreatorWidgetType, string> = {
  folder: 'โฟลเดอร์', playlist: 'Playlist', todo: 'สิ่งที่ต้องทำ', status: 'สถานะ', note: 'โน้ต', links: 'ลิงก์ของฉัน', goal: 'เป้าหมาย / ความคืบหน้า', gallery: 'แกลเลอรี', clock: 'นาฬิกา', weather: 'สภาพอากาศ', calendar: 'ปฏิทิน', single_image: 'รูปภาพเดี่ยว', decoration: 'Decoration'
};

export const CREATOR_WIDGET_ICONS: Record<CreatorWidgetType, string> = {
  folder: '📁', playlist: '🎵', todo: '✅', status: '💭', note: '📝', links: '🔗', goal: '🎯', gallery: '🖼️', clock: '🕒', weather: '☁️', calendar: '📅', single_image: '🌄', decoration: '✦'
};

const SPAN_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function spanLabel(span: number) {
  return `${span} / 12 คอลัมน์`;
}

export const CreatorCustomizePanel: React.FC<CreatorCustomizePanelProps> = ({
  layout, lockedPreset, widgets, widgetRail, spans, onLayoutChange, onLockedPresetChange, onAddWidget, onRemoveWidget, onMoveWidget, onMoveRail, onSpanChange, onClose
}) => {
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [layoutOpen, setLayoutOpen] = React.useState(false);

  React.useEffect(() => {
    if (layout === 'free') setLibraryOpen(false);
  }, [layout]);

  return (
    <>
      <section className="csp-customize-toolbar" aria-label="เครื่องมือตกแต่งโปรไฟล์">
        <div><p className="csp-eyebrow">CUSTOMIZE MODE</p><strong><Sparkles className="inline h-4 w-4" /> กำลังตกแต่งโปรไฟล์</strong><span>การจัดวางนี้เก็บใน session เท่านั้น · ยังไม่เขียน database</span></div>
        <div className="csp-customize-actions">{layout !== 'free' && <button type="button" className="csp-secondary-button" onClick={() => setLibraryOpen(true)}><Plus className="h-3.5 w-3.5" />เพิ่มวิดเจ็ต</button>}<button type="button" className="csp-secondary-button" onClick={() => setLayoutOpen(value => !value)}><Grid2X2 className="h-3.5 w-3.5" />{layout === 'free' ? 'Free · 12-column' : `Locked ${lockedPreset === 'left' ? 'A' : lockedPreset === 'right' ? 'B' : 'C'}`}</button><button type="button" className="csp-primary-button" onClick={onClose}>เสร็จสิ้น</button></div>
      </section>
      {layoutOpen && <section className="csp-customize-popover" aria-label="เลือก layout"><div className="csp-section-heading"><div><h3>Layout structure</h3><p>เลือกโครงสร้างตาม approved preview</p></div><button type="button" className="csp-icon-button" onClick={() => setLayoutOpen(false)} aria-label="ปิด"><X className="h-4 w-4" /></button></div><div className="csp-layout-options"><button type="button" className={layout === 'locked' && lockedPreset === 'left' ? 'is-active' : ''} onClick={() => { onLayoutChange('locked'); onLockedPresetChange('left'); }}><span className="csp-schematic csp-schematic-left"><i /><b /></span><strong>Locked A</strong><small>Widgets ซ้าย · Portfolio ขวา</small></button><button type="button" className={layout === 'locked' && lockedPreset === 'right' ? 'is-active' : ''} onClick={() => { onLayoutChange('locked'); onLockedPresetChange('right'); }}><span className="csp-schematic csp-schematic-right"><i /><b /></span><strong>Locked B</strong><small>Portfolio ซ้าย · Widgets ขวา</small></button><button type="button" className={layout === 'locked' && lockedPreset === 'split' ? 'is-active' : ''} onClick={() => { onLayoutChange('locked'); onLockedPresetChange('split'); }}><span className="csp-schematic csp-schematic-split"><i /><b /><i /></span><strong>Locked C</strong><small>Widgets ซ้าย · Portfolio กลาง · Widgets ขวา</small></button><button type="button" className={layout === 'free' ? 'is-active' : ''} onClick={() => onLayoutChange('free')}><span className="csp-schematic csp-schematic-free"><i /><b /><em /></span><strong>Free Layout</strong><small>ทุก block ใช้ canvas 12 คอลัมน์ร่วมกัน</small></button></div><p className="csp-lock-note">🔒 Locked ล็อกสัดส่วนโครงสร้างหลัก แต่ widget ยังเพิ่ม ลบ เรียง และแก้ไขได้</p></section>}
      {libraryOpen && <div className="csp-inline-dialog" role="dialog" aria-label="Widget Library"><div className="csp-section-heading"><div><h3>Widget Library</h3><p>เพิ่มบล็อกเข้าสู่พื้นที่ใน session</p></div><button type="button" className="csp-icon-button" onClick={() => setLibraryOpen(false)} aria-label="ปิด"><X className="h-4 w-4" /></button></div>{WIDGET_LIBRARY.map(group => <div key={group.group} className="csp-library-group"><h4>{group.group}</h4><div className="csp-library-grid">{group.items.map(item => <button type="button" key={item.type} disabled={widgets.includes(item.type)} onClick={() => { onAddWidget(item.type); setLibraryOpen(false); }}><span>{item.icon}</span><strong>{item.label}</strong><small>{widgets.includes(item.type) ? 'เพิ่มแล้ว' : 'เพิ่มบล็อก'}</small></button>)}</div></div>)}</div>}
      <div className="csp-customize-help"><Settings2 className="h-4 w-4" /><span>{layout === 'free' ? 'Free: ลาก/ปรับขนาดใน canvas และเพิ่มรายการจากปุ่มด้านล่างของ composition' : 'Locked: โครงหลักคงที่ · ใช้ ↑ ↓ เรียง widget และปุ่ม rail ใน Locked C'}</span></div>
      {layout === 'free' && <div className="csp-span-legend">{SPAN_OPTIONS.map(span => <span key={span}>{span}</span>)}<small>span ที่รองรับ</small></div>}
    </>
  );
};

interface CreatorWidgetControlsProps {
  type: CreatorWidgetType;
  layout: CreatorLayout;
  lockedPreset: LockedPreset;
  span: number;
  rail: 'left' | 'right';
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onRemove: () => void;
  onRail: (rail: 'left' | 'right') => void;
  onSpan: (span: number) => void;
  height?: number;
  onHeight?: (height: number) => void;
  instanceId?: string;
}

export const CreatorWidgetControls: React.FC<CreatorWidgetControlsProps> = ({ type, layout, lockedPreset, span, rail, onMove, onEdit, onRemove, onRail, onSpan, height, onHeight, instanceId }) => {
  if (shouldUseCompactOwnerControls(layout, span)) {
    return <CreatorCompactItemControls label={CREATOR_WIDGET_LABELS[type]} itemId={`widget:${instanceId || type}`} widgetInstanceId={instanceId} span={span} widthOptions={getFreePlacementWidthOptions('widget', type)} height={height} heightOptions={[1, 2, 3, 4, 5, 6, 8]} onSpan={onSpan} onHeight={onHeight} onMove={onMove} onEdit={onEdit} onRemove={onRemove} />;
  }

  return <div className="csp-widget-edit-bar"><span className="csp-drag-handle" aria-hidden="true">⋮⋮</span><strong>{CREATOR_WIDGET_ICONS[type]} {CREATOR_WIDGET_LABELS[type]}</strong>{layout === 'free' && <><select value={span} onChange={event => onSpan(Number(event.target.value))} aria-label={`ความกว้าง ${CREATOR_WIDGET_LABELS[type]}`}>{getFreePlacementWidthOptions('widget', type).map(value => <option value={value} key={value}>{spanLabel(value)}</option>)}</select>{height && onHeight && <select value={height} onChange={event => onHeight(Number(event.target.value))} aria-label={`ความสูง ${CREATOR_WIDGET_LABELS[type]}`}>{[1, 2, 3, 4, 5, 6, 8].map(value => <option value={value} key={value}>{value} แถว</option>)}</select>}</>}<button type="button" onClick={() => onMove(-1)} aria-label={`เลื่อน ${CREATOR_WIDGET_LABELS[type]} ขึ้น`}><ChevronUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onMove(1)} aria-label={`เลื่อน ${CREATOR_WIDGET_LABELS[type]} ลง`}><ChevronDown className="h-3.5 w-3.5" /></button>{layout === 'locked' && lockedPreset === 'split' && <><button type="button" className={rail === 'left' ? 'is-selected' : ''} onClick={() => onRail('left')} aria-label="ย้ายไป rail ซ้าย">←</button><button type="button" className={rail === 'right' ? 'is-selected' : ''} onClick={() => onRail('right')} aria-label="ย้ายไป rail ขวา">→</button></>}<button type="button" onClick={onEdit} aria-label={`แก้ไข ${CREATOR_WIDGET_LABELS[type]}`}><Settings2 className="h-3.5 w-3.5" /></button><button type="button" className="is-danger csp-remove-from-profile" onClick={onRemove} aria-label={`นำ ${CREATOR_WIDGET_LABELS[type]} ออกจากหน้าโปรไฟล์`} title="ลบเฉพาะตำแหน่ง เนื้อหาต้นฉบับยังอยู่">นำออก</button></div>;
};
