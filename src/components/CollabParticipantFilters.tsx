import React, { useId } from 'react';
import { Search } from 'lucide-react';
import type { ParticipantFilters } from '../lib/collabParticipantFilters';

interface Props {
  value: ParticipantFilters;
  onChange: (filters: ParticipantFilters) => void;
  groups: string[];
  showStatuses: boolean;
  count: number;
  total: number;
}

/** Shared controls for the owner editor, owner detail, preview and public detail. */
export const CollabParticipantFilters: React.FC<Props> = ({ value, onChange, groups, count, total }) => {
  const id = useId();
  const active = Boolean(value.query || value.group || value.dataStatus || value.imageStatus);
  return <div className="collab-participant-filters" role="search" aria-label="ค้นหาและกรองผู้เข้าร่วม">
    <label className="collab-participant-search" htmlFor={`${id}-search`}><Search aria-hidden="true" /><span className="sr-only">ค้นหาผู้เข้าร่วม</span><input id={`${id}-search`} type="search" value={value.query || ''} onChange={event => onChange({ ...value, query: event.target.value })} placeholder="ค้นหาครีเอเตอร์ ตัวละคร แท็ก หรือข้อมูล…" /></label>
    <div className="collab-participant-filter-options">
      <label>กลุ่ม<select value={value.group || ''} onChange={event => onChange({ ...value, group: event.target.value })}><option value="">ทุกกลุ่ม</option>{groups.map(group => <option key={group} value={group}>{group}</option>)}<option value="__ungrouped__">ยังไม่จัดกลุ่ม</option></select></label>
      {active && <button type="button" onClick={() => onChange({})}>ล้างตัวกรอง</button>}
    </div>
    <span className="collab-participant-result-count" role="status" aria-live="polite">แสดง {count} จาก {total} รายการ</span>
  </div>;
};
