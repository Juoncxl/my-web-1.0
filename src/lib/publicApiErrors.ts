/**
 * Messages the public (signed-out) API returns. Internal error text from Google,
 * Apps Script or Drive is logged on the server and never sent to visitors.
 */
export const WORK_NOT_FOUND_MESSAGE = 'ไม่พบผลงานนี้';
export const RATE_LIMITED_MESSAGE = 'ขอข้อมูลถี่เกินไป รอสักครู่แล้วลองใหม่';

export function publicErrorMessage(status: number): string {
  if (status === 404) return WORK_NOT_FOUND_MESSAGE;
  if (status === 429) return RATE_LIMITED_MESSAGE;
  if (status === 504) return 'ระบบตอบช้ากว่าปกติ ลองใหม่อีกครั้ง';
  if (status >= 400 && status < 500) return 'คำขอไม่ถูกต้อง';
  return 'โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง';
}
