import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronDown, Copy, ImageDown, ListOrdered, Table2 } from 'lucide-react';
import type { Asset } from '../types';
import {
  buildCollabSchedule,
  collectSchedulePlatforms,
  filterScheduleByPlatform,
  formatDaysLeft,
  formatShortThaiDate,
  groupScheduleByMonth,
  MILESTONE_PROGRESS_LABELS,
  milestoneProgress,
  scheduleToText,
  scheduleUrgency,
  type CollabProgress,
  type CollabScheduleEntry,
  type CollabScheduleMilestone
} from '../lib/collabSchedule';
import { fetchCollabProgress, saveCollabProgress } from '../lib/collabProgress';
import { renderScheduleImage } from '../lib/collabScheduleImage';
import { copyPlainText, shouldUseNativeImageShare, triggerBrowserFileDownload } from '../lib/workSharing';
import '../styles/collabSchedule.css';

interface CollabSchedulePageProps {
  assets: Asset[];
  isLoading: boolean;
  /** The signed-in Owner sees done ticks and progress badges; visitors see the plain schedule. */
  isOwner?: boolean;
  onBack: () => void;
  onOpenAsset: (asset: Asset) => void;
}

type ScheduleMode = 'agenda' | 'month' | 'table';

/** Owner-only tick state passed down to the views; null for visitors. */
interface OwnerProgress {
  progress: CollabProgress;
  pending: ReadonlySet<string>;
  toggle: (milestone: CollabScheduleMilestone) => void;
}

