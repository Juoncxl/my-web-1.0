import React, { useMemo } from 'react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import type { Asset } from '../types';
import { buildCollabSchedule, formatDaysLeft, scheduleUrgency, upcomingMilestones } from '../lib/collabSchedule';
import '../styles/collabSchedule.css';

interface CollabScheduleWidgetProps {
  assets: Asset[];
  onOpenSchedule: () => void;
  onOpenAsset: (asset: Asset) => void;
}

/** Home strip with the nearest Collab milestones and a way into the full schedule. */
export const CollabScheduleWidget: React.FC<CollabScheduleWidgetProps> = ({ assets, onOpenSchedule, onOpenAsset }) => {
  const upcoming = useMemo(() => upcomingMilestones(buildCollabSchedule(assets), 5), [assets]);
  if (!upcoming.length) return null;

  return (
    <section className="cv-schedule-widget" aria-labelledby="cv-schedule-widget-title">
      <header className="cv-schedule-widget-header">
        <div>
          <span className="cv-schedule-overline"><CalendarClock aria-hidden="true" />Collab Schedule</span>
          <h2 id="cv-schedule-widget-title">กำหนดการคอลแลปที่ใกล้ถึง</h2>
        </div>
        <button type="button" className="cv-schedule-link" onClick={onOpenSchedule}>ดูทั้งหมด<ArrowRight aria-hidden="true" /></button>
      </header>
      <ol className="cv-schedule-widget-list">
        {upcoming.map(({ entry, milestone }) => (
          <li key={milestone.id}>
            <button type="button" className={`cv-schedule-widget-item is-${scheduleUrgency(milestone.daysLeft)}`} onClick={() => onOpenAsset(entry.asset)}>
              <span className="cv-schedule-date" aria-hidden="true">
                <strong>{milestone.date.getDate()}</strong>
                <small>{milestone.date.toLocaleDateString('th-TH', { month: 'short' })}</small>
              </span>
              <span className="cv-schedule-widget-copy">
                <strong>{entry.name}</strong>
                <span>{milestone.label}{entry.platforms.length ? ` · ${entry.platforms.join(', ')}` : ''}</span>
                <em>{formatDaysLeft(milestone.daysLeft)}</em>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};
