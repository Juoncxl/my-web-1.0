import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Code2, Eye, ImagePlus, Plus, X } from 'lucide-react';
import type { Asset, AssetCategory, AssetIcon, AssetStatus, AssetVisibility, Folder, User, WorkContentBlock, WorkContentBlockType } from '../../types';
import { isValidWorkIcon, normalizeAssetVisibility } from '../../lib/assetVisibility';
import { SandboxedCodePreview } from '../SandboxedCodePreview';

type WorkSection = 'details' | 'content' | 'media' | 'review';
export type WorkBlockType = WorkContentBlockType;
type WorkIconKind = 'emoji' | 'image' | 'gif';
type WorkBlock = WorkContentBlock;

export interface CreatorWorkDraft {
  title: string;
  category: AssetCategory;
  description: string;
  visibility: AssetVisibility;
  status: AssetStatus;
  folderId: string | null;
  icon: AssetIcon;
  content: string;
  contentBlocks: WorkContentBlock[];
  uiCodeSnippet: string;
  previewImages: string[];
  tags: string[];
}

export function createBlankCreatorWorkDraft(): CreatorWorkDraft {
  return {
    title: '', category: 'prompts', description: '', visibility: 'private', status: 'in_progress', folderId: null,
    icon: { type: 'emoji', value: '✦' }, content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: [], tags: []
  };
}

