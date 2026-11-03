import type { AssetCollaborationParticipant } from '../types';

type Status = AssetCollaborationParticipant['dataStatus'];
export interface ParticipantFilters { query?: string; group?: string; dataStatus?: Status | ''; imageStatus?: Status | ''; }
interface SearchableParticipant {
  id: string;
  creatorName?: string;
  houseTag?: string;
  externalWorkName?: string;
  detailLabel?: string;
  groups?: string[];
  notes?: string;
  platforms?: string[];
  dataStatus?: Status;
  imageStatus?: Status;
}

const key = (value: string) => value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLocaleLowerCase();

export function normalizeCollabGroups(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.filter((value): value is string => typeof value === 'string').map(value => value.trim().slice(0, 100)).filter(value => {
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 80);
}

export function getCollabGroups(groups: unknown, participants: readonly SearchableParticipant[]): string[] {
  return normalizeCollabGroups([...normalizeCollabGroups(groups), ...participants.flatMap(person => normalizeCollabGroups(person.groups))]);
}

/** Call with the public snapshot on public surfaces: private notes/contact are never searched. */
export function filterCollabParticipants<T extends SearchableParticipant>(participants: readonly T[], filters: ParticipantFilters): T[] {
  const statusLabels: Record<Status, string> = { not_submitted: 'ยังไม่ส่ง', reviewing: 'รอตรวจ', needs_fix: 'ต้องแก้', approved: 'ผ่านแล้ว' };
  const statusQueries: Array<{ field: 'dataStatus' | 'imageStatus'; status: Status }> = [];
  let query = key(filters.query || '');
  for (const [status, label] of Object.entries(statusLabels)) {
    for (const [field, kind] of [['dataStatus', 'ข้อมูล'], ['imageStatus', 'รูป']] as const) {
      const pattern = new RegExp(`(?:${kind}\\s*${label}|${label}\\s*${kind})`, 'g');
      query = query.replace(pattern, () => { statusQueries.push({ field, status: status as Status }); return ' '; });
    }
  }
  const terms = query.split(/\s+/).filter(Boolean);
  return participants.filter(person => {
    const groups = normalizeCollabGroups(person.groups);
    if (filters.group === '__ungrouped__' && groups.length) return false;
    if (filters.group && filters.group !== '__ungrouped__' && !groups.some(group => key(group) === key(filters.group!))) return false;
    if (filters.dataStatus && person.dataStatus !== filters.dataStatus) return false;
    if (filters.imageStatus && person.imageStatus !== filters.imageStatus) return false;
    if (!statusQueries.every(({ field, status }) => person[field] === status)) return false;
    const haystack = key([person.creatorName, person.houseTag, person.externalWorkName, person.detailLabel, person.notes, person.dataStatus && statusLabels[person.dataStatus], person.imageStatus && statusLabels[person.imageStatus], ...(person.platforms || []), ...groups].filter(Boolean).join(' '));
    return terms.every(term => haystack.includes(term));
  });
}
