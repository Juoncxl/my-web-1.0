import { describe, expect, it } from 'vitest';
import { summarizeCollabParticipants } from './collabParticipantSummary';

describe('Collab participant summary', () => {
  it('counts approved data and images and lists who still owes what', () => {
    const summary = summarizeCollabParticipants([
      { id: 'a', creatorName: 'น้ำ', dataStatus: 'approved', imageStatus: 'approved' },
      { id: 'b', creatorName: 'เอมิน', dataStatus: 'approved', imageStatus: 'not_submitted' },
      { id: 'c', creatorName: '', dataStatus: 'reviewing', imageStatus: 'needs_fix' }
    ]);
    expect(summary).toEqual({
      total: 3, dataApproved: 2, imageApproved: 1,
      missing: [{ id: 'b', name: 'เอมิน', items: ['รูป'] }, { id: 'c', name: 'ยังไม่ได้ระบุชื่อ', items: ['ข้อมูล', 'รูป'] }]
    });
  });

  it('stays silent when statuses are not shown', () => {
    expect(summarizeCollabParticipants([{ id: 'a', creatorName: 'น้ำ' }])).toBeNull();
  });
});
