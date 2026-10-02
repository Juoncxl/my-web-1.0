import React, { useEffect, useState } from 'react';
import { draftAfterSave, fetchIdeas, filterIdeas, formatIdeaTime, IDEA_STATUS_LABELS, sendIdeaOp, type Idea, type IdeaFilter, type IdeaOp, type IdeaStatus } from '../lib/ideaInbox';

interface IdeaListProps {
  /** Show only this Work's ideas; new ideas are tied to it. */
  workId?: string;
  /** The Owner's Works, for "ย้ายไปงาน…" and the Work chip (global inbox only). */
  works?: Array<{ id: string; title: string }>;
}

const FILTERS: Array<[IdeaFilter, string]> = [['waiting', 'รอใช้'], ['used', 'ใช้แล้ว'], ['dropped', 'ทิ้ง'], ['all', 'ทั้งหมด']];
const STATUSES: IdeaStatus[] = ['waiting', 'used', 'dropped'];

/** Owner-only idea list: jot, filter, change status, move to a Work, edit (history kept), delete. */
export const IdeaList: React.FC<IdeaListProps> = ({ workId, works }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IdeaFilter>('waiting');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIdeas()
      .then(list => { if (!cancelled) setIdeas(list); })
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'โหลดไอเดียไม่สำเร็จ'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const run = async (op: IdeaOp): Promise<boolean> => {
    setBusy(true); setError('');
    try { setIdeas(await sendIdeaOp(op)); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกไอเดียไม่สำเร็จ ลองอีกครั้ง'); return false; }
    finally { setBusy(false); }
  };

  const add = async () => {
    if (!draft.trim() || busy) return;
    // The typed text stays in the box until the server has saved it.
    const submitted = draft;
    if (await run({ op: 'add', text: submitted, workId: workId ?? null })) { setDraft(current => draftAfterSave(current, submitted)); setFilter('waiting'); }
  };
  const saveEdit = async (id: string) => { if (await run({ op: 'edit', id, text: editText })) setEditingId(null); };
  const remove = (id: string) => { if (window.confirm('ลบไอเดียนี้ถาวรหรือไม่? (ถ้าแค่ไม่ใช้แล้ว ให้กด “ทิ้ง” แทน วันที่จดจะยังอยู่)')) void run({ op: 'delete', id }); };

  const visible = filterIdeas(ideas, filter, workId);
  const workTitle = (id: string) => works?.find(work => work.id === id)?.title || 'งานที่ผูกไว้';

  return <div className="cv-idea-list">
    <div className="cv-idea-compose">
      <textarea value={draft} rows={2} placeholder={workId ? 'จดไอเดียของงานนี้… (Enter = จด, Shift+Enter = ขึ้นบรรทัดใหม่)' : 'จดไอเดียไว้ก่อน… (Enter = จด, Shift+Enter = ขึ้นบรรทัดใหม่)'}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void add(); } }} />
      <button type="button" onClick={() => void add()} disabled={busy || !draft.trim()}>จด</button>
    </div>
    {error && <p className="cv-idea-error" role="alert">{error}</p>}
    <div className="cv-idea-filters" role="group" aria-label="กรองไอเดีย">
      {FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {label} <span>{filterIdeas(ideas, value, workId).length}</span>
      </button>)}
    </div>
    {loading ? <p className="cv-idea-empty">กำลังโหลดไอเดีย…</p>
      : visible.length === 0 ? <p className="cv-idea-empty">ยังไม่มีไอเดียในหมวดนี้</p>
      : <ul className="cv-idea-items">{visible.map(idea => <li key={idea.id} className={`is-${idea.status}`}>
        {editingId === idea.id
          ? <div className="cv-idea-edit"><textarea value={editText} rows={3} onChange={event => setEditText(event.target.value)} /><div><button type="button" onClick={() => void saveEdit(idea.id)} disabled={busy || !editText.trim()}>บันทึก</button><button type="button" onClick={() => setEditingId(null)}>ยกเลิก</button></div></div>
          : <p className="cv-idea-text">{idea.text}</p>}
        <div className="cv-idea-meta">
          <span>จดเมื่อ {formatIdeaTime(idea.createdAt)}</span>
          {idea.history.length > 0 && <span>แก้ไขล่าสุด {formatIdeaTime(idea.updatedAt)}</span>}
          {works && idea.workId && <a href={`/work/${idea.workId}`} className="cv-idea-work-chip">{workTitle(idea.workId)}</a>}
        </div>
        <div className="cv-idea-actions">
          <div className="cv-idea-status" role="group" aria-label="สถานะไอเดีย">
            {STATUSES.map(status => <button type="button" key={status} className={idea.status === status ? 'is-active' : ''} aria-pressed={idea.status === status} disabled={busy} onClick={() => void run({ op: 'status', id: idea.id, status })}>{IDEA_STATUS_LABELS[status]}</button>)}
          </div>
          {works && <select value={idea.workId || ''} disabled={busy} aria-label="ย้ายไปงาน" onChange={event => void run({ op: 'move', id: idea.id, workId: event.target.value || null })}>
            <option value="">ย้ายไปงาน… (ยังไม่ผูก)</option>
            {works.map(work => <option key={work.id} value={work.id}>{work.title}</option>)}
          </select>}
          <button type="button" onClick={() => { setEditingId(idea.id); setEditText(idea.text); }} disabled={busy} aria-label="แก้ข้อความ">✏️</button>
          {idea.history.length > 0 && <button type="button" onClick={() => setHistoryId(historyId === idea.id ? null : idea.id)} aria-expanded={historyId === idea.id} aria-label="ประวัติการแก้ไข">🕘</button>}
          <button type="button" onClick={() => remove(idea.id)} disabled={busy} aria-label="ลบไอเดีย">🗑</button>
        </div>
        {historyId === idea.id && <ol className="cv-idea-history">{[...idea.history].reverse().map(entry => <li key={entry.replacedAt}><small>ก่อนแก้เมื่อ {formatIdeaTime(entry.replacedAt)}</small><p>{entry.text}</p></li>)}</ol>}
      </li>)}</ul>}
  </div>;
};
