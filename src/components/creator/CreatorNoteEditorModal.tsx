import React, { useEffect, useRef, useState } from 'react';
import { Check, Cloud, FilePenLine, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DEFAULT_NOTE_BADGE,
  DEFAULT_NOTE_FOOTER_LEFT,
  DEFAULT_NOTE_ICON,
  DEFAULT_NOTE_KICKER,
  NOTE_FALLBACK_TITLE,
  NOTE_ICON_PRESETS,
  type CreatorWidgetConfig
} from './creatorWidgetModel';

interface CreatorNoteEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

function createDraft(config: CreatorWidgetConfig, displayName: string | undefined, profileName: string) {
  return {
    displayName: displayName?.trim() || config.title?.trim() || NOTE_FALLBACK_TITLE,
    config: {
      ...config,
      icon: config.icon?.trim() || DEFAULT_NOTE_ICON,
      noteKicker: config.noteKicker?.trim() || DEFAULT_NOTE_KICKER,
      noteBadge: config.noteBadge?.trim() || DEFAULT_NOTE_BADGE,
      noteFooterLeft: config.noteFooterLeft?.trim() || DEFAULT_NOTE_FOOTER_LEFT,
      noteFooterRight: config.noteFooterRight?.trim() || profileName.trim() || 'Creator'
    }
  };
}

export const CreatorNoteEditorModal: React.FC<CreatorNoteEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, onSave, onCancel }) => {
  const initialDraft = useRef(createDraft(config, displayName, previewDisplayName));
  const [draftTitle, setDraftTitle] = useState(initialDraft.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initialDraft.current.config);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScroll = acquireViewportScrollLock(document);
    const frame = window.requestAnimationFrame(() => titleInputRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      releaseScroll();
      opener?.focus();
    };
  }, []);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraftConfig(previous => ({ ...previous, ...patch }));
  const noteText = draftConfig.text || '';

  return <div className="csp-note-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-note-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-note-editor-title" aria-describedby="csp-note-editor-description">
      <div className="csp-note-editor-ribbon"><span><i aria-hidden="true" />การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</span><small><Cloud aria-hidden="true" />แบบจำลองชั่วคราว</small></div>
      <header className="csp-note-editor-header">
        <div className="csp-note-editor-heading-icon"><FilePenLine aria-hidden="true" /></div>
        <div><h2 id="csp-note-editor-title">แก้ไข โน้ต Widget</h2><p id="csp-note-editor-description">ปรับแต่งข้อความ ไอคอน และข้อมูลบนการ์ดแบบไลฟ์</p></div>
        <button type="button" className="csp-note-editor-close" onClick={onCancel} aria-label="ปิดโดยไม่บันทึก"><X aria-hidden="true" /></button>
      </header>

      <form className="csp-note-editor-form" onSubmit={event => { event.preventDefault(); onSave(draftConfig, draftTitle.trim() || NOTE_FALLBACK_TITLE); }}>
        <div className="csp-note-editor-body">
          <div className="csp-note-editor-fields">
            <div className="csp-note-editor-section-heading"><span>✎ 1. เนื้อหาโน้ต (CONTENT)</span><small>แก้ไขใน draft</small></div>
            <label className="csp-note-editor-field"><span>ชื่อแสดง Widget</span><input ref={titleInputRef} maxLength={30} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder={NOTE_FALLBACK_TITLE} /></label>
            <label className="csp-note-editor-field"><span><b>ข้อความโน้ต</b><small>{noteText.length} / 280 ตัวอักษร</small></span><textarea rows={5} maxLength={280} value={noteText} onChange={event => set({ text: event.target.value })} placeholder="เขียนข้อความสั้น ๆ หรือแรงบันดาลใจของคุณ..." /></label>

            <fieldset className="csp-note-icon-picker"><legend>ไอคอนประจำโน้ต</legend><div>{NOTE_ICON_PRESETS.map(icon => <button type="button" key={icon} className={draftConfig.icon === icon ? 'is-selected' : ''} onClick={() => set({ icon })} aria-label={`เลือกไอคอน ${icon}`} aria-pressed={draftConfig.icon === icon}>{icon}</button>)}</div></fieldset>

            <div className="csp-note-editor-divider" />
            <div className="csp-note-editor-section-heading"><span>◌ 2. ข้อมูลประกอบการ์ด (CARD DETAILS)</span><small>แก้ได้ทุกส่วน</small></div>
            <div className="csp-note-editor-meta-grid">
              <label className="csp-note-editor-field"><span>Overline</span><input maxLength={42} value={draftConfig.noteKicker || ''} onChange={event => set({ noteKicker: event.target.value })} placeholder={DEFAULT_NOTE_KICKER} /></label>
              <label className="csp-note-editor-field"><span>Badge</span><input maxLength={28} value={draftConfig.noteBadge || ''} onChange={event => set({ noteBadge: event.target.value })} placeholder={DEFAULT_NOTE_BADGE} /></label>
              <label className="csp-note-editor-field"><span>Footer ซ้าย</span><input maxLength={48} value={draftConfig.noteFooterLeft || ''} onChange={event => set({ noteFooterLeft: event.target.value })} placeholder={DEFAULT_NOTE_FOOTER_LEFT} /></label>
              <label className="csp-note-editor-field"><span>Footer ขวา</span><input maxLength={48} value={draftConfig.noteFooterRight || ''} onChange={event => set({ noteFooterRight: event.target.value })} placeholder={previewDisplayName} /></label>
            </div>
          </div>

          <aside className="csp-note-editor-preview" aria-label="พรีวิว Note Widget">
            <div className="csp-note-editor-preview-heading"><span><i aria-hidden="true" />พรีวิวแบบเรียลไทม์</span><small>100% Scale</small></div>
            <div className="csp-note-preview-frame"><div className="csp-note-preview-breadcrumb">หน้าหลัก <span>/</span> แดชบอร์ดส่วนตัว <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div><div className="csp-widget is-note-widget-shell csp-note-preview-widget" data-widget-type="note"><div className="csp-widget-body is-note-widget-body"><CreatorWidgetRenderer type="note" config={draftConfig} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div></div></div>
            <div className="csp-note-editor-tip"><span>เกร็ดน่ารู้</span><p>ข้อความในฝั่งซ้ายจะอัปเดตพรีวิวทันที และบันทึกเมื่อกดเสร็จสิ้น</p></div>
          </aside>
        </div>

        <footer className="csp-note-editor-actions"><button type="button" className="csp-note-editor-cancel" onClick={onCancel}>ยกเลิก</button><button type="submit" className="csp-note-editor-save"><Check aria-hidden="true" />เสร็จสิ้น</button></footer>
      </form>
    </div>
  </div>;
};
