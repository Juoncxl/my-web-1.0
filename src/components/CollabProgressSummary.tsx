import React from 'react';
import type { CollabParticipantSummary } from '../lib/collabParticipantSummary';

export function CollabProgressSummary({ summary }: { summary: CollabParticipantSummary | null }) {
  if (!summary) return null;
  return <div className="work-detail-participant-summary">
    <strong>ข้อมูลผ่าน {summary.dataApproved}/{summary.total} · รูปผ่าน {summary.imageApproved}/{summary.total}</strong>
    {summary.missing.length ? <details className="collab-missing-list"><summary>ดูรายการที่ยังขาด ({summary.missing.length})</summary><ul>{summary.missing.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.items.join(' · ')}</span></li>)}</ul></details> : <span>ส่งครบทุกคนแล้ว 🎉</span>}
  </div>;
}
