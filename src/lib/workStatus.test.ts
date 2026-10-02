import { describe, expect, it } from 'vitest';
import { getWorkStatusDisplay, normalizeWorkStatus, workStatusToLegacy } from './workStatus';
import { displayDeadlineLabel } from './collabSchedule';

describe('work status', () => {
  it('shows the saved progress status, mapping retired values and legacy-only Works', () => {
    expect(getWorkStatusDisplay({ status: 'in_progress', presentationMetadata: { workStatus: 'ready_to_release' } as never }).label).toBe('🚀 รอปล่อย');
    expect(getWorkStatusDisplay({ status: 'in_progress', presentationMetadata: { workStatus: 'blocked' } as never }).label).toBe('🟣 รอแก้ไข');
    expect(getWorkStatusDisplay({ status: 'finished' }).label).toBe('✅ ปล่อยแล้ว');
    expect(getWorkStatusDisplay({ status: 'idea' }).label).toBe('⚪ ยังไม่เริ่ม');
    expect(normalizeWorkStatus('nonsense')).toBeNull();
  });

  it('keeps the legacy status valid for filters and older readers', () => {
    expect(workStatusToLegacy('released')).toBe('finished');
    expect(workStatusToLegacy('paused')).toBe('archived');
    expect(workStatusToLegacy('ready_to_release')).toBe('in_progress');
    expect(workStatusToLegacy('not_started')).toBe('idea');
  });

  it('reads old "เผยแพร่" Collab deadlines as releasing the bot', () => {
    expect(displayDeadlineLabel('🚀 เผยแพร่', 'publish')).toBe('🚀 ปล่อยบอท');
    expect(displayDeadlineLabel('เผยแพร่')).toBe('🚀 ปล่อยบอท');
    expect(displayDeadlineLabel('', 'image')).toBe('🖼️ ส่งรูป');
    expect(displayDeadlineLabel('ส่งตัวอย่างแชท', 'custom')).toBe('ส่งตัวอย่างแชท');
  });
});
