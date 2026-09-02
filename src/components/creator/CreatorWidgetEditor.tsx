import React from 'react';
import type { CreatorWidgetType } from './CreatorCustomizePanel';
import { CREATOR_WIDGET_ICONS, CREATOR_WIDGET_LABELS } from './CreatorCustomizePanel';

export interface CreatorWidgetConfig {
  title?: string;
  description?: string;
  text?: string;
  status?: string;
  visibility?: 'public' | 'private';
  showCount?: boolean;
  showCompleted?: boolean;
  items?: Array<{ label: string; done: boolean }>;
  links?: Array<{ label: string; url: string }>;
  goal?: number;
  imageUrl?: string;
  accent?: string;
}

interface CreatorWidgetEditorProps {
  type: CreatorWidgetType;
  config: CreatorWidgetConfig;
  displayName?: string;
  contextual?: boolean;
  instanceId?: string;
  onChange: (next: CreatorWidgetConfig) => void;
  onDisplayNameChange?: (next: string) => void;
  onClose: () => void;
}

const update = (config: CreatorWidgetConfig, patch: Partial<CreatorWidgetConfig>) => ({ ...config, ...patch });

export const CreatorWidgetEditor: React.FC<CreatorWidgetEditorProps> = ({ type, config, displayName, contextual = false, instanceId, onChange, onDisplayNameChange, onClose }) => {
  const set = (patch: Partial<CreatorWidgetConfig>) => onChange(update(config, patch));
  return (
    <section className={`csp-widget-editor ${contextual ? 'is-contextual' : ''}`} data-widget-editor-instance-id={instanceId} aria-label={`แก้ไข ${CREATOR_WIDGET_LABELS[type]}`}>
      <div className="csp-widget-editor-heading">
        <strong>{CREATOR_WIDGET_ICONS[type]} แก้ไข {CREATOR_WIDGET_LABELS[type]}</strong>
        <span>การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</span>
      </div>
      <div className="csp-widget-editor-fields">
        <label className="csp-field">Display Name<input value={displayName ?? ''} placeholder={CREATOR_WIDGET_LABELS[type]} onChange={event => onDisplayNameChange?.(event.target.value)} /></label>
        {type === 'folder' && <><label className="csp-field">การมองเห็น<select value={config.visibility || 'public'} onChange={event => set({ visibility: event.target.value as CreatorWidgetConfig['visibility'] })}><option value="public">สาธารณะ</option><option value="private">ส่วนตัว</option></select></label><label className="csp-check-field"><input type="checkbox" checked={config.showCount !== false} onChange={event => set({ showCount: event.target.checked })} /> แสดงจำนวนผลงาน</label></>}
        {type === 'playlist' && <><label className="csp-field">คำอธิบาย<input value={config.description || ''} onChange={event => set({ description: event.target.value })} placeholder="เช่น เพลงสำหรับโหมดสร้างงาน" /></label><label className="csp-field">ลิงก์ Playlist<input type="url" value={config.links?.[0]?.url || ''} onChange={event => set({ links: [{ label: 'เปิด Playlist', url: event.target.value }] })} placeholder="https://..." /></label></>}
        {type === 'todo' && <><label className="csp-field">รายการสิ่งที่ต้องทำ<textarea rows={4} value={(config.items || []).map(item => `${item.done ? '[x]' : '[ ]'} ${item.label}`).join('\n')} onChange={event => set({ items: event.target.value.split('\n').filter(Boolean).map(line => ({ done: /^\s*\[x\]/i.test(line), label: line.replace(/^\s*\[[ x]\]\s*/i, '') })) })} placeholder="[ ] เตรียม outline\n[x] เช็ก reference" /></label><label className="csp-check-field"><input type="checkbox" checked={config.showCompleted === true} onChange={event => set({ showCompleted: event.target.checked })} /> แสดงรายการที่เสร็จแล้ว</label></>}
        {type === 'status' && <><label className="csp-field">สถานะปัจจุบัน<input value={config.status || ''} onChange={event => set({ status: event.target.value })} placeholder="กำลังสร้าง world ใหม่" /></label><label className="csp-field">คำอธิบาย<input value={config.description || ''} onChange={event => set({ description: event.target.value })} /></label></>}
        {type === 'note' && <label className="csp-field">ข้อความโน้ต<textarea rows={4} value={config.text || ''} onChange={event => set({ text: event.target.value })} placeholder="เขียนข้อความสั้น ๆ ของคุณ" /></label>}
        {type === 'links' && <><label className="csp-field">คำอธิบาย<input value={config.description || ''} onChange={event => set({ description: event.target.value })} /></label><label className="csp-field">ลิงก์เพิ่มเติม<input type="url" value={config.links?.[0]?.url || ''} onChange={event => set({ links: [{ label: config.links?.[0]?.label || 'ลิงก์ของฉัน', url: event.target.value }] })} placeholder="https://..." /></label></>}
        {type === 'goal' && <><label className="csp-field">เป้าหมาย<input value={config.description || ''} onChange={event => set({ description: event.target.value })} placeholder="สร้างผลงานให้ครบ 10 ชิ้น" /></label><label className="csp-field">ความคืบหน้า ({config.goal || 0}%)<input type="range" min="0" max="100" value={config.goal || 0} onChange={event => set({ goal: Number(event.target.value) })} /></label></>}
        {type === 'gallery' && <label className="csp-field">จำนวนภาพที่แสดง<select value={String(config.goal || 3)} onChange={event => set({ goal: Number(event.target.value) })}><option value="2">2 ภาพ</option><option value="3">3 ภาพ</option><option value="4">4 ภาพ</option></select></label>}
        {type === 'calendar' && <label className="csp-field">คำอธิบายปฏิทิน<input value={config.description || ''} onChange={event => set({ description: event.target.value })} placeholder="กำหนดการสร้างงาน" /></label>}
        {type === 'single_image' && <label className="csp-field">URL รูปภาพ<input type="url" value={config.imageUrl || ''} onChange={event => set({ imageUrl: event.target.value })} placeholder="https://..." /></label>}
        {type === 'decoration' && <label className="csp-field">ข้อความตกแต่ง<input value={config.text || ''} onChange={event => set({ text: event.target.value })} placeholder="✦" /></label>}
        {type === 'clock' && <label className="csp-field">คำอธิบายเวลา<input value={config.description || 'เวลาท้องถิ่น · Asia/Bangkok'} onChange={event => set({ description: event.target.value })} /></label>}
      </div>
      <button type="button" className="csp-primary-button" onClick={onClose}>เสร็จสิ้น</button>
    </section>
  );
};
