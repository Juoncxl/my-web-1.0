type SubmissionStatus = 'not_submitted' | 'reviewing' | 'needs_fix' | 'approved';

interface ParticipantLike {
  id: string;
  creatorName?: string;
  dataStatus?: SubmissionStatus | null;
  imageStatus?: SubmissionStatus | null;
}

export interface CollabParticipantSummary {
  total: number;
  dataApproved: number;
  imageApproved: number;
  /** Who still owes something, in list order. */
  missing: Array<{ id: string; name: string; items: Array<'ข้อมูล' | 'รูป'> }>;
}

/**
 * "ข้อมูลผ่าน 8/8 · รูปผ่าน 6/8" for the top of a Collab's participant list. Returns null when no
 * participant carries a submission status (e.g. the Owner did not publish statuses), so nothing is implied.
 */
export function summarizeCollabParticipants(participants: readonly ParticipantLike[]): CollabParticipantSummary | null {
  if (!participants.some(participant => participant.dataStatus || participant.imageStatus)) return null;
  const missing: CollabParticipantSummary['missing'] = [];
  let dataApproved = 0;
  let imageApproved = 0;
  participants.forEach(participant => {
    const items: Array<'ข้อมูล' | 'รูป'> = [];
    if (participant.dataStatus === 'approved') dataApproved += 1; else items.push('ข้อมูล');
    if (participant.imageStatus === 'approved') imageApproved += 1; else items.push('รูป');
    if (items.length) missing.push({ id: participant.id, name: participant.creatorName?.trim() || 'ยังไม่ได้ระบุชื่อ', items });
  });
  return { total: participants.length, dataApproved, imageApproved, missing };
}
