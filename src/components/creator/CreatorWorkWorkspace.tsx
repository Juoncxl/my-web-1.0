import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Code2, Eye, ImagePlus, Plus, X } from 'lucide-react';
import type { Asset, AssetCategory, AssetIcon, AssetStatus, AssetVisibility, User } from '../../types';
import { buildSafeUiPreviewDocument, parseUiCode } from '../../lib/uiCodePreview';

type WorkSection = 'details' | 'content' | 'media' | 'review';
export type WorkBlockType = 'Text' | 'Heading' | 'Image' | 'Prompt' | 'UI Code' | 'Divider' | 'Note';
type WorkIconKind = 'emoji' | 'image' | 'gif';
interface WorkBlock { id: string; type: WorkBlockType; title: string; body: string; }

export interface CreatorWorkDraft {
  title: string;
  category: AssetCategory;
  description: string;
  visibility: AssetVisibility;
  status: AssetStatus;
  icon: AssetIcon;
  content: string;
  uiCodeSnippet: string;
  previewImages: string[];
  tags: string[];
}

export function buildWorkDraftPreview(draft: CreatorWorkDraft): CreatorWorkDraft {
  return {
    ...draft,
    title: draft.title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    description: draft.description.trim(),
    content: draft.content || draft.description.trim(),
    tags: [...draft.tags],
    previewImages: [...draft.previewImages]
  };
}

interface CreatorWorkWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: CreatorWorkDraft) => Promise<{ success: boolean; error?: string }>;
  initialData?: Asset | null;
  creatorProfile?: User | null;
}

const PRESETS: Record<string, { label: string; description: string; blocks: WorkBlockType[] }> = {
  prompt: { label: 'Prompt / Character', description: 'โครงสำหรับ prompt และตัวละคร', blocks: ['Heading', 'Prompt', 'Note'] },
  ui: { label: 'UI Code', description: 'HTML + CSS หนึ่ง source พร้อม preview', blocks: ['Heading', 'UI Code'] },
  lore: { label: 'Lore / World', description: 'โครงสำหรับ setting และเรื่องราว', blocks: ['Heading', 'Text', 'Image'] }
};
const BLOCK_LABELS: Record<WorkBlockType, string> = { Text: 'ข้อความ', Heading: 'หัวข้อ', Image: 'รูปภาพ', Prompt: 'Prompt', 'UI Code': 'UI Code', Divider: 'เส้นแบ่ง', Note: 'โน้ต' };
const BLOCK_DEFAULTS: Record<WorkBlockType, string> = { Text: 'เขียนรายละเอียดของผลงานที่นี่', Heading: 'หัวข้อของส่วนนี้', Image: 'เพิ่มคำอธิบายภาพหรือ reference ที่เกี่ยวข้อง', Prompt: 'ใส่ prompt หรือ instruction ที่ต้องการเก็บไว้', 'UI Code': '<section class="card">\n  <h2>เริ่มจากตรงนี้</h2>\n</section>', Divider: '---', Note: 'ประโยคสำคัญหรือแนวคิดที่อยากให้คนจำ' };
const DEFAULT_WORK_HTML = '<section class="work-preview">\n  <h2>My new work</h2>\n  <p>เริ่มสร้างผลงานของคุณ</p>\n</section>';
const DEFAULT_WORK_CSS = '.work-preview {\n  padding: 24px;\n  border-radius: 20px;\n  background: linear-gradient(135deg, #7660ce, #67b8c7);\n  color: white;\n  font-family: system-ui, sans-serif;\n}';