export function buildWorkDraftPreview(draft: CreatorWorkDraft): CreatorWorkDraft {
  return {
    ...draft,
    title: draft.title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    description: draft.description.trim(),
    content: draft.content,
    contentBlocks: draft.contentBlocks.map(block => ({ ...block })),
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
  folders?: Folder[];
}

const PRESETS: Record<string, { label: string; description: string; blocks: WorkBlockType[] }> = {
  prompt: { label: 'Prompt / Character', description: 'โครงสำหรับ prompt และตัวละคร', blocks: ['Heading', 'Prompt', 'Note'] },
  ui: { label: 'UI Code', description: 'HTML + CSS หนึ่ง source พร้อม preview', blocks: ['Heading', 'UI Code'] },
  lore: { label: 'Lore / World', description: 'โครงสำหรับ setting และเรื่องราว', blocks: ['Heading', 'Text', 'Image'] }
};
const DEFAULT_WORK_HTML = '<section class="work-preview">\n  <h2>My new work</h2>\n  <p>เริ่มสร้างผลงานของคุณ</p>\n</section>';
const DEFAULT_WORK_CSS = '.work-preview {\n  padding: 24px;\n  border-radius: 20px;\n  background: linear-gradient(135deg, #7660ce, #67b8c7);\n  color: white;\n  font-family: system-ui, sans-serif;\n}';
const DEFAULT_UI_CODE_SOURCE = `${DEFAULT_WORK_HTML}\n\n<style>\n${DEFAULT_WORK_CSS}\n</style>`;
const BLOCK_LABELS: Record<WorkBlockType, string> = { Text: 'ข้อความ', Heading: 'หัวข้อ', Image: 'รูปภาพ', Prompt: 'Prompt', 'UI Code': 'UI Code', Divider: 'เส้นแบ่ง', Note: 'โน้ต' };
const BLOCK_DEFAULTS: Record<WorkBlockType, string> = { Text: 'เขียนรายละเอียดของผลงานที่นี่', Heading: 'หัวข้อของส่วนนี้', Image: 'เพิ่มคำอธิบายภาพหรือ reference ที่เกี่ยวข้อง', Prompt: 'ใส่ prompt หรือ instruction ที่ต้องการเก็บไว้', 'UI Code': DEFAULT_UI_CODE_SOURCE, Divider: '---', Note: 'ประโยคสำคัญหรือแนวคิดที่อยากให้คนจำ' };

function makeBlock(type: WorkBlockType, index: number): WorkBlock { return { id: `${type}-${Date.now()}-${index}`, type, title: BLOCK_LABELS[type], body: BLOCK_DEFAULTS[type] }; }
function toAssetCategory(value: string): AssetCategory { if (value === 'โค้ดหน้าตา UI') return 'ui_code'; if (value === 'เนื้อเรื่อง / โลกทัศน์') return 'lore'; if (value === 'แอป / แพลตฟอร์ม') return 'app_data'; if (value === 'คอลแลป') return 'collab'; if (value === 'โปรไฟล์ตัวละคร') return 'character'; return 'prompts'; }
function toAssetVisibility(value: string): AssetVisibility { return value === 'สาธารณะ' ? 'public' : 'private'; }
function toAssetStatus(value: string): AssetStatus { if (value === 'ไอเดีย') return 'idea'; if (value === 'แบบร่าง') return 'draft'; if (value === 'เสร็จสมบูรณ์') return 'finished'; if (value === 'จัดเก็บแล้ว') return 'archived'; return 'in_progress'; }
function fromAssetCategory(value: AssetCategory): string { if (value === 'ui_code') return 'โค้ดหน้าตา UI'; if (value === 'lore') return 'เนื้อเรื่อง / โลกทัศน์'; if (value === 'app_data') return 'แอป / แพลตฟอร์ม'; if (value === 'collab') return 'คอลแลป'; if (value === 'character') return 'โปรไฟล์ตัวละคร'; return 'คำสั่งพรอมต์'; }
function fromAssetVisibility(value: AssetVisibility): string { return value === 'public' ? 'สาธารณะ' : 'ส่วนตัว'; }
function fromAssetStatus(value: AssetStatus): string { if (value === 'idea') return 'ไอเดีย'; if (value === 'draft') return 'แบบร่าง'; if (value === 'finished') return 'เสร็จสมบูรณ์'; if (value === 'archived') return 'จัดเก็บแล้ว'; return 'กำลังทำ'; }

function serializeMainContentBlocks(blocks: WorkContentBlock[]): string {
  return blocks
    .filter(block => block.type !== 'UI Code')
    .map(block => `## ${block.title}\n${block.body}`)
    .join('\n\n');
}

type GraphemeSegment = { segment: string };
type GraphemeSegmenter = {
  segment: (value: string) => Iterable<GraphemeSegment>;
};

/** Keep the Work Icon input bounded without cutting a multi-codepoint emoji. */
export function limitWorkIconInput(value: string, maxGraphemes = 4): string {
  if (!value || maxGraphemes <= 0) return '';
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
  }).Segmenter;
  // Older runtimes keep the entire value rather than risk returning a broken
  // surrogate/ZWJ sequence. Supported browsers provide Intl.Segmenter.
  if (!Segmenter) return value;
  return Array.from(
    new Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
    part => part.segment
  ).slice(0, maxGraphemes).join('');
}

/** Convert persisted modern or legacy Work data into an isolated editable draft. */
export function createCreatorWorkDraftFromAsset(asset: Asset): CreatorWorkDraft {
  const contentBlocks = asset.contentBlocks?.map(block => ({ ...block })) || [];
  if (!contentBlocks.some(block => block.type !== 'UI Code') && asset.content.trim()) {
    contentBlocks.unshift({ id: `legacy-content-${asset.id}`, type: 'Text', title: 'Main Content', body: asset.content });
  }
  if (!contentBlocks.some(block => block.type === 'UI Code') && asset.uiCodeSnippet) {
    contentBlocks.push({ id: `legacy-ui-code-${asset.id}`, type: 'UI Code', title: 'UI Code', body: asset.uiCodeSnippet });
  }

  return {
    title: asset.title,
    category: asset.category,
    // A legacy main body must never silently become a short description.
    description: asset.shortDescription ?? '',
    visibility: normalizeAssetVisibility({ visibility: asset.visibility, isPublic: asset.isPublic }).visibility,
    status: asset.status || 'finished',
    folderId: asset.folderId || null,
    icon: { ...asset.icon },
    content: serializeMainContentBlocks(contentBlocks),
    contentBlocks,
    uiCodeSnippet: contentBlocks.find(block => block.type === 'UI Code')?.body || '',
    previewImages: asset.previewImages?.length ? [...asset.previewImages] : (asset.previewImage ? [asset.previewImage] : []),
    tags: [...(asset.tags || [])]
  };
}

