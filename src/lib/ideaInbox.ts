import { OWNER_SESSION_EXPIRED_MESSAGE, ownerCsrfToken } from '../data/adapters/google/googleTransport';

/** Same shapes as src/server/cxlIdeas.ts; the server is the authority for ids and times. */
export type IdeaStatus = 'waiting' | 'used' | 'dropped';
export interface Idea {
  id: string;
  text: string;
  status: IdeaStatus;
  workId: string | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{ text: string; replacedAt: string }>;
}
export type IdeaOp =
  | { op: 'add'; text: string; workId?: string | null }
  | { op: 'edit'; id: string; text: string }
  | { op: 'status'; id: string; status: IdeaStatus }
  | { op: 'move'; id: string; workId: string | null }
  | { op: 'delete'; id: string };
export type IdeaFilter = IdeaStatus | 'all';

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = { waiting: 'รอใช้', used: 'ใช้แล้ว', dropped: 'ทิ้ง' };
const ENDPOINT = '/api/cxl/collab-progress?store=ideas';

function failure(status: number): Error {
  if (status === 401) return new Error(OWNER_SESSION_EXPIRED_MESSAGE);
  if (status === 503) return new Error('ยังไม่ได้เชื่อม Google Drive — เชื่อมจากเมนูบัญชีก่อน');
  if (status === 409) return new Error('กล่องไอเดียเต็มแล้ว (2,000 ไอเดีย) ลบไอเดียที่ไม่ใช้ก่อนนะ');
  return new Error('บันทึกไอเดียไม่สำเร็จ ลองอีกครั้ง');
}

async function read(response: Response): Promise<Idea[]> {
  const body = await response.json().catch(() => null) as { ok?: boolean; data?: { ideas?: Idea[] } } | null;
  if (!response.ok || !body?.ok) throw failure(response.status);
  return body.data?.ideas || [];
}

/** fetch rejects (offline, dropped connection) with an English TypeError; say it in Thai instead. */
async function request(init: RequestInit): Promise<Response> {
  try { return await fetch(ENDPOINT, { credentials: 'same-origin', ...init }); }
  catch { throw new Error('เชื่อมต่ออินเทอร์เน็ตไม่ได้ — ไอเดียยังไม่ถูกบันทึก ข้อความยังอยู่ในช่อง ลองอีกครั้ง'); }
}

export async function fetchIdeas(): Promise<Idea[]> {
  return read(await request({ headers: { Accept: 'application/json' } }));
}

export async function sendIdeaOp(op: IdeaOp): Promise<Idea[]> {
  const csrf = await ownerCsrfToken();
  return read(await request({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CXL-CSRF': csrf },
    body: JSON.stringify(op)
  }));
}

/** After a successful save, clear the box only if nothing new was typed meanwhile. */
export function draftAfterSave(current: string, submitted: string): string {
  return current === submitted ? '' : current;
}

/** "2 ต.ค. 2569 · 21:14 น." in Bangkok time, whatever the viewer's clock is set to. */
export function formatIdeaTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
  const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
  return `${day} · ${time} น.`;
}

export function filterIdeas(ideas: readonly Idea[], filter: IdeaFilter, workId?: string): Idea[] {
  return ideas.filter(idea => (filter === 'all' || idea.status === filter) && (!workId || idea.workId === workId));
}
