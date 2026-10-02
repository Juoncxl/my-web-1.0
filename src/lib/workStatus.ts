import type { Asset, AssetCreatorWorkStatus, AssetStatus } from '../types';

/**
 * The progress statuses the Owner picks in the composer, shown the same way on cards and detail pages.
 * Older Works may carry retired values (in_review, blocked, finished) or only the legacy Asset status;
 * both are mapped onto this list.
 */
export type WorkStatusValue = Extract<AssetCreatorWorkStatus, 'not_started' | 'in_progress' | 'waiting_data' | 'needs_fix' | 'paused' | 'ready_to_release' | 'released'>;

export const WORK_STATUS_OPTIONS: Array<{ value: WorkStatusValue; emoji: string; name: string; label: string }> = [
  { value: 'not_started', emoji: '⚪', name: 'ยังไม่เริ่ม' },
  { value: 'in_progress', emoji: '🟡', name: 'กำลังทำ' },
  { value: 'waiting_data', emoji: '🟠', name: 'รอข้อมูล' },
  { value: 'needs_fix', emoji: '🟣', name: 'รอแก้ไข' },
  { value: 'paused', emoji: '⏸️', name: 'พักไว้' },
  { value: 'ready_to_release', emoji: '🚀', name: 'รอปล่อย' },
  { value: 'released', emoji: '✅', name: 'ปล่อยแล้ว' }
].map(option => ({ ...option, value: option.value as WorkStatusValue, label: `${option.emoji} ${option.name}` }));

const RETIRED: Partial<Record<string, WorkStatusValue>> = { in_review: 'needs_fix', blocked: 'needs_fix', finished: 'released' };

export function normalizeWorkStatus(value: unknown): WorkStatusValue | null {
  if (typeof value !== 'string') return null;
  if (WORK_STATUS_OPTIONS.some(option => option.value === value)) return value as WorkStatusValue;
  return RETIRED[value] || null;
}

export function workStatusFromLegacy(status: AssetStatus | undefined): WorkStatusValue {
  if (status === 'finished') return 'released';
  if (status === 'archived') return 'paused';
  if (status === 'in_progress') return 'in_progress';
  return 'not_started';
}

/** The legacy Asset status still drives filters and older readers. */
export function workStatusToLegacy(value: WorkStatusValue): AssetStatus {
  if (value === 'released') return 'finished';
  if (value === 'paused') return 'archived';
  if (value === 'not_started') return 'idea';
  return 'in_progress';
}

export function getWorkStatus(asset: Pick<Asset, 'status' | 'presentationMetadata'>): WorkStatusValue {
  return normalizeWorkStatus(asset.presentationMetadata?.workStatus) || workStatusFromLegacy(asset.status);
}

export function getWorkStatusDisplay(asset: Pick<Asset, 'status' | 'presentationMetadata'>) {
  const value = getWorkStatus(asset);
  return WORK_STATUS_OPTIONS.find(option => option.value === value) || WORK_STATUS_OPTIONS[0];
}