export const CreatorWorkWorkspace: React.FC<CreatorWorkWorkspaceProps> = ({ isOpen, onClose, onSave, initialData = null, creatorProfile = null, folders = [] }) => {
  const [section, setSection] = useState<WorkSection>('details');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('คำสั่งพรอมต์');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('ส่วนตัว');
  const [status, setStatus] = useState('กำลังทำ');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [iconKind, setIconKind] = useState<WorkIconKind>('emoji');
  const [iconValue, setIconValue] = useState('✦');
  const [iconImage, setIconImage] = useState('');
  const [iconStorageKey, setIconStorageKey] = useState<string | undefined>();
  const [iconMimeType, setIconMimeType] = useState<string | undefined>();
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
    setReviewViewport('desktop');
    setCodeView('preview');
    setIsSaving(false);
    if (!initialData) {
      const blank = createBlankCreatorWorkDraft();
      setTitle(blank.title); setCategory('คำสั่งพรอมต์'); setDescription(blank.description); setVisibility('ส่วนตัว'); setStatus('กำลังทำ'); setFolderId(blank.folderId);
      setBlocks(blank.contentBlocks); setActiveBlockId(null);
      setTags(blank.tags); setTagInput(''); setIconKind('emoji'); setIconValue(blank.icon.value); setIconImage(''); setIconStorageKey(undefined); setIconMimeType(undefined); setMediaImages(blank.previewImages);
      return;
    }

    const draft = createCreatorWorkDraftFromAsset(initialData);
    setTitle(draft.title);
    setCategory(fromAssetCategory(draft.category));
    setDescription(draft.description);
    setVisibility(fromAssetVisibility(draft.visibility));
    setStatus(fromAssetStatus(draft.status));
    setFolderId(draft.folderId);
    setTags(draft.tags);
    setTagInput('');
    const isGif = draft.icon.type === 'image' && (draft.icon.mimeType === 'image/gif' || draft.icon.value.startsWith('data:image/gif'));
    setIconKind(draft.icon.type === 'emoji' ? 'emoji' : isGif ? 'gif' : 'image');
    setIconValue(draft.icon.type === 'emoji' ? draft.icon.value : '✦');
    setIconImage(draft.icon.type === 'emoji' ? '' : draft.icon.value);
    setIconStorageKey(draft.icon.type === 'image' ? draft.icon.storageKey : undefined);
    setIconMimeType(draft.icon.type === 'image' ? draft.icon.mimeType : undefined);
    setMediaImages(draft.previewImages);
    setBlocks(draft.contentBlocks);
    setActiveBlockId(draft.contentBlocks[0]?.id || null);
  }, [initialData, isOpen]);
  const activeBlock = blocks.find(block => block.id === activeBlockId) || null;
  const draftContent = useMemo(() => serializeMainContentBlocks(blocks), [blocks]);
  const uiCodeSnippet = useMemo(() => blocks.find(block => block.type === 'UI Code')?.body || '', [blocks]);
  const draftPreview = useMemo(() => buildWorkDraftPreview({
    title: title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    category: toAssetCategory(category),
    description: description.trim(),
    visibility: toAssetVisibility(visibility),
    status: toAssetStatus(status),
    folderId,
    icon: iconKind === 'emoji'
      ? { type: 'emoji' as const, value: iconValue || '✦' }
      : { type: 'image' as const, value: iconImage, storageKey: iconStorageKey, mimeType: iconMimeType },
    content: draftContent,
    contentBlocks: blocks,
    uiCodeSnippet,
    previewImages: mediaImages,
    tags
  }), [blocks, category, description, draftContent, folderId, iconImage, iconKind, iconMimeType, iconStorageKey, iconValue, mediaImages, status, tags, title, uiCodeSnippet, visibility]);
  if (!isOpen) return null;

  const addBlock = (type: WorkBlockType) => { const block = makeBlock(type, blocks.length); setBlocks(previous => [...previous, block]); setActiveBlockId(block.id); setSection('content'); };
  const applyPreset = (presetKey: string) => { const preset = PRESETS[presetKey]; if (!preset) return; const nextBlocks = preset.blocks.map((type, index) => makeBlock(type, index)); setBlocks(nextBlocks); setActiveBlockId(nextBlocks[0]?.id || null); setCategory(presetKey === 'ui' ? 'โค้ดหน้าตา UI' : presetKey === 'lore' ? 'เนื้อเรื่อง / โลกทัศน์' : 'คำสั่งพรอมต์'); setSection('content'); };
  const updateActiveBlock = (patch: Partial<WorkBlock>) => {
    if (!activeBlockId) return;
    setBlocks(previous => previous.map(block => block.id === activeBlockId ? { ...block, ...patch } : block));
  };
  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') setMediaImages(previous => [...previous, reader.result as string].slice(-6)); }; reader.readAsDataURL(file); event.target.value = ''; };
  const handleIconFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') { setIconImage(reader.result); setIconStorageKey(undefined); setIconMimeType(file.type); } }; reader.readAsDataURL(file); setIconKind(file.type === 'image/gif' ? 'gif' : 'image'); };
  const addTag = () => { const clean = tagInput.trim().replace(/^#/, ''); if (!clean || tags.includes(clean) || tags.length >= 10) return; setTags(previous => [...previous, clean]); setTagInput(''); };
  const moveBlock = (index: number, direction: -1 | 1) => setBlocks(previous => { const target = index + direction; if (target < 0 || target >= previous.length) return previous; const next = [...previous]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const saveWork = async () => {
    if (!title.trim()) { setError(`กรุณาตั้งชื่อผลงานก่อน${initialData ? 'บันทึก' : 'สร้าง'}`); setSection('details'); return; }
    setIsSaving(true); setError('');
    const result = await onSave(draftPreview);
    setIsSaving(false); if (!result.success) { setError(result.error || (initialData ? 'แก้ไขผลงานไม่สำเร็จ' : 'สร้างผลงานไม่สำเร็จ')); return; } onClose();
  };

  return <div className="csp-modal-backdrop" role="presentation"><section className="csp-work-modal" role="dialog" aria-modal="true" aria-labelledby="csp-work-title">
    <header className="csp-modal-header"><div><p className="csp-eyebrow">CREATOR SPACE · WORKSPACE</p><h2 id="csp-work-title">{initialData ? 'แก้ไขผลงาน' : 'สร้างผลงานใหม่'}</h2><p>ข้อมูลทั้งหมดอยู่ใน QA Sandbox · Local only จนกว่าจะอนุมัติ persistence จริง</p></div><button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิด workspace"><X className="h-4 w-4" /></button></header>
    <nav className="csp-work-nav" aria-label="เมนูพื้นที่ทำงานผลงาน">{([['details', 'ข้อมูลหลัก'], ['content', 'เนื้อหา'], ['media', 'สื่อ'], ['review', 'ตรวจสอบ']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? 'is-active' : ''} onClick={() => setSection(value)}>{label}</button>)}</nav>
    {error && <div className="csp-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด">×</button></div>}
    <div className="csp-work-body"><main className="csp-work-main">
      {section === 'details' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>ข้อมูลหลัก</h3><p>ชื่อ ไอคอน หมวดหมู่ และคำอธิบายสั้นของ Work Card</p></div><span>Required</span></div><label className="csp-field">ชื่อผลงาน *<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="เช่น Moonlit Companion System" /></label><div className="csp-two-column"><label className="csp-field">หมวดหมู่<select value={category} onChange={event => setCategory(event.target.value)}><option>คำสั่งพรอมต์</option><option>โปรไฟล์ตัวละคร</option><option>โค้ดหน้าตา UI</option><option>เนื้อเรื่อง / โลกทัศน์</option><option>แอป / แพลตฟอร์ม</option><option>คอลแลป</option></select></label><div className="csp-field"><span>Work Icon</span><div className="csp-icon-picker"><button type="button" className={iconKind === 'emoji' ? 'is-active' : ''} onClick={() => setIconKind('emoji')}>Emoji</button><button type="button" className={iconKind === 'image' ? 'is-active' : ''} onClick={() => setIconKind('image')}>Image</button><button type="button" className={iconKind === 'gif' ? 'is-active' : ''} onClick={() => setIconKind('gif')}>GIF</button></div>{iconKind === 'emoji' ? <input value={iconValue} onChange={event => setIconValue(limitWorkIconInput(event.target.value))} aria-label="ไอคอนผลงาน" /> : <label className="csp-file-picker">{iconImage ? <img src={iconImage} alt="Work icon" /> : 'เลือกไฟล์ image/GIF'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconFile} /></label>}</div></div><label className="csp-field">คำอธิบายสั้น <span className="csp-field-count">{description.length}/240</span><textarea value={description} maxLength={240} onChange={event => setDescription(event.target.value)} placeholder="ข้อความสำหรับ Work Card / Preview" rows={4} /></label></section>}
      {section === 'content' && <><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Starter Presets</h3><p>แม่แบบเพิ่ม Content Blocks เท่านั้น ไม่ใช่ writing area เอง</p></div><span>Optional</span></div><div className="csp-preset-grid">{Object.entries(PRESETS).map(([key, preset]) => <button type="button" key={key} className="csp-preset" onClick={() => applyPreset(key)}><strong>{preset.label}</strong><span>{preset.description}</span><small>{preset.blocks.length} blocks</small></button>)}</div></section><section className="csp-work-section" aria-labelledby="csp-blocks-title"><div className="csp-section-heading"><div><h3 id="csp-blocks-title">Main Content</h3><p>แถวที่ยุบจะแสดง summary · คลิกเพื่อเปิด large editor</p></div><span>{blocks.length} blocks</span></div><div className="csp-block-list">{blocks.length === 0 && <div className="csp-empty-inline"><Code2 className="h-5 w-5" /><span>ยังไม่มี block · เลือกชนิดด้านล่างเพื่อเริ่ม</span></div>}{blocks.map((block, index) => <div key={block.id} className={`csp-block-row ${activeBlockId === block.id ? 'is-active' : ''}`}><span className="csp-block-index">{String(index + 1).padStart(2, '0')}</span><button type="button" className="csp-block-summary" onClick={() => { setActiveBlockId(block.id); setNestedEditorOpen(true); }}><strong>{block.title}</strong><span>{BLOCK_LABELS[block.type]} · {block.body.slice(0, 80)}</span></button><div className="csp-row-actions"><button type="button" onClick={() => moveBlock(index, -1)} aria-label="เลื่อนขึ้น"><ChevronLeft className="h-4 w-4 -rotate-90" /></button><button type="button" onClick={() => moveBlock(index, 1)} aria-label="เลื่อนลง"><ChevronRight className="h-4 w-4 rotate-90" /></button><button type="button" className="is-danger" onClick={() => setBlocks(previous => previous.filter(item => item.id !== block.id))} aria-label="ลบ block">×</button></div></div>)}</div><div className="csp-add-blocks">{(['Text', 'Heading', 'Image', 'Prompt', 'UI Code', 'Divider', 'Note'] as WorkBlockType[]).map(type => <button type="button" key={type} onClick={() => addBlock(type)}><Plus className="h-3.5 w-3.5" />{BLOCK_LABELS[type]}</button>)}</div></section>{activeBlock && <section className="csp-work-section csp-block-editor"><div className="csp-section-heading"><div><h3>Block Editor · {activeBlock.title}</h3><p>แก้เนื้อหาของ block ที่เลือกใน session นี้</p></div><span>{activeBlock.type}</span></div><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => updateActiveBlock({ title: event.target.value })} /></label><label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock({ body: event.target.value })} rows={activeBlock.type === 'UI Code' ? 10 : 7} /></label></section>}</>}
      {section === 'media' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>สื่อ</h3><p>ไฟล์ทั้งหมดเป็น data URL ใน QA Sandbox · ไม่อัปโหลด storage</p></div><span>Local only</span></div><div className="csp-media-placeholder"><ImagePlus className="h-7 w-7" /><strong>Cover / Gallery</strong><span>เลือกภาพชั่วคราวเพื่อใช้ใน review และ Work Card</span><label className="csp-secondary-button csp-file-button">เลือกภาพจากเครื่อง<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageFile} /></label></div>{mediaImages.length > 0 && <div className="csp-media-strip">{mediaImages.map((image, index) => <button type="button" key={`${image.slice(0, 20)}-${index}`} onClick={() => setMediaImages(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`ลบภาพที่ ${index + 1}`}><img src={image} alt="" /></button>)}</div>}</section>}
      {section === 'review' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>ตรวจสอบ</h3><p>Rendered preview จาก draft ในหน่วยความจำปัจจุบัน · ยังไม่บันทึก</p></div><div className="csp-review-switcher"><button type="button" className={reviewViewport === 'desktop' ? 'is-active' : ''} onClick={() => setReviewViewport('desktop')}>Desktop</button><button type="button" className={reviewViewport === 'mobile' ? 'is-active' : ''} onClick={() => setReviewViewport('mobile')}>Mobile</button></div></div><div className={`csp-review-card ${reviewViewport === 'mobile' ? 'is-mobile' : ''}`}><div className="csp-review-icon">{isValidWorkIcon(draftPreview.icon) ? draftPreview.icon.type === 'emoji' || draftPreview.icon.type === 'kaomoji' ? draftPreview.icon.value : <img src={draftPreview.icon.value} alt="" /> : '✦'}</div><div><strong>{draftPreview.title}</strong><span>{category} · {visibility} · {status}</span>{creatorProfile && <small className="csp-preview-author">โดย {creatorProfile.displayName}{creatorProfile.username ? ` · @${creatorProfile.username}` : ''}</small>}<p data-preview-field="short-description">{draftPreview.description || 'ยังไม่มีคำอธิบายสั้น'}</p><div className="csp-tag-list">{draftPreview.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>{draftPreview.previewImages.length > 0 && <div className="csp-media-strip">{draftPreview.previewImages.map((image, index) => <img key={`${image.slice(0, 20)}-${index}`} src={image} alt="" />)}</div>}</div></div><div className="csp-work-section" data-preview-section="content-blocks"><div className="csp-section-heading"><div><h3>Main Content</h3><p>Content Blocks จาก draft ปัจจุบัน</p></div><span>{draftPreview.contentBlocks.filter(block => block.type !== 'UI Code').length} blocks</span></div>{draftPreview.contentBlocks.filter(block => block.type !== 'UI Code').map(block => <article key={block.id} className="csp-preview-block"><small>{BLOCK_LABELS[block.type]}</small><strong>{block.title}</strong><p>{block.body}</p></article>)}{draftPreview.contentBlocks.every(block => block.type === 'UI Code') && <div className="csp-empty-inline">ยังไม่มี Main Content</div>}</div>{draftPreview.uiCodeSnippet && <div className="csp-code-preview-wrap" data-preview-section="ui-code"><div className="csp-section-heading"><div><h3>UI Code · CODE / PREVIEW</h3><p>Renderer เดียวกับ canonical Work Detail</p></div><Eye className="h-4 w-4" /></div><div className="csp-code-tabs"><button type="button" className={codeView === 'preview' ? 'is-active' : ''} onClick={() => setCodeView('preview')}>PREVIEW</button><button type="button" className={codeView === 'code' ? 'is-active' : ''} onClick={() => setCodeView('code')}>CODE</button></div>{codeView === 'preview' ? <SandboxedCodePreview code={draftPreview.uiCodeSnippet} minHeight="220px" /> : <pre className="csp-code-source">{draftPreview.uiCodeSnippet}</pre>}</div>}</section>}
    </main><aside className="csp-work-sidebar"><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Metadata</h3><p>ข้อมูลนี้จะถูกส่งให้ repository เมื่อกดสร้าง</p></div><span>Draft</span></div><label className="csp-field">Visibility<select value={visibility} onChange={event => setVisibility(event.target.value)}><option>ส่วนตัว</option><option>สาธารณะ</option></select></label><label className="csp-field">Workflow status<select value={status} onChange={event => setStatus(event.target.value)}><option>ไอเดีย</option><option>แบบร่าง</option><option>กำลังทำ</option><option>เสร็จสมบูรณ์</option><option>จัดเก็บแล้ว</option></select></label><label className="csp-field">Folder<select value={folderId || ''} onChange={event => setFolderId(event.target.value || null)}><option value="">ไม่มีโฟลเดอร์</option>{folders.map(folder => <option value={folder.id} key={folder.id}>{folder.icon || '📁'} {folder.name}</option>)}</select></label></section><section className="csp-work-section"><div className="csp-section-heading"><div><h3>Tags</h3><p>{tags.length}/10</p></div></div><div className="csp-tag-list">{tags.map(tag => <button type="button" key={tag} onClick={() => setTags(previous => previous.filter(item => item !== tag))}>#{tag} ×</button>)}</div><div className="csp-tag-entry"><input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="พิมพ์ tag แล้วกด Enter" /><button type="button" onClick={addTag}>เพิ่ม</button></div></section><section className="csp-work-section csp-persistence-note"><strong>QA Sandbox boundary</strong><p>Create Work, blocks, media และ asset ใหม่จะอยู่ใน local adapter เท่านั้น ไม่มี production write ในโหมดนี้</p></section></aside></div>
    <footer className="csp-modal-footer"><span>{isSaving ? (initialData ? 'กำลังบันทึกใน local sandbox…' : 'กำลังสร้างใน local sandbox…') : (initialData ? 'พร้อมบันทึก · local only' : 'พร้อมสร้าง · local only')}</span><button type="button" className="csp-secondary-button" onClick={onClose}>ยกเลิก</button><button type="button" className="csp-primary-button" disabled={isSaving || !title.trim()} onClick={() => void saveWork()}>{isSaving ? 'กำลังบันทึก…' : initialData ? 'บันทึกการแก้ไข' : 'สร้างผลงาน'}</button></footer>
  </section>{nestedEditorOpen && activeBlock && <div className="csp-nested-modal" role="dialog" aria-modal="true" aria-label={`Block Editor ${activeBlock.title}`}><section className="csp-nested-modal-card"><header className="csp-modal-header"><div><p className="csp-eyebrow">MAIN CONTENT · LARGE EDITOR</p><h2>{activeBlock.title}</h2></div><button type="button" className="csp-icon-button" onClick={() => setNestedEditorOpen(false)} aria-label="ปิด editor"><X className="h-4 w-4" /></button></header><div className="csp-nested-modal-body"><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => updateActiveBlock({ title: event.target.value })} /></label>{activeBlock.type === 'UI Code' ? <><label className="csp-field">CODE · HTML + CSS<textarea value={activeBlock.body} onChange={event => updateActiveBlock({ body: event.target.value })} rows={18} /></label><div className="csp-code-preview-wrap"><strong>PREVIEW</strong><SandboxedCodePreview code={activeBlock.body} minHeight="240px" /></div></> : <label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock({ body: event.target.value })} rows={14} /></label>}</div><footer className="csp-modal-footer"><span>กลับไปยังตำแหน่งเดิมใน workspace ได้โดยไม่หาย</span><button type="button" className="csp-primary-button" onClick={() => setNestedEditorOpen(false)}>เสร็จสิ้น</button></footer></section></div>}</div>;
};