const EntryIcon: React.FC<{ asset: Asset }> = ({ asset }) => {
  const [failed, setFailed] = useState(false);
  const icon = asset.icon;
  if (icon?.type === 'image' && icon.value && !failed) {
    return <img src={icon.value} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return <span>{icon && icon.type !== 'image' && icon.value.length <= 8 ? icon.value : '🤝'}</span>;
};

const ProgressBadge: React.FC<{ milestone: CollabScheduleMilestone; owner: OwnerProgress | null }> = ({ milestone, owner }) => {
  if (!owner) return null;
  const state = milestoneProgress(milestone, owner.progress);
  if (state === 'open') return null;
  return <span className={`cv-schedule-progress is-${state}`}>{MILESTONE_PROGRESS_LABELS[state]}</span>;
};

/** Notion-style table: one row per Collab, nearest milestone first, finished rows dimmed at the end. */
const ScheduleTable: React.FC<{ entries: CollabScheduleEntry[]; owner: OwnerProgress | null; onOpen: (asset: Asset) => void }> = ({ entries, owner, onOpen }) => (
  <div className="cv-schedule-table-wrap">
    <table className="cv-schedule-table">
      <thead>
        <tr>
          <th scope="col">ชื่อคอลแลป</th>
          <th scope="col">แอป</th>
          <th scope="col">แท็ก</th>
          <th scope="col">กำหนดถัดไป</th>
          <th scope="col">วันที่</th>
          <th scope="col">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => {
          const milestone = entry.next || entry.milestones[entry.milestones.length - 1];
          const urgency = entry.next ? scheduleUrgency(entry.next.daysLeft) : 'past';
          return (
            <tr key={entry.asset.id} className={`is-${urgency}`} onClick={() => onOpen(entry.asset)}>
              <th scope="row">
                <button type="button" onClick={event => { event.stopPropagation(); onOpen(entry.asset); }}>
                  <span className="cv-schedule-table-icon" aria-hidden="true"><EntryIcon asset={entry.asset} /></span>
                  <span>{entry.name}</span>
                </button>
              </th>
              <td><div className="cv-schedule-apps">{entry.platforms.map(platform => <span key={platform}>{platform}</span>)}</div></td>
              <td className="cv-schedule-table-tag">{entry.sharedTag ? `#${entry.sharedTag.replace(/^#/, '')}` : '—'}</td>
              <td>{milestone.label}</td>
              <td className="cv-schedule-table-date"><time dateTime={milestone.isoDate}>{milestone.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</time></td>
              <td><span className="cv-schedule-status">{entry.next ? formatDaysLeft(entry.next.daysLeft) : 'จบแล้ว'}</span><ProgressBadge milestone={milestone} owner={owner} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const ScheduleCard: React.FC<{ entry: CollabScheduleEntry; owner: OwnerProgress | null; onOpen: () => void }> = ({ entry, owner, onOpen }) => {
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
        {entry.milestones.map(milestone => {
          const state = owner ? milestoneProgress(milestone, owner.progress) : 'open';
          // Visitors keep the date-based strike-through; for the Owner an unticked past date stays loud.
          const className = state === 'overdue' ? 'is-overdue'
            : milestone.daysLeft < 0 || (owner && state !== 'open') ? 'is-done'
              : milestone.id === entry.next?.id ? 'is-next' : '';
          const done = Boolean(owner?.progress[milestone.id]);
          return (
            <li key={milestone.id} className={className}>
              {owner && <button
                type="button"
                className={`cv-schedule-tick ${done ? 'is-checked' : ''}`}
                aria-pressed={done}
                aria-label={done ? `ยกเลิกเสร็จแล้ว: ${milestone.label}` : `ทำเครื่องหมายว่าเสร็จ: ${milestone.label}`}
                disabled={owner.pending.has(milestone.id)}
                onClick={() => owner.toggle(milestone)}
              >{done && <Check aria-hidden="true" />}</button>}
              <time dateTime={milestone.isoDate}>{formatShortThaiDate(milestone.date)}</time>
              <span>{milestone.label}</span>
              <ProgressBadge milestone={milestone} owner={owner} />
            </li>
          );
        })}
      </ol>
      <button type="button" className="cv-schedule-open" onClick={onOpen}>ดูงาน →</button>
    </article>
  );
};

/** Public Collab schedule: every Collab milestone sorted from nearest to furthest. */
export const CollabSchedulePage: React.FC<CollabSchedulePageProps> = ({ assets, isLoading, isOwner = false, onBack, onOpenAsset }) => {
  const [mode, setMode] = useState<ScheduleMode>('agenda');
  const [platform, setPlatform] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [imageStatus, setImageStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [progress, setProgress] = useState<CollabProgress>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [progressError, setProgressError] = useState('');

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetchCollabProgress()
      .then(data => { if (!cancelled) setProgress(data); })
      .catch(() => { if (!cancelled) setProgressError('โหลดสถานะงานที่ติ๊กไว้ไม่สำเร็จ'); });
    return () => { cancelled = true; };
  }, [isOwner]);

  const schedule = useMemo(() => buildCollabSchedule(assets), [assets]);
  const platforms = useMemo(() => collectSchedulePlatforms(schedule), [schedule]);
  const visible = useMemo(() => filterScheduleByPlatform(schedule, platform), [schedule, platform]);
  const upcoming = visible.filter(entry => entry.next);
  const past = visible.filter(entry => !entry.next);
  const months = useMemo(() => groupScheduleByMonth(visible), [visible]);
  const scheduleTitle = platform ? `กำหนดการคอลแลป · ${platform}` : 'กำหนดการคอลแลป';

  const toggle = (milestone: CollabScheduleMilestone) => {
    const done = !progress[milestone.id];
    const previous = progress;
    setProgress(current => {
      const next = { ...current };
      if (done) next[milestone.id] = new Date().toISOString(); else delete next[milestone.id];
      return next;
    });
    setPending(current => new Set(current).add(milestone.id));
    setProgressError('');
    saveCollabProgress(milestone.id, done)
      .then(setProgress)
      .catch(() => { setProgress(previous); setProgressError('บันทึกไม่สำเร็จ ลองกดอีกครั้ง'); })
      .finally(() => setPending(current => { const next = new Set(current); next.delete(milestone.id); return next; }));
  };
  const owner: OwnerProgress | null = isOwner ? { progress, pending, toggle } : null;
  const overduePast = owner ? past.reduce((count, entry) => count + entry.milestones.filter(item => milestoneProgress(item, progress) === 'overdue').length, 0) : 0;

  const handleCopy = async () => {
    const copied = await copyPlainText(scheduleToText(upcoming, scheduleTitle)).catch(() => false);
    setCopyStatus(copied ? 'copied' : 'error');
    window.setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const handleSaveImage = async () => {
    setImageStatus('working');
    try {
      const blob = await renderScheduleImage(upcoming, platform ? `แอป ${platform}` : 'เรียงจากใกล้ถึงที่สุด');
      const file = new File([blob], `cxl-collab-schedule-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
      if (shouldUseNativeImageShare(navigator.userAgent, navigator.maxTouchPoints) && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: scheduleTitle }).catch(() => undefined);
      } else if (!triggerBrowserFileDownload(file)) throw new Error('Download is not available');
      setImageStatus('idle');
    } catch {
      setImageStatus('error');
      window.setTimeout(() => setImageStatus('idle'), 2500);
    }
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
        <div className="cv-schedule-hero-actions">
          <button type="button" className="cv-schedule-copy" onClick={() => void handleSaveImage()} disabled={!upcoming.length || imageStatus === 'working'}>
            <ImageDown aria-hidden="true" />
            {imageStatus === 'working' ? 'กำลังสร้างรูป…' : imageStatus === 'error' ? 'สร้างรูปไม่สำเร็จ' : 'บันทึกเป็นรูป'}
          </button>
          <button type="button" className="cv-schedule-copy" onClick={() => void handleCopy()} disabled={!upcoming.length}>
            {copyStatus === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copyStatus === 'copied' ? 'คัดลอกแล้ว' : copyStatus === 'error' ? 'คัดลอกไม่สำเร็จ' : 'คัดลอกเป็นข้อความ'}
          </button>
        </div>
      </header>

      {progressError && <p className="cv-schedule-progress-error" role="status">{progressError}</p>}

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
          <button type="button" className={mode === 'table' ? 'is-active' : ''} aria-pressed={mode === 'table'} onClick={() => setMode('table')}><Table2 aria-hidden="true" />ตาราง</button>
        </div>
      </div>

      {isLoading && !schedule.length ? <p className="cv-schedule-empty">กำลังโหลดกำหนดการ…</p>
        : !upcoming.length && !past.length ? <p className="cv-schedule-empty">ยังไม่มีคอลแลปที่ตั้งวันกำหนดส่งไว้</p>
          : mode === 'table' ? <ScheduleTable entries={visible} owner={owner} onOpen={onOpenAsset} />
          : mode === 'agenda' ? <>
            {upcoming.length ? <div className="cv-schedule-grid">{upcoming.map(entry => <ScheduleCard key={entry.asset.id} entry={entry} owner={owner} onOpen={() => onOpenAsset(entry.asset)} />)}</div>
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
                        <em>{formatDaysLeft(milestone.daysLeft)}<ProgressBadge milestone={milestone} owner={owner} /></em>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )) : <p className="cv-schedule-empty">ไม่มีกำหนดการที่กำลังจะถึง</p>}
          </div>}

      {past.length > 0 && mode !== 'table' && (
        <div className="cv-schedule-past">
          <button type="button" aria-expanded={showPast} onClick={() => setShowPast(value => !value)}>
            <ChevronDown aria-hidden="true" className={showPast ? 'is-open' : ''} />ผ่านไปแล้ว ({past.length})
            {overduePast > 0 && <span className="cv-schedule-progress is-overdue">ค้าง {overduePast}</span>}
          </button>
          {showPast && <div className="cv-schedule-grid">{past.map(entry => <ScheduleCard key={entry.asset.id} entry={entry} owner={owner} onOpen={() => onOpenAsset(entry.asset)} />)}</div>}
        </div>
      )}
    </section>
  );
};