function makeBlock(type: WorkBlockType, index: number): WorkBlock { return { id: `${type}-${Date.now()}-${index}`, type, title: BLOCK_LABELS[type], body: BLOCK_DEFAULTS[type] }; }
function toAssetCategory(value: string): AssetCategory { if (value === 'โค้ดหน้าตา UI') return 'ui_code'; if (value === 'เนื้อเรื่อง / โลกทัศน์') return 'lore'; if (value === 'แอป / แพลตฟอร์ม') return 'app_data'; if (value === 'คอลแลป') return 'collab'; if (value === 'โปรไฟล์ตัวละคร') return 'character'; return 'prompts'; }
function toAssetVisibility(value: string): AssetVisibility { return value === 'สาธารณะ' ? 'public' : value === 'แบบร่าง' ? 'draft' : 'private'; }
function toAssetStatus(value: string): AssetStatus { if (value === 'ไอเดีย') return 'idea'; if (value === 'แบบร่าง') return 'draft'; if (value === 'เสร็จสมบูรณ์') return 'finished'; if (value === 'จัดเก็บแล้ว') return 'archived'; return 'in_progress'; }
function fromAssetCategory(value: AssetCategory): string { if (value === 'ui_code') return 'โค้ดหน้าตา UI'; if (value === 'lore') return 'เนื้อเรื่อง / โลกทัศน์'; if (value === 'app_data') return 'แอป / แพลตฟอร์ม'; if (value === 'collab') return 'คอลแลป'; if (value === 'character') return 'โปรไฟล์ตัวละคร'; return 'คำสั่งพรอมต์'; }
function fromAssetVisibility(value: AssetVisibility): string { return value === 'public' ? 'สาธารณะ' : value === 'draft' ? 'แบบร่าง' : 'ส่วนตัว'; }
function fromAssetStatus(value: AssetStatus): string { if (value === 'idea') return 'ไอเดีย'; if (value === 'draft') return 'แบบร่าง'; if (value === 'finished') return 'เสร็จสมบูรณ์'; if (value === 'archived') return 'จัดเก็บแล้ว'; return 'กำลังทำ'; }
export const CreatorWorkWorkspace: React.FC<CreatorWorkWorkspaceProps> = ({ isOpen, onClose, onSave, initialData = null, creatorProfile = null }) => {
  const [section, setSection] = useState<WorkSection>('details');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('คำสั่งพรอมต์');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('ส่วนตัว');
  const [status, setStatus] = useState('กำลังทำ');
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [html, setHtml] = useState(DEFAULT_WORK_HTML);
  const [css, setCss] = useState(DEFAULT_WORK_CSS);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [iconKind, setIconKind] = useState<WorkIconKind>('emoji');
  const [iconValue, setIconValue] = useState('✦');
  const [iconImage, setIconImage] = useState('');
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [reviewViewport, setReviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [codeView, setCodeView] = useState<'code' | 'preview'>('preview');
  const [nestedEditorOpen, setNestedEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSection('details');
    setNestedEditorOpen(false);
    if (!initialData) {
      setTitle(''); setCategory('คำสั่งพรอมต์'); setDescription(''); setVisibility('ส่วนตัว'); setStatus('กำลังทำ');
      setBlocks([]); setActiveBlockId(null); setHtml(DEFAULT_WORK_HTML); setCss(DEFAULT_WORK_CSS);
      setTags([]); setTagInput(''); setIconKind('emoji'); setIconValue('✦'); setIconImage(''); setMediaImages([]);
      return;
    }

    setTitle(initialData.title);
    setCategory(fromAssetCategory(initialData.category));
    setDescription(initialData.content || '');
    setVisibility(fromAssetVisibility(initialData.visibility || (initialData.isPublic ? 'public' : 'private')));
    setStatus(fromAssetStatus(initialData.status || 'finished'));
    setTags(initialData.tags || []);
    setTagInput('');
    setIconKind(initialData.icon?.type === 'emoji' ? 'emoji' : 'image');
    setIconValue(initialData.icon?.type === 'emoji' ? initialData.icon.value : '✦');
    setIconImage(initialData.icon?.type === 'emoji' ? '' : initialData.icon?.value || '');
    setMediaImages(initialData.previewImages?.length ? initialData.previewImages : (initialData.previewImage ? [initialData.previewImage] : []));
    if (initialData.uiCodeSnippet) {
      const parsed = parseUiCode(initialData.uiCodeSnippet);
      setHtml(parsed.html || DEFAULT_WORK_HTML);
      setCss(parsed.css || DEFAULT_WORK_CSS);
      const codeBlock = { id: `UI Code-${initialData.id}`, type: 'UI Code' as WorkBlockType, title: 'UI Code', body: parsed.html || DEFAULT_WORK_HTML };
      setBlocks([codeBlock]);
      setActiveBlockId(codeBlock.id);
    } else {
      setHtml(DEFAULT_WORK_HTML);
      setCss(DEFAULT_WORK_CSS);
      setBlocks([]);
      setActiveBlockId(null);
    }
  }, [initialData, isOpen]);
  const activeBlock = blocks.find(block => block.id === activeBlockId) || null;
  const draftContent = useMemo(() => [description.trim(), ...blocks.map(block => `## ${block.title}\n${block.type === 'UI Code' ? html : block.body}`)].filter(Boolean).join('\n\n'), [blocks, description, html]);
  const draftPreview = useMemo(() => buildWorkDraftPreview({
    title: title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    category: toAssetCategory(category),
    description: description.trim(),
    visibility: toAssetVisibility(visibility),
    status: toAssetStatus(status),
    icon: iconKind === 'emoji' ? { type: 'emoji' as const, value: iconValue || '✦' } : { type: 'image' as const, value: iconImage },
    content: draftContent,
    uiCodeSnippet: blocks.some(block => block.type === 'UI Code') ? `${html}\n\n/* CSS */\n${css}` : '',
    previewImages: mediaImages,
    tags
  }), [blocks, category, css, description, draftContent, html, iconImage, iconKind, iconValue, mediaImages, status, tags, title, visibility]);
  const previewSrcDoc = useMemo(() => buildSafeUiPreviewDocument(draftPreview.uiCodeSnippet), [draftPreview.uiCodeSnippet]);
  if (!isOpen) return null;

  const addBlock = (type: WorkBlockType) => { const block = makeBlock(type, blocks.length); setBlocks(previous => [...previous, block]); setActiveBlockId(block.id); setSection('content'); };
  const applyPreset = (presetKey: string) => { const preset = PRESETS[presetKey]; if (!preset) return; const nextBlocks = preset.blocks.map((type, index) => makeBlock(type, index)); setBlocks(nextBlocks); setActiveBlockId(nextBlocks[0]?.id || null); setCategory(presetKey === 'ui' ? 'โค้ดหน้าตา UI' : presetKey === 'lore' ? 'เนื้อเรื่อง / โลกทัศน์' : 'คำสั่งพรอมต์'); setSection('content'); };
  const updateActiveBlock = (patch: Partial<WorkBlock>) => {
    if (!activeBlockId) return;
    setBlocks(previous => previous.map(block => block.id === activeBlockId ? { ...block, ...patch } : block));
    if ('body' in patch && activeBlock?.type === 'UI Code' && typeof patch.body === 'string') {
      const parsed = parseUiCode(patch.body);
      setHtml(parsed.html);
      setCss(parsed.css || DEFAULT_WORK_CSS);
    }
  };
  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') setMediaImages(previous => [...previous, reader.result as string].slice(-6)); }; reader.readAsDataURL(file); event.target.value = ''; };
  const handleIconFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') setIconImage(reader.result); }; reader.readAsDataURL(file); setIconKind(file.type === 'image/gif' ? 'gif' : 'image'); };
  const addTag = () => { const clean = tagInput.trim().replace(/^#/, ''); if (!clean || tags.includes(clean) || tags.length >= 10) return; setTags(previous => [...previous, clean]); setTagInput(''); };
  const moveBlock = (index: number, direction: -1 | 1) => setBlocks(previous => { const target = index + direction; if (target < 0 || target >= previous.length) return previous; const next = [...previous]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const saveWork = async () => {
    if (!title.trim()) { setError(`กรุณาตั้งชื่อผลงานก่อน${initialData ? 'บันทึก' : 'สร้าง'}`); setSection('details'); return; }
    setIsSaving(true); setError('');
    const result = await onSave({ ...draftPreview, content: draftPreview.content || draftPreview.description });
    setIsSaving(false); if (!result.success) { setError(result.error || (initialData ? 'แก้ไขผลงานไม่สำเร็จ' : 'สร้างผลงานไม่สำเร็จ')); return; } onClose();
  };

  return <div className="csp-modal-backdrop" role="presentation"><section className="csp-work-modal" role="dialog" aria-modal="true" aria-labelledby="csp-work-title">
    <header className="csp-modal-header"><div><p className="csp-eyebrow">CREATOR SPACE · WORKSPACE</p><h2 id="csp-work-title">{initialData ? 'แก้ไขผลงาน' : 'สร้างผลงานใหม่'}</h2><p>ข้อมูลทั้งหมดอยู่ใน QA Sandbox · Local only จนกว่าจะอนุมัติ persistence จริง</p></div><button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิด workspace"><X className="h-4 w-4" /></button></header>
    <nav className="csp-work-nav" aria-label="เมนูพื้นที่ทำงานผลงาน">{([['details', 'ข้อมูลหลัก'], ['content', 'เนื้อหา'], ['media', 'สื่อ'], ['review', 'ตรวจสอบ']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? 'is-active' : ''} onClick={() => setSection(value)}>{label}</button>)}</nav>
    {error && <div className="csp-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด">×</button></div>}
    <div className="csp-work-body"><main className="csp-work-main">
      {section === 'details' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>ข้อมูลหลัก</h3><p>ชื่อ ไอคอน หมวดหมู่ และคำอธิบายสั้นของ Work Card</p></div><span>Required</span></div><label className="csp-field">ชื่อผลงาน *<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="เช่น Moonlit Companion System" /></label><div className="csp-two-column"><label className="csp-field">หมวดหมู่<select value={category} onChange={event => setCategory(event.target.value)}><option>คำสั่งพรอมต์</option><option>โปรไฟล์ตัวละคร</option><option>โค้ดหน้าตา UI</option><option>เนื้อเรื่อง / โลกทัศน์</option><option>แอป / แพลตฟอร์ม</option><option>คอลแลป</option></select></label><div className="csp-field"><span>Work Icon</span><div className="csp-icon-picker"><button type="button" className={iconKind === 'emoji' ? 'is-active' : ''} onClick={() => setIconKind('emoji')}>Emoji</button><button type="button" className={iconKind === 'image' ? 'is-active' : ''} onClick={() => setIconKind('image')}>Image</button><button type="button" className={iconKind === 'gif' ? 'is-active' : ''} onClick={() => setIconKind('gif')}>GIF</button></div>{iconKind === 'emoji' ? <input value={iconValue} onChange={event => setIconValue(event.target.value.slice(0, 4))} aria-label="ไอคอนผลงาน" /> : <label className="csp-file-picker">{iconImage ? <img src={iconImage} alt="Work icon" /> : 'เลือกไฟล์ image/GIF'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconFile} /></label>}</div></div><label className="csp-field">คำอธิบายสั้น <span className="csp-field-count">{description.length}/240</span><textarea value={description} maxLength={240} onChange={event => setDescription(event.target.value)} placeholder="ข้อความสำหรับ Work Card / Preview" rows={4} /></label></section>}
      {section === 'content' && <><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Starter Presets</h3><p>แม่แบบเพิ่ม Content Blocks เท่านั้น ไม่ใช่ writing area เอง</p></div><span>Optional</span></div><div className="csp-preset-grid">{Object.entries(PRESETS).map(([key, preset]) => <button type="button" key={key} className="csp-preset" onClick={() => applyPreset(key)}><strong>{preset.label}</strong><span>{preset.description}</span><small>{preset.blocks.length} blocks</small></button>)}</div></section><section className="csp-work-section" aria-labelledby="csp-blocks-title"><div className="csp-section-heading"><div><h3 id="csp-blocks-title">Main Content</h3><p>แถวที่ยุบจะแสดง summary · คลิกเพื่อเปิด large editor</p></div><span>{blocks.length} blocks</span></div><div className="csp-block-list">{blocks.length === 0 && <div className="csp-empty-inline"><Code2 className="h-5 w-5" /><span>ยังไม่มี block · เลือกชนิดด้านล่างเพื่อเริ่ม</span></div>}{blocks.map((block, index) => <div key={block.id} className={`csp-block-row ${activeBlockId === block.id ? 'is-active' : ''}`}><span className="csp-block-index">{String(index + 1).padStart(2, '0')}</span><button type="button" className="csp-block-summary" onClick={() => { setActiveBlockId(block.id); setNestedEditorOpen(true); }}><strong>{block.title}</strong><span>{BLOCK_LABELS[block.type]} · {block.body.slice(0, 80)}</span></button><div className="csp-row-actions"><button type="button" onClick={() => moveBlock(index, -1)} aria-label="เลื่อนขึ้น"><ChevronLeft className="h-4 w-4 -rotate-90" /></button><button type="button" onClick={() => moveBlock(index, 1)} aria-label="เลื่อนลง"><ChevronRight className="h-4 w-4 rotate-90" /></button><button type="button" className="is-danger" onClick={() => setBlocks(previous => previous.filter(item => item.id !== block.id))} aria-label="ลบ block">×</button></div></div>)}</div><div className="csp-add-blocks">{(['Text', 'Heading', 'Image', 'Prompt', 'UI Code', 'Divider', 'Note'] as WorkBlockType[]).map(type => <button type="button" key={type} onClick={() => addBlock(type)}><Plus className="h-3.5 w-3.5" />{BLOCK_LABELS[type]}</button>)}</div></section>{activeBlock && <section className="csp-work-section csp-block-editor"><div className="csp-section-heading"><div><h3>Block Editor · {activeBlock.title}</h3><p>แก้เนื้อหาของ block ที่เลือกใน session นี้</p></div><span>{activeBlock.type}</span></div><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => updateActiveBlock({ title: event.target.value })} /></label><label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock({ body: event.target.value })} rows={activeBlock.type === 'UI Code' ? 10 : 7} /></label></section>}</>}
      {section === 'media' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>สื่อ</h3><p>ไฟล์ทั้งหมดเป็น data URL ใน QA Sandbox · ไม่อัปโหลด storage</p></div><span>Local only</span></div><div className="csp-media-placeholder"><ImagePlus className="h-7 w-7" /><strong>Cover / Gallery</strong><span>เลือกภาพชั่วคราวเพื่อใช้ใน review และ Work Card</span><label className="csp-secondary-button csp-file-button">เลือกภาพจากเครื่อง<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageFile} /></label></div>{mediaImages.length > 0 && <div className="csp-media-strip">{mediaImages.map((image, index) => <button type="button" key={`${image.slice(0, 20)}-${index}`} onClick={() => setMediaImages(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`ลบภาพที่ ${index + 1}`}><img src={image} alt="" /></button>)}</div>}</section>}
      {section === 'review' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>ตรวจสอบ</h3><p>Rendered preview จาก draft ในหน่วยความจำปัจจุบัน · ยังไม่บันทึก</p></div><div className="csp-review-switcher"><button type="button" className={reviewViewport === 'desktop' ? 'is-active' : ''} onClick={() => setReviewViewport('desktop')}>Desktop</button><button type="button" className={reviewViewport === 'mobile' ? 'is-active' : ''} onClick={() => setReviewViewport('mobile')}>Mobile</button></div></div><div className={`csp-review-card ${reviewViewport === 'mobile' ? 'is-mobile' : ''}`}><div className="csp-review-icon">{draftPreview.icon.type === 'emoji' ? draftPreview.icon.value : draftPreview.icon.value ? <img src={draftPreview.icon.value} alt="" /> : '✦'}</div><div><strong>{draftPreview.title}</strong><span>{category} · {visibility} · {status}</span>{creatorProfile && <small className="csp-preview-author">โดย {creatorProfile.displayName}{creatorProfile.username ? ` · @${creatorProfile.username}` : ''}</small>}<p>{draftPreview.description || 'ยังไม่มีคำอธิบายสั้น'}</p><div className="csp-tag-list">{draftPreview.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><p className="csp-preview-content">{draftPreview.content || 'ยังไม่มีเนื้อหา'}</p>{draftPreview.previewImages.length > 0 && <div className="csp-media-strip">{draftPreview.previewImages.map((image, index) => <img key={`${image.slice(0, 20)}-${index}`} src={image} alt="" />)}</div>}</div></div><div className="csp-code-preview-wrap"><div className="csp-section-heading"><div><h3>UI Code · CODE / PREVIEW</h3><p>HTML + CSS source เดียว · sandbox และ CSP ปิด script, network และ form</p></div><Eye className="h-4 w-4" /></div><div className="csp-code-tabs"><button type="button" className={codeView === 'preview' ? 'is-active' : ''} onClick={() => setCodeView('preview')}>PREVIEW</button><button type="button" className={codeView === 'code' ? 'is-active' : ''} onClick={() => setCodeView('code')}>CODE</button></div>{codeView === 'preview' ? <iframe title="UI Code preview" sandbox="" srcDoc={previewSrcDoc} /> : <pre className="csp-code-source">{`${html}\n\n/* CSS */\n${css}`}</pre>}</div></section>}
    </main><aside className="csp-work-sidebar"><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Metadata</h3><p>ข้อมูลนี้จะถูกส่งให้ repository เมื่อกดสร้าง</p></div><span>Draft</span></div><label className="csp-field">Visibility<select value={visibility} onChange={event => setVisibility(event.target.value)}><option>ส่วนตัว</option><option>สาธารณะ</option><option>แบบร่าง</option></select></label><label className="csp-field">Workflow status<select value={status} onChange={event => setStatus(event.target.value)}><option>ไอเดีย</option><option>แบบร่าง</option><option>กำลังทำ</option><option>เสร็จสมบูรณ์</option><option>จัดเก็บแล้ว</option></select></label></section><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Tags</h3><p>{tags.length}/10</p></div></div><div className="csp-tag-list">{tags.map(tag => <button type="button" key={tag} onClick={() => setTags(previous => previous.filter(item => item !== tag))}>#{tag} ×</button>)}</div><div className="csp-tag-entry"><input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="พิมพ์ tag แล้วกด Enter" /><button type="button" onClick={addTag}>เพิ่ม</button></div></section><section className="csp-work-section csp-persistence-note"><strong>QA Sandbox boundary</strong><p>Create Work, blocks, media และ asset ใหม่จะอยู่ใน local adapter เท่านั้น ไม่มี production write ในโหมดนี้</p></section></aside></div>
    <footer className="csp-modal-footer"><span>{isSaving ? (initialData ? 'กำลังบันทึกใน local sandbox…' : 'กำลังสร้างใน local sandbox…') : (initialData ? 'พร้อมบันทึก · local only' : 'พร้อมสร้าง · local only')}</span><button type="button" className="csp-secondary-button" onClick={onClose}>ยกเลิก</button><button type="button" className="csp-primary-button" disabled={isSaving || !title.trim()} onClick={() => void saveWork()}>{isSaving ? 'กำลังบันทึก…' : initialData ? 'บันทึกการแก้ไข' : 'สร้างผลงาน'}</button></footer>
  </section>{nestedEditorOpen && activeBlock && <div className="csp-nested-modal" role="dialog" aria-modal="true" aria-label={`Block Editor ${activeBlock.title}`}><section className="csp-nested-modal-card"><header className="csp-modal-header"><div><p className="csp-eyebrow">MAIN CONTENT · LARGE EDITOR</p><h2>{activeBlock.title}</h2></div><button type="button" className="csp-icon-button" onClick={() => setNestedEditorOpen(false)} aria-label="ปิด editor"><X className="h-4 w-4" /></button></header><div className="csp-nested-modal-body"><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => updateActiveBlock({ title: event.target.value })} /></label><label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock({ body: event.target.value })} rows={14} /></label>{activeBlock.type === 'UI Code' && <><label className="csp-field">CODE · HTML + CSS<textarea value={`${html}\n\n/* CSS */\n${css}`} onChange={event => { const parsed = parseUiCode(event.target.value); setHtml(parsed.html); setCss(parsed.css); }} rows={18} /></label><div className="csp-code-preview-wrap"><strong>PREVIEW</strong><iframe title="Nested UI Code preview" sandbox="" srcDoc={previewSrcDoc} /></div></>}</div><footer className="csp-modal-footer"><span>กลับไปยังตำแหน่งเดิมใน workspace ได้โดยไม่หาย</span><button type="button" className="csp-primary-button" onClick={() => setNestedEditorOpen(false)}>เสร็จสิ้น</button></footer></section></div>}</div>;
};
