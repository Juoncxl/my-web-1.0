/**
 * Owner idea inbox rules. Ideas live in one private Drive JSON file; the server sets each idea's id and
 * creation time (never changed afterwards) and keeps the wording an edit replaced, so the Owner can
 * show when an idea was first written down.
 */
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

export interface IdeaFile { version: 1; ideas: Idea[] }

export type IdeaOp =
  | { op: 'add'; text: string; workId?: string | null }
  | { op: 'edit'; id: string; text: string }
  | { op: 'status'; id: string; status: IdeaStatus }
  | { op: 'move'; id: string; workId: string | null }
  | { op: 'delete'; id: string };

export const IDEA_LIMITS = { text: 4000, ideas: 2000, history: 50 } as const;

export class IdeaError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'IdeaError'; }
}

const STATUSES: readonly IdeaStatus[] = ['waiting', 'used', 'dropped'];
const WORK_ID_RE = /^asset_[A-Za-z0-9_-]{1,96}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isTime = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= IDEA_LIMITS.text ? text : null;
}

/** undefined → absent, null → no Work, otherwise must be a Work id. */
function cleanWorkId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return value === undefined ? undefined : null;
  return typeof value === 'string' && WORK_ID_RE.test(value) ? value : undefined;
}

function sanitizeIdea(value: unknown): Idea | null {
  if (!isRecord(value)) return null;
  const text = cleanText(value.text);
  const workId = value.workId === null ? null : cleanWorkId(value.workId);
  if (typeof value.id !== 'string' || !ID_RE.test(value.id) || !text || !STATUSES.includes(value.status as IdeaStatus)
    || workId === undefined || !isTime(value.createdAt) || !isTime(value.updatedAt)) return null;
  const history = (Array.isArray(value.history) ? value.history : [])
    .filter((item): item is { text: string; replacedAt: string } => isRecord(item) && typeof item.text === 'string' && isTime(item.replacedAt))
    .map(item => ({ text: item.text, replacedAt: item.replacedAt }))
    .slice(-IDEA_LIMITS.history);
  return { id: value.id, text, status: value.status as IdeaStatus, workId, createdAt: value.createdAt, updatedAt: value.updatedAt, history };
}

export function sanitizeIdeaFile(value: unknown): IdeaFile {
  const ideas = isRecord(value) && Array.isArray(value.ideas) ? value.ideas : [];
  return { version: 1, ideas: ideas.map(sanitizeIdea).filter((idea): idea is Idea => idea !== null).slice(0, IDEA_LIMITS.ideas) };
}

/** Accepts only the fields each operation needs; anything else (e.g. a client createdAt) is ignored. */
export function parseIdeaOp(value: unknown): IdeaOp | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && ID_RE.test(value.id) ? value.id : null;
  switch (value.op) {
    case 'add': {
      const text = cleanText(value.text);
      const workId = cleanWorkId(value.workId);
      if (!text || (value.workId !== undefined && value.workId !== null && value.workId !== '' && workId === undefined)) return null;
      return { op: 'add', text, workId: workId ?? null };
    }
    case 'edit': {
      const text = cleanText(value.text);
      return id && text ? { op: 'edit', id, text } : null;
    }
    case 'status':
      return id && STATUSES.includes(value.status as IdeaStatus) ? { op: 'status', id, status: value.status as IdeaStatus } : null;
    case 'move': {
      const workId = value.workId === null ? null : cleanWorkId(value.workId);
      return id && workId !== undefined ? { op: 'move', id, workId } : null;
    }
    case 'delete':
      return id ? { op: 'delete', id } : null;
    default:
      return null;
  }
}

/** After writing, did this operation's result really land? (Another tab may have written over it.) */
export function ideaOpLanded(stored: IdeaFile, op: IdeaOp, expected: IdeaFile, addedId?: string): boolean {
  if (op.op === 'add') return stored.ideas.some(idea => idea.id === addedId);
  if (op.op === 'delete') return !stored.ideas.some(idea => idea.id === op.id);
  const want = expected.ideas.find(idea => idea.id === op.id);
  const got = stored.ideas.find(idea => idea.id === op.id);
  return Boolean(want && got && want.text === got.text && want.status === got.status && want.workId === got.workId);
}

export function applyIdeaOp(file: IdeaFile, op: IdeaOp, now: Date, newId: () => string): IdeaFile {
  const at = now.toISOString();
  if (op.op === 'add') {
    if (file.ideas.length >= IDEA_LIMITS.ideas) throw new IdeaError('Idea inbox is full', 409);
    const idea: Idea = { id: newId(), text: op.text.trim(), status: 'waiting', workId: op.workId ?? null, createdAt: at, updatedAt: at, history: [] };
    return { version: 1, ideas: [idea, ...file.ideas] };
  }
  const index = file.ideas.findIndex(idea => idea.id === op.id);
  if (index < 0) throw new IdeaError('Idea was not found', 404);
  if (op.op === 'delete') return { version: 1, ideas: file.ideas.filter((_, i) => i !== index) };
  const current = file.ideas[index];
  let next: Idea = current;
  if (op.op === 'edit') {
    const text = op.text.trim();
    if (text === current.text) return file;
    next = { ...current, text, updatedAt: at, history: [...current.history, { text: current.text, replacedAt: at }].slice(-IDEA_LIMITS.history) };
  } else if (op.op === 'status') {
    if (op.status === current.status) return file;
    next = { ...current, status: op.status, updatedAt: at };
  } else {
    if (op.workId === current.workId) return file;
    next = { ...current, workId: op.workId, updatedAt: at };
  }
  return { version: 1, ideas: file.ideas.map((idea, i) => (i === index ? next : idea)) };
}
