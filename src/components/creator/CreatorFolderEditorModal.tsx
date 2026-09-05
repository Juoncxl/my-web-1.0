import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, BookOpen, Briefcase, Check, FileText, Folder, FolderOpen, GripVertical, Palette, Plus, Trash2, X } from 'lucide-react';
import type { Asset, Folder as FolderRecord } from '../../types';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import { DEFAULT_FOLDER_DISPLAY_NAME, DEFAULT_FOLDER_ICON, DEFAULT_FOLDER_STYLE, DEFAULT_FOLDER_SUBTITLE, DEFAULT_FOLDER_TITLE, FOLDER_STYLES, getFolderPresentation, normalizeFolderConfig, validateFolderConfig, type CreatorWidgetConfig, type FolderStyle } from './creatorWidgetModel';

interface Props {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  folders: FolderRecord[];
  assets: Asset[];
  onSave: (config: CreatorWidgetConfig, displayName: string) => void;
  onCancel: () => void;
  onOpenFolder?: (folderId: string) => void;
}

const styleLabels: Record<FolderStyle, string> = { card: 'Card (4 cols)', open: 'Open (6 cols)', list: 'List (4 cols)', cute: 'Cute Aesthetic' };
const iconChoices = ['folder', 'folder-open', 'archive', 'briefcase', 'book', 'notes', 'link', 'palette'];
const iconComponents: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = { folder: Folder, 'folder-open': FolderOpen, archive: Archive, briefcase: Briefcase, book: BookOpen, notes: FileText, link: FileText, palette: Palette };

function FolderEditorIcon({ value }: { value?: string }) {
  const Icon = iconComponents[(value || DEFAULT_FOLDER_ICON).toLowerCase()] || Folder;
  return <Icon aria-hidden={true} />;
}

function createDraft(config: CreatorWidgetConfig, displayName: string | undefined, folders: FolderRecord[]) {
  const normalized = normalizeFolderConfig(config);
  // An empty order is the initial default for a new widget. Start with the
  // real profile folders in the editor so the owner can opt out explicitly.
  const order = Array.isArray(config.folderOrder) && config.folderOrder.length > 0
    ? [...(normalized.folderOrder || [])]
    : folders.map(folder => folder.id);
  // Keep malformed public ids in the draft so validation can explain what is
  // wrong instead of silently rewriting persisted data while the modal opens.
  const publicIds = [...(normalized.folderPublicIds || [])];
  return {
    displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : (normalized.title || DEFAULT_FOLDER_DISPLAY_NAME),
    config: {
      ...normalized,
      folderTitle: normalized.folderTitle || DEFAULT_FOLDER_TITLE,
      folderSubtitle: normalized.folderSubtitle || DEFAULT_FOLDER_SUBTITLE,
      folderIcon: normalized.folderIcon || DEFAULT_FOLDER_ICON,
      folderStyle: normalized.folderStyle || DEFAULT_FOLDER_STYLE,
      folderOrder: order,
      folderPublicIds: publicIds,
      folderShowItemCount: normalized.folderShowItemCount !== false,
      folderShowPreviewItems: normalized.folderShowPreviewItems !== false,
      folderShowDescription: normalized.folderShowDescription !== false,
      folderShowItemIcons: normalized.folderShowItemIcons !== false
    } as CreatorWidgetConfig
  };
}

