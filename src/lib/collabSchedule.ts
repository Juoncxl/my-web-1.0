import type { Asset, AssetCollaborationDeadline } from '../types';

/** One dated milestone of a Collab, e.g. "📋 ส่งข้อมูล" on 2 Oct. */
export interface CollabScheduleMilestone {
  id: string;
  label: string;
  date: Date;
  isoDate: string;
  daysLeft: number;
}

/** A Collab Work with its dated milestones, ready for the schedule views. */
export interface CollabScheduleEntry {
  asset: Asset;
  name: string;
  platforms: string[];
  milestones: CollabScheduleMilestone[];
  /** The first milestone that has not passed yet; null when everything is over. */
  next: CollabScheduleMilestone | null;
}

export interface CollabScheduleMonth {
  key: string;
  label: string;
  items: Array<{ entry: CollabScheduleEntry; milestone: CollabScheduleMilestone }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LABELS: Record<AssetCollaborationDeadline['kind'], string> = {
  data: '📋 ส่งข้อมูล',
  image: '🖼️ ส่งรูป',
  publish: '🚀 เผยแพร่',
  custom: '📌 กำหนดการ'
};

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Deadlines are stored as YYYY-MM-DD; anything else is not placed on the schedule. */
function parseDeadlineDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildCollabSchedule(assets: readonly Asset[], today = new Date()): CollabScheduleEntry[] {
  const base = startOfDay(today).getTime();
  const entries: CollabScheduleEntry[] = [];
  for (const asset of assets) {
    const collaboration = asset.publicCollaboration || asset.collaboration;
    if (asset.category !== 'collab' || !collaboration || asset.deletedAt) continue;
    const milestones = (collaboration.deadlines || []).flatMap(deadline => {
      const date = parseDeadlineDate(deadline.date);
      if (!date) return [];
      return [{
        id: `${asset.id}:${deadline.id}`,
        label: deadline.label?.trim() || DEFAULT_LABELS[deadline.kind] || DEFAULT_LABELS.custom,
        date,
        isoDate: deadline.date.slice(0, 10),
        daysLeft: Math.round((date.getTime() - base) / DAY_MS)
      }];
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (!milestones.length) continue;
    entries.push({
      asset,
      name: collaboration.name?.trim() || asset.title,
      platforms: [...(collaboration.platforms || [])],
      milestones,
      next: milestones.find(item => item.daysLeft >= 0) || null
    });
  }
  // Upcoming Collabs by their nearest milestone; finished ones last, most recent first.
  return entries.sort((a, b) => {
    if (a.next && b.next) return a.next.date.getTime() - b.next.date.getTime();
    if (a.next) return -1;
    if (b.next) return 1;
    return b.milestones[b.milestones.length - 1].date.getTime() - a.milestones[a.milestones.length - 1].date.getTime();
  });
}

export function filterScheduleByPlatform(entries: readonly CollabScheduleEntry[], platform: string | null): CollabScheduleEntry[] {
  if (!platform) return [...entries];
  const needle = platform.toLocaleLowerCase();
  return entries.filter(entry => entry.platforms.some(item => item.toLocaleLowerCase() === needle));
}

export function collectSchedulePlatforms(entries: readonly CollabScheduleEntry[]): string[] {
  const seen = new Map<string, string>();
  entries.forEach(entry => entry.platforms.forEach(platform => {
    const key = platform.trim().toLocaleLowerCase();
    if (key && !seen.has(key)) seen.set(key, platform.trim());
  }));
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** The nearest upcoming milestones across all Collabs, for the Home widget. */
export function upcomingMilestones(entries: readonly CollabScheduleEntry[], limit = 5) {
  return entries
    .flatMap(entry => entry.milestones.filter(item => item.daysLeft >= 0).map(milestone => ({ entry, milestone })))
    .sort((a, b) => a.milestone.date.getTime() - b.milestone.date.getTime())
    .slice(0, limit);
}

export function groupScheduleByMonth(entries: readonly CollabScheduleEntry[], includePast = false): CollabScheduleMonth[] {
  const months = new Map<string, CollabScheduleMonth>();
  entries
    .flatMap(entry => entry.milestones.filter(item => includePast || item.daysLeft >= 0).map(milestone => ({ entry, milestone })))
    .sort((a, b) => a.milestone.date.getTime() - b.milestone.date.getTime())
    .forEach(item => {
      const key = item.milestone.isoDate.slice(0, 7);
      if (!months.has(key)) months.set(key, { key, label: formatMonthLabel(item.milestone.date), items: [] });
      months.get(key)!.items.push(item);
    });
  return [...months.values()];
}

export function formatShortThaiDate(date: Date): string {
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return 'ผ่านไปแล้ว';
  if (daysLeft === 0) return 'วันนี้';
  if (daysLeft === 1) return 'พรุ่งนี้';
  return `อีก ${daysLeft} วัน`;
}

export type ScheduleUrgency = 'today' | 'soon' | 'week' | 'later' | 'past';

export function scheduleUrgency(daysLeft: number): ScheduleUrgency {
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 1) return 'today';
  if (daysLeft <= 3) return 'soon';
  if (daysLeft <= 7) return 'week';
  return 'later';
}

/** Plain-text schedule for pasting into chats or Notion. */
export function scheduleToText(entries: readonly CollabScheduleEntry[], title = 'กำหนดการคอลแลป'): string {
  const lines = [`🗓️ ${title}`];
  for (const month of groupScheduleByMonth(entries)) {
    lines.push('', `— ${month.label} —`);
    for (const { entry, milestone } of month.items) {
      const apps = entry.platforms.length ? ` (${entry.platforms.join(', ')})` : '';
      lines.push(`${formatShortThaiDate(milestone.date)} · ${entry.name}${apps} · ${milestone.label}`);
    }
  }
  if (lines.length === 1) lines.push('', 'ยังไม่มีกำหนดการที่กำลังจะถึง');
  return lines.join('\n');
}
