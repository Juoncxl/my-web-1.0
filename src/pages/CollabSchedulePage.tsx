import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronDown, Copy, ListOrdered } from 'lucide-react';
import type { Asset } from '../types';
import {
  buildCollabSchedule,
  collectSchedulePlatforms,
  filterScheduleByPlatform,
  formatDaysLeft,
  formatShortThaiDate,
  groupScheduleByMonth,
  scheduleToText,
  scheduleUrgency,
  type CollabScheduleEntry
} from '../lib/collabSchedule';
import { copyPlainText } from '../lib/workSharing';
import '../styles/collabSchedule.css';

interface CollabSchedulePageProps {
  assets: Asset[];
  isLoading: boolean;
  onBack: () => void;
  onOpenAsset: (asset: Asset) => void;
}

type ScheduleMode = 'agenda' | 'month';

const ScheduleCard: React.FC<{ entry: CollabScheduleEntry; onOpen: () => void }> = ({ entry, onOpen }) => {
  const urgency = entry.next ? scheduleUrgency(entry.next.daysLeft) : 'past';
  return (
    <article className={`cv-schedule-card is-${urgency}`}>
      <header>
        <div className="min-w-0">
          <h3>{entry.name}</h3>
          {entry.platforms.length > 0 && <div className="cv-schedule-apps">{entry.platforms.map(platform => <span key={platform}>{platform}</span>)}</div>}
        </div>
        <span className="cv-schedule-countdown">{entry.next ? formatDaysLeft(entry.next.daysLeft) : 'จบแล้ว'}</span>
      </header>
      <ol className="cv-schedule-milestones">
        {entry.milestones.map(milestone => (
          <li key={milestone.id} className={milestone.daysLeft < 0 ? 'is-done' : milestone.id === entry.next?.id ? 'is-next' : ''}>
            <time dateTime={milestone.isoDate}>{formatShortThaiDate(milestone.date)}</time>
            <span>{milestone.label}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="cv-schedule-open" onClick={onOpen}>ดูงาน →</button>
    </article>
  );
};

/** Public Collab schedule: every Collab milestone sorted from nearest to furthest. */
export const CollabSchedulePage: React.FC<CollabSchedulePageProps> = ({ assets, isLoading, onBack, onOpenAsset }) => {
  const [mode, setMode] = useState<ScheduleMode>('agenda');
  const [platform, setPlatform] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const schedule = useMemo(() => buildCollabSchedule(assets), [assets]);
  const platforms = useMemo(() => collectSchedulePlatforms(schedule), [schedule]);
  const visible = useMemo(() => filterScheduleByPlatform(schedule, platform), [schedule, platform]);
  const upcoming = visible.filter(entry => entry.next);
  const past = visible.filter(entry => !entry.next);
  const months = useMemo(() => groupScheduleByMonth(visible), [visible]);

  const handleCopy = async () => {
    const copied = await copyPlainText(scheduleToText(upcoming, platform ? `กำหนดการคอลแลป · ${platform}` : 'กำหนดการคอลแลป'))
      .catch(() => false);
    setCopyStatus(copied ? 'copied' : 'error');
    window.setTimeout(() => setCopyStatus('idle'), 2500);
  };

  return (
    <section className="cv-schedule-page" aria-labelledby="cv-schedule-title">
      <button type="button" className="cv-schedule-back" onClick={onBack}><ArrowLeft aria-hidden="true" />กลับหน้าหลัก</button>
      <header className="cv-schedule-hero">
        <div>
          <span className="cv-schedule-overline">Collab Schedule</span>
          <h1 id="cv-schedule-title">กำหนดการคอลแลป</h1>
          <p>ดูว่าแต่ละคอลแลปต้องส่งข้อมูล ส่งรูป หรือเปิดตัววันไหน เรียงจากใกล้ถึงที่สุด</p>
        </div>
        <button type="button" className="cv-schedule-copy" onClick={() => void handleCopy()} disabled={!upcoming.length}>
          {copyStatus === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copyStatus === 'copied' ? 'คัดลอกแล้ว' : copyStatus === 'error' ? 'คัดลอกไม่สำเร็จ' : 'คัดลอกเป็นข้อความ'}
        </button>
      </header>

      <div className="cv-schedule-toolbar">
        <div className="cv-category-scroll cv-schedule-filters" aria-label="กรองตามแอป">
          <button type="button" className={`cv-category-pill ${platform === null ? 'is-active' : ''}`} aria-pressed={platform === null} onClick={() => setPlatform(null)}>
            <span>ทุกแอป</span><span className="cv-pill-count">{schedule.filter(entry => entry.next).length}</span>
          </button>
          {platforms.map(item => (
            <button type="button" key={item} className={`cv-category-pill ${platform === item ? 'is-active' : ''}`} aria-pressed={platform === item} onClick={() => setPlatform(item)}>
              <span>{item}</span>
            </button>
          ))}
        </div>
        <div className="cv-schedule-mode" role="group" aria-label="รูปแบบการแสดง">
          <button type="button" className={mode === 'agenda' ? 'is-active' : ''} aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}><ListOrdered aria-hidden="true" />ใกล้ถึง</button>
          <button type="button" className={mode === 'month' ? 'is-active' : ''} aria-pressed={mode === 'month'} onClick={() => setMode('month')}><CalendarDays aria-hidden="true" />รายเดือน</button>
        </div>
      </div>

      {isLoading && !schedule.length ? <p className="cv-schedule-empty">กำลังโหลดกำหนดการ…</p>
        : !upcoming.length && !past.length ? <p className="cv-schedule-empty">ยังไม่มีคอลแลปที่ตั้งวันกำหนดส่งไว้</p>
          : mode === 'agenda' ? <>
            {upcoming.length ? <div className="cv-schedule-grid">{upcoming.map(entry => <ScheduleCard key={entry.asset.id} entry={entry} onOpen={() => onOpenAsset(entry.asset)} />)}</div>
              : <p className="cv-schedule-empty">ไม่มีกำหนดการที่กำลังจะถึง</p>}
          </> : <div className="cv-schedule-months">
            {months.length ? months.map(month => (
              <section key={month.key} className="cv-schedule-month">
                <h2>{month.label}</h2>
                <ol>
                  {month.items.map(({ entry, milestone }) => (
                    <li key={milestone.id}>
                      <button type="button" className={`cv-schedule-row is-${scheduleUrgency(milestone.daysLeft)}`} onClick={() => onOpenAsset(entry.asset)}>
                        <span className="cv-schedule-date" aria-hidden="true"><strong>{milestone.date.getDate()}</strong><small>{milestone.date.toLocaleDateString('th-TH', { weekday: 'short' })}</small></span>
                        <span className="cv-schedule-row-copy">
                          <strong>{entry.name}</strong>
                          <span>{milestone.label}{entry.platforms.length ? ` · ${entry.platforms.join(', ')}` : ''}</span>
                        </span>
                        <em>{formatDaysLeft(milestone.daysLeft)}</em>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )) : <p className="cv-schedule-empty">ไม่มีกำหนดการที่กำลังจะถึง</p>}
          </div>}

      {past.length > 0 && (
        <div className="cv-schedule-past">
          <button type="button" aria-expanded={showPast} onClick={() => setShowPast(value => !value)}>
            <ChevronDown aria-hidden="true" className={showPast ? 'is-open' : ''} />ผ่านไปแล้ว ({past.length})
          </button>
          {showPast && <div className="cv-schedule-grid">{past.map(entry => <ScheduleCard key={entry.asset.id} entry={entry} onOpen={() => onOpenAsset(entry.asset)} />)}</div>}
        </div>
      )}
    </section>
  );
};
