import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import {
  buildCollabSchedule,
  collectSchedulePlatforms,
  filterScheduleByPlatform,
  formatDaysLeft,
  groupScheduleByMonth,
  scheduleToText,
  upcomingMilestones
} from './collabSchedule';

const collab = (id: string, name: string, platforms: string[], deadlines: Array<[string, string]>): Asset => ({
  id, userId: '', title: name, category: 'collab', authorName: 'Juon', icon: { type: 'emoji', value: '🤝' },
  content: '', isPublic: true, visibility: 'public', status: 'finished', createdAt: '2026-09-01', updatedAt: '2026-09-01', tags: [],
  publicCollaboration: {
    name, platforms, sharedTag: '', sharedInformation: [], participants: [], visibilityPolicy: {} as never,
    deadlines: deadlines.map(([label, date], index) => ({ id: `d${index}`, kind: 'custom' as const, label, date }))
  }
} as unknown as Asset);

const today = new Date(2026, 8, 30);
const assets = [
  collab('far', 'นรกแดนตาย', ['Rubii ai'], [['🚀 เผยแพร่', '2026-10-15']]),
  collab('near', 'คลองเลื่อยเหล็ก', ['Doki chat'], [['📋 ส่งข้อมูล', '2026-10-02'], ['🖼️ ส่งรูป', '2026-10-05']]),
  collab('done', 'จบแล้ว', ['Rubii ai'], [['🚀 เผยแพร่', '2026-09-01']]),
  collab('nodate', 'ไม่มีวัน', [], [['ส่งข้อมูล', 'ยังไม่กำหนด']]),
  { ...collab('work', 'ไม่ใช่คอลแลป', [], [['x', '2026-10-01']]), category: 'prompts' } as Asset
];

describe('Collab schedule', () => {
  it('orders Collabs by their nearest upcoming milestone and puts finished ones last', () => {
    const schedule = buildCollabSchedule(assets, today);
    expect(schedule.map(entry => entry.asset.id)).toEqual(['near', 'far', 'done']);
    expect(schedule[0].next?.label).toBe('📋 ส่งข้อมูล');
    expect(schedule[0].next?.daysLeft).toBe(2);
    expect(schedule[2].next).toBeNull();
  });

  it('lists the nearest milestones across Collabs for the Home strip', () => {
    const upcoming = upcomingMilestones(buildCollabSchedule(assets, today), 2);
    expect(upcoming.map(item => item.milestone.isoDate)).toEqual(['2026-10-02', '2026-10-05']);
  });

  it('filters by app case-insensitively and collects unique apps', () => {
    const schedule = buildCollabSchedule(assets, today);
    expect(collectSchedulePlatforms(schedule)).toEqual(['Doki chat', 'Rubii ai']);
    expect(filterScheduleByPlatform(schedule, 'rubii AI').map(entry => entry.asset.id)).toEqual(['far', 'done']);
  });

  it('groups upcoming milestones by month and exports readable text', () => {
    const schedule = buildCollabSchedule(assets, today);
    const months = groupScheduleByMonth(schedule);
    expect(months).toHaveLength(1);
    expect(months[0].items).toHaveLength(3);
    const text = scheduleToText(schedule);
    expect(text).toContain('คลองเลื่อยเหล็ก (Doki chat) · 📋 ส่งข้อมูล');
    expect(text).not.toContain('จบแล้ว');
  });

  it('describes countdowns in Thai', () => {
    expect([formatDaysLeft(0), formatDaysLeft(1), formatDaysLeft(4), formatDaysLeft(-1)]).toEqual(['วันนี้', 'พรุ่งนี้', 'อีก 4 วัน', 'ผ่านไปแล้ว']);
  });
});
