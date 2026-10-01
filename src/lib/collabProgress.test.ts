import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { buildCollabSchedule, milestoneKey, milestoneProgress } from './collabSchedule';
import { layoutScheduleImage } from './collabScheduleImage';
import { applyProgressChange, sanitizeProgress } from '../../api/cxl/collab-progress';

const TODAY = new Date(2026, 9, 10);
const collab = (id: string, deadlines: Array<[string, string]>, withIds = true): Asset => ({
  id, title: id, category: 'collab', content: '', tags: [], createdAt: '2026-10-01', userId: 'owner',
  publicCollaboration: {
    name: id, sharedTag: '', platforms: ['rubii AI'], sharedInformation: [], participants: [],
    deadlines: deadlines.map(([label, date], index) => ({ ...(withIds ? { id: `d${index}` } : {}), kind: 'custom' as const, label, date }))
  }
} as unknown as Asset);

describe('Owner Collab progress', () => {
  it('keys milestones without deadline ids, so public projections still match', () => {
    const [entry] = buildCollabSchedule([collab('asset_a', [['ส่งรูป', '2026-10-12']], false)], TODAY);
    expect(entry.milestones[0].id).toBe(milestoneKey('asset_a', '2026-10-12', 'ส่งรูป'));
    expect(entry.milestones[0].id).toBe('asset_a|2026-10-12|ส่งรูป');
  });

  it('classifies early, on-time, late, overdue and open milestones', () => {
    const [entry] = buildCollabSchedule([collab('asset_a', [['past', '2026-10-05'], ['soon', '2026-10-12']])], TODAY);
    const [past, soon] = entry.milestones;
    expect(milestoneProgress(past, {})).toBe('overdue');
    expect(milestoneProgress(soon, {})).toBe('open');
    expect(milestoneProgress(soon, { [soon.id]: new Date(2026, 9, 9, 15).toISOString() })).toBe('early');
    expect(milestoneProgress(soon, { [soon.id]: new Date(2026, 9, 12, 23).toISOString() })).toBe('on-time');
    expect(milestoneProgress(past, { [past.id]: new Date(2026, 9, 7).toISOString() })).toBe('late');
  });

  it('keeps the first done time and removes untick', () => {
    const first = applyProgressChange({}, 'asset_a|2026-10-12|x', true, new Date('2026-10-01T00:00:00Z'));
    expect(applyProgressChange(first, 'asset_a|2026-10-12|x', true, new Date('2026-10-05T00:00:00Z'))).toEqual(first);
    expect(applyProgressChange(first, 'asset_a|2026-10-12|x', false)).toEqual({});
  });

  it('drops malformed stored entries', () => {
    expect(sanitizeProgress({ 'asset_a|2026-10-12|x': '2026-10-01T00:00:00Z', bad: '2026-10-01', 'asset_b|2026-10-12|y': 'nope' }))
      .toEqual({ 'asset_a|2026-10-12|x': '2026-10-01T00:00:00Z' });
    expect(sanitizeProgress(['x'])).toEqual({});
  });
});

describe('schedule image layout', () => {
  it('fits rows to the canvas and counts the rest', () => {
    const deadlines = Array.from({ length: 20 }, (_, index): [string, string] => [`m${index}`, `2026-10-${String(11 + index).padStart(2, '0')}`]);
    const { rows, overflow } = layoutScheduleImage(buildCollabSchedule([collab('asset_a', deadlines)], TODAY));
    const items = rows.filter(row => row.kind === 'item').length;
    expect(items).toBeGreaterThan(5);
    expect(items + overflow).toBe(20);
  });
});
