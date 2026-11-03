import React from 'react';
import { ExternalLink, Link2, Plus, X } from 'lucide-react';
import type { AssetCollaborationLink } from '../types';
import { normalizeCollabLinks, publicCollabLinks, safeCollabLinkUrl } from '../lib/collabLinks';

export function CollabLinks({ links, owner = false }: { links?: AssetCollaborationLink[]; owner?: boolean }) {
  const visible = owner ? normalizeCollabLinks(links) : publicCollabLinks(links);
  const valid = visible.filter(link => safeCollabLinkUrl(link.url));
  if (!valid.length) return null;
  return <div className="collab-source-links" aria-label="เอกสาร / ไฟล์ที่เกี่ยวข้อง">{valid.map(link => <a key={link.id} href={safeCollabLinkUrl(link.url)!} target="_blank" rel="noopener noreferrer" title={`${link.label || 'เปิดลิงก์'} — เปิดแท็บใหม่`}><ExternalLink aria-hidden="true" /><span>{link.label.trim() || new URL(link.url.trim()).hostname}</span>{owner && link.visibility !== 'public' && <small>เฉพาะฉัน</small>}</a>)}</div>;
}

export function CollabLinksEditor({ links, onChange, label }: { links?: AssetCollaborationLink[]; onChange: (links: AssetCollaborationLink[]) => void; label: string }) {
  const rows = normalizeCollabLinks(links);
  const update = (id: string, change: Partial<AssetCollaborationLink>) => onChange(rows.map(row => row.id === id ? { ...row, ...change } : row));
  return <div className="collab-links-editor"><div className="collab-links-editor-heading"><strong><Link2 aria-hidden="true" />{label}</strong><button type="button" className="csp-secondary-button" disabled={rows.length >= 30} onClick={() => onChange([...rows, { id: crypto.randomUUID(), label: '', url: '', visibility: 'private' }])}><Plus aria-hidden="true" />เพิ่มลิงก์</button></div>
    {rows.map((link, index) => {
      const invalid = Boolean(link.url.trim() && !safeCollabLinkUrl(link.url));
      return <div className="collab-link-editor-row" key={link.id}>
        <label>ชื่อที่แสดง<input aria-label={`${label} ชื่อลิงก์ ${index + 1}`} maxLength={160} value={link.label} placeholder="เช่น ข้อมูลตัวละคร / โฟลเดอร์รูป" onChange={event => update(link.id, { label: event.target.value })} /></label>
        <label>ลิงก์<input aria-label={`${label} URL ${index + 1}`} type="url" maxLength={2048} value={link.url} aria-invalid={invalid} placeholder="https://…" onChange={event => update(link.id, { url: event.target.value })} />{invalid && <small role="alert">ใส่ลิงก์เต็มที่ขึ้นต้นด้วย https:// หรือ http://</small>}</label>
        <label>การมองเห็น<select aria-label={`${label} การมองเห็น ${index + 1}`} value={link.visibility} onChange={event => update(link.id, { visibility: event.target.value === 'public' ? 'public' : 'private' })}><option value="private">เฉพาะฉัน</option><option value="public">สาธารณะ</option></select></label>
        {safeCollabLinkUrl(link.url) && <a className="collab-link-open" href={safeCollabLinkUrl(link.url)!} target="_blank" rel="noopener noreferrer" aria-label={`เปิด ${link.label || `ลิงก์ ${index + 1}`} ในแท็บใหม่`}><ExternalLink aria-hidden="true" /></a>}
        <button type="button" className="collab-link-remove" aria-label={`นำลิงก์ ${link.label || index + 1} ออก`} onClick={() => onChange(rows.filter(row => row.id !== link.id))}><X aria-hidden="true" /></button>
      </div>;
    })}
  </div>;
}