export const CreatorFolderEditorModal: React.FC<Props> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, folders, assets, onSave, onCancel, onOpenFolder }) => {
  const initial = useRef(createDraft(config, displayName, folders));
  const [name, setName] = useState(initial.current.displayName);
  const [draft, setDraft] = useState<CreatorWidgetConfig>(initial.current.config);
  const [discard, setDiscard] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const initialJSON = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: name, config: draft }) !== initialJSON.current;
  const dirtyRef = useRef(dirty);
  const discardRef = useRef(discard);
  const cancelRef = useRef(onCancel);
  dirtyRef.current = dirty; discardRef.current = discard; cancelRef.current = onCancel;
  const errors = useMemo(() => validateFolderConfig({ ...draft, title: name }, name, folders.map(folder => folder.id)), [draft, folders, name]);
  const preview = useMemo(() => getFolderPresentation({ ...draft, title: name }, folders, assets, previewDisplayName), [assets, draft, folders, name, previewDisplayName]);
  const canSave = dirty && Object.keys(errors).length === 0;
  const selectedIds = draft.folderOrder || [];
  const selectedFolders = selectedIds.map(id => folders.find(folder => folder.id === id)).filter((folder): folder is FolderRecord => Boolean(folder));
  const availableFolders = folders.filter(folder => !selectedIds.includes(folder.id));

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (discardRef.current) setDiscard(false); else if (dirtyRef.current) setDiscard(true); else cancelRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])'));
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); release(); opener?.focus(); };
  }, []);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraft(previous => ({ ...previous, ...patch }));
  const moveFolder = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= selectedIds.length) return; const next = [...selectedIds]; [next[index], next[target]] = [next[target], next[index]]; set({ folderOrder: next }); };
  const removeFolder = (id: string) => set({ folderOrder: selectedIds.filter(value => value !== id), folderPublicIds: (draft.folderPublicIds || []).filter(value => value !== id) });
  const addFolder = (id: string) => set({ folderOrder: [...selectedIds, id] });
  const requestClose = () => dirty ? setDiscard(true) : onCancel();
  const commit = () => { if (!canSave) return; const title = name.trim() || DEFAULT_FOLDER_DISPLAY_NAME; onSave({ ...draft, title, folderTitle: (draft.folderTitle || DEFAULT_FOLDER_TITLE).trim(), folderSubtitle: (draft.folderSubtitle || DEFAULT_FOLDER_SUBTITLE).trim(), folderIcon: (draft.folderIcon || DEFAULT_FOLDER_ICON).trim() || DEFAULT_FOLDER_ICON, folderOrder: [...(draft.folderOrder || [])], folderPublicIds: [...(draft.folderPublicIds || [])] }, title); };

  return <div className="csp-folder-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-folder-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-folder-editor-title">
      <div className="csp-folder-editor-ribbon"><span><i />การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</span><small>Sunset Coastal · Cute Envelope</small></div>
      <header className="csp-folder-editor-header"><div className="csp-folder-editor-mark"><Folder aria-hidden="true" /></div><div><h2 id="csp-folder-editor-title">แก้ไข Folder Widget</h2><p>จัดระเบียบผลงานเป็น pocket และดูผลบน Notion แบบเรียลไทม์</p></div><button type="button" onClick={requestClose} aria-label="ปิด Folder editor"><X /></button></header>
      <form onSubmit={event => { event.preventDefault(); commit(); }}>
        <div className="csp-folder-editor-layout">
          <section className="csp-folder-editor-column csp-folder-inspector" aria-label="Folder Inspector">
            <div className="csp-folder-section-title"><span>01</span><strong>FOLDER &amp; IDENTITY</strong><small>ข้อมูลโฟลเดอร์</small></div>
            <div className="csp-folder-editor-grid-two"><label>Display Name<input ref={nameRef} maxLength={48} value={name} onChange={event => setName(event.target.value)} />{errors.displayName && <em>{errors.displayName}</em>}</label><label>Folder Title<input maxLength={64} value={draft.folderTitle || ''} onChange={event => set({ folderTitle: event.target.value })} />{errors.folderTitle && <em>{errors.folderTitle}</em>}</label></div>
            <label>Folder Subtitle<input maxLength={120} value={draft.folderSubtitle || ''} onChange={event => set({ folderSubtitle: event.target.value })} />{errors.folderSubtitle && <em>{errors.folderSubtitle}</em>}</label>
            <div className="csp-folder-field"><span>Folder Icon</span><div className="csp-folder-icon-grid">{iconChoices.map(choice => <button type="button" key={choice} className={draft.folderIcon === choice ? 'is-selected' : ''} onClick={() => set({ folderIcon: choice })} aria-label={`เลือกไอคอน ${choice}`}><FolderEditorIcon value={choice} /></button>)}</div><label className="csp-folder-icon-name-field">Icon name (optional)<input value={draft.folderIcon || ''} maxLength={32} onChange={event => set({ folderIcon: event.target.value })} placeholder="folder, folder-open, archive…" /><small>ชื่อที่ไม่รู้จักจะใช้ Folder icon เป็น fallback</small></label></div>

            <div className="csp-folder-section-title"><span>02</span><strong>ITEMS MANAGEMENT &amp; REORDERING</strong><small>{selectedFolders.length} รายการ</small></div>
            <p className="csp-folder-hint"><GripVertical aria-hidden="true" />ลากหรือใช้ปุ่มลูกศรเพื่อจัดลำดับโฟลเดอร์ที่จะแสดงบน widget</p>
            <div className="csp-folder-selected-list">{selectedFolders.map((folder, index) => { const isPublic = (draft.folderPublicIds || []).includes(folder.id); return <article key={folder.id} draggable onDragStart={() => setDragId(folder.id)} onDragOver={event => event.preventDefault()} onDrop={() => { if (!dragId || dragId === folder.id) return; const next = [...selectedIds]; const from = next.indexOf(dragId); const to = next.indexOf(folder.id); if (from >= 0 && to >= 0) { next.splice(from, 1); next.splice(to, 0, dragId); set({ folderOrder: next }); } setDragId(null); }}><GripVertical aria-hidden="true" /><span className="csp-folder-row-icon"><FolderEditorIcon value={folder.icon || draft.folderIcon} /></span><div><strong>{folder.name}</strong><small>{assets.filter(asset => asset.folderId === folder.id && !asset.deletedAt).length} ผลงาน</small></div><label className="csp-folder-public-toggle"><input type="checkbox" checked={isPublic} onChange={event => set({ folderPublicIds: event.target.checked ? [...(draft.folderPublicIds || []), folder.id] : (draft.folderPublicIds || []).filter(id => id !== folder.id) })} />public</label><button type="button" onClick={() => onOpenFolder?.(folder.id)} aria-label={`เปิดดู ${folder.name}`} title="เปิดดูโฟลเดอร์"><FolderOpen /></button><button type="button" onClick={() => moveFolder(index, -1)} aria-label="เลื่อนโฟลเดอร์ขึ้น">↑</button><button type="button" onClick={() => moveFolder(index, 1)} aria-label="เลื่อนโฟลเดอร์ลง">↓</button><button type="button" onClick={() => removeFolder(folder.id)} aria-label={`นำ ${folder.name} ออกจาก widget`}><Trash2 /></button></article>; })}</div>
            {!!availableFolders.length && <div className="csp-folder-available"><span>เพิ่มโฟลเดอร์จากโปรไฟล์</span>{availableFolders.map(folder => <button type="button" key={folder.id} onClick={() => addFolder(folder.id)}><Plus aria-hidden="true" />{folder.name}</button>)}</div>}
            {!selectedFolders.length && <div className="csp-folder-editor-empty"><Folder aria-hidden="true" />ยังไม่มีโฟลเดอร์ที่เลือก — เพิ่มจากรายการด้านบน</div>}
            {!draft.folderPublicIds?.length && <p className="csp-folder-public-warning">ยังไม่มีโฟลเดอร์ที่เปิดเผยต่อ public — การ์ดนี้จะซ่อนจากหน้าโปรไฟล์สาธารณะจนกว่าจะเลือก public</p>}

            <div className="csp-folder-section-title"><span>03</span><strong>LAYOUT &amp; INTERACTION</strong><small>LOCKED STYLE</small></div>
            <div className="csp-folder-style-grid">{FOLDER_STYLES.map(style => <button type="button" key={style} className={draft.folderStyle === style ? 'is-selected' : ''} onClick={() => set({ folderStyle: style })}><FolderEditorIcon value={style === 'open' ? 'folder-open' : 'folder'} /><strong>{styleLabels[style]}</strong><small>{style === 'card' ? 'Pocket 4 cols' : style === 'open' ? 'Dual pocket 6 cols' : style === 'list' ? 'รายการกะทัดรัด' : 'Pastel envelope'}</small></button>)}</div>
            <div className="csp-folder-locked"><FolderOpen aria-hidden="true" /><span><strong>Sunset Coastal · Cute Envelope</strong><small>Teal · aqua · peach · lavender · lemon</small></span><b>FIXED</b></div>
            <div className="csp-folder-section-title"><span>04</span><strong>DISPLAY &amp; APPEARANCE</strong><small>แสดงผล</small></div>
            <fieldset className="csp-folder-options"><legend>ตัวเลือกข้อมูลบนการ์ด</legend>{[['folderShowItemCount', 'แสดงจำนวนผลงาน'], ['folderShowPreviewItems', 'แสดงรายการ preview'], ['folderShowDescription', 'แสดงคำอธิบาย'], ['folderShowItemIcons', 'แสดงไอคอนต่อ item']].map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key as keyof CreatorWidgetConfig] !== false} onChange={event => set({ [key]: event.target.checked })} />{label}</label>)}</fieldset>
            {errors.folderOrder && <p className="csp-folder-form-error">{errors.folderOrder}</p>}{errors.folderPublicIds && <p className="csp-folder-form-error">{errors.folderPublicIds}</p>}
          </section>
          <aside className="csp-folder-editor-column csp-folder-preview" aria-label="Notion Live Preview">
            <div className="csp-folder-preview-heading"><span><i />Notion Live Preview</span><b>Sunset Coastal</b></div>
            <div className="csp-folder-preview-frame"><div className="csp-folder-preview-topbar"><span>● ● ●</span><small>Life Workspace 2024 / Dashboard &amp; Hub</small><em>12-COL CANVAS</em></div><div className="csp-folder-preview-page"><div className="csp-folder-preview-banner"><span>NOTION LIVE SIMULATION</span><small>12 Columns Responsive Layout</small></div><h3><Folder aria-hidden="true" /> {preview.title}</h3><p>{preview.subtitle}</p><CreatorWidgetRenderer type="folder" config={{ ...draft, title: name }} title={name} span={previewSpan} folders={folders} assets={assets} displayName={previewDisplayName} isOwner={true} /></div></div>
            <div className="csp-folder-preview-tip"><FolderOpen aria-hidden="true" /><span>เปลี่ยน style, ลำดับ หรือ public visibility แล้วดูผลบนการ์ดทันที</span></div>
          </aside>
        </div>
        <footer className="csp-folder-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestClose}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check aria-hidden="true" />บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {discard && <div className="csp-folder-discard" role="alertdialog" aria-modal="true"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Folder ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setDiscard(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
