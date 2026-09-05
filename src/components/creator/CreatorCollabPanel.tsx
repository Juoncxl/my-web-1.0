import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, Copy, ImagePlus, Link2, Maximize2, Plus, Search, Trash2, X } from 'lucide-react';
import type { Asset, AssetVisibility, User } from '../../types';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { CreatorFocusEditor } from './CreatorContentCanvas';
import { formatContentCounter, type CreatorContentCounterMode } from './creatorContentModel';
import { CREATOR_MEDIA_MAX_ITEMS, createMediaItem, isSupportedCreatorGlobalMediaFile } from './creatorMediaModel';
import {
  addCollabDeadline,
  addCollabParticipant,
  addCollabParticipantReferenceImage,
  addCollabSharedInformation,
  createBlankCollabParticipant,
  createBlankCollabSharedInformation,
  createPublicCollaborationSnapshot,
  getCollabStatusLabel,
  getCollaborationSummary,
  removeCollabDeadline,
  removeCollabParticipant,
  removeCollabParticipantReferenceImage,
  removeCollabSharedInformation,
  setCollabParticipantReferenceImageDimensions,
  updateCollabDraft,
  updateCollabParticipant,
  updateCollabSharedInformation,
  upsertCollabDeadline,
  CREATOR_COLLAB_DEADLINE_PRESETS,
  CREATOR_COLLAB_STATUS_OPTIONS,
  type CreatorCollabDeadline,
  type CreatorCollabParticipant,
  type CreatorCollabSharedInformation,
  type CreatorCollabSubmissionStatus,
  type CreatorCollaborationDraft
} from './creatorCollabModel';

export interface CreatorCollabPanelProps {
  draft: CreatorCollaborationDraft;
  visibility: AssetVisibility;
  onVisibilityChange: (visibility: 'private' | 'public') => void;
  platformOptions: string[];
  counterMode: CreatorContentCounterMode;
  onCounterModeChange: (mode: CreatorContentCounterMode) => void;
  creatorProfile?: User | null;
  ownedWorks?: Asset[];
  currentWorkId?: string;
  onChange: (draft: CreatorCollaborationDraft) => void;
}

type FocusTarget = { kind: 'shared' | 'participant'; id: string; title: string; code: boolean };
const statusOptions = CREATOR_COLLAB_STATUS_OPTIONS;

function getAssetTypeLabel(asset: Asset): string {
  if (asset.category === 'character') return 'ตัวละคร';
  if (asset.category === 'lore') return 'โลกทัศน์';
  if (asset.category === 'ui_code') return 'UI';
  if (asset.category === 'prompts') return 'พรอมต์';
  return 'ผลงาน';
}

function formatDeadlineDate(date: string): string {
  if (!date) return 'ยังไม่กำหนดวัน';
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function copyCollabText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch { return false; }
}

function readReferenceImage(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

interface PlatformPickerProps { selected: string[]; options: string[]; label: string; onChange: (platforms: string[]) => void; }
const PlatformPicker: React.FC<PlatformPickerProps> = ({ selected, options, label, onChange }) => {
  const customPlatforms = selected.filter(platform => !options.includes(platform));
  const toggle = (platform: string) => onChange(selected.includes(platform) ? selected.filter(item => item !== platform) : [...selected, platform]);
  return <div className="csp-collab-platform-picker" aria-label={label}><div className="csp-collab-platform-options">{options.map(platform => <button type="button" key={platform} className={selected.includes(platform) ? 'is-selected' : ''} aria-pressed={selected.includes(platform)} onClick={() => toggle(platform)}>{platform}</button>)}{customPlatforms.map(platform => <button type="button" key={platform} className="is-selected is-custom" aria-pressed="true" onClick={() => toggle(platform)}>{platform} <span aria-hidden="true">×</span></button>)}</div></div>;
};

const CounterSwitcher: React.FC<{ value: CreatorContentCounterMode; onChange: (mode: CreatorContentCounterMode) => void }> = ({ value, onChange }) => <div className="csp-content-counter-switcher csp-collab-counter-switcher" aria-label="รูปแบบตัวนับข้อมูลคอลแลป"><span>ตัวนับ:</span><button type="button" className={value === 'characters' ? 'is-active' : ''} aria-pressed={value === 'characters'} onClick={() => onChange('characters')}>ตัวอักษร</button><button type="button" className={value === 'tokens' ? 'is-active' : ''} aria-pressed={value === 'tokens'} onClick={() => onChange('tokens')}>โทเคนโดยประมาณ</button></div>;

const StatusPicker: React.FC<{ value: CreatorCollabSubmissionStatus; label: string; onChange: (value: CreatorCollabSubmissionStatus) => void }> = ({ value, label, onChange }) => <div className="csp-collab-status-picker" aria-label={label}>{statusOptions.map(option => <button type="button" key={option.value} className={value === option.value ? 'is-selected' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;

interface SharedInformationItemProps {
  item: CreatorCollabSharedInformation;
  expanded: boolean;
  counterMode: CreatorContentCounterMode;
  platformOptions: string[];
  onToggle: () => void;
  onChange: (update: Partial<CreatorCollabSharedInformation>) => void;
  onRemove: () => void;
  onExpand: () => void;
}

const SharedInformationItem: React.FC<SharedInformationItemProps> = ({ item, expanded, counterMode, platformOptions, onToggle, onChange, onRemove, onExpand }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (await copyCollabText(item.content)) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); } };
  const scopeLabel = item.appScope === 'unspecified' ? 'ไม่ระบุ' : item.appScope === 'all_apps' ? 'ทุกแอป' : `เฉพาะแอป${item.platforms.length ? ` · ${item.platforms.join(', ')}` : ''}`;
  return <article className={`csp-collab-shared-item ${expanded ? 'is-expanded' : ''}`} data-shared-information-id={item.id}>
    <div className="csp-collab-shared-summary"><button type="button" className="csp-collab-shared-toggle" onClick={onToggle} aria-expanded={expanded} aria-controls={`csp-collab-shared-detail-${item.id}`}><span><strong>{item.title.trim() || 'ยังไม่ได้ตั้งชื่อหัวข้อ'}</strong><small>{item.type === 'code' ? 'โค้ด' : 'ข้อความ'} · {scopeLabel}</small></span><ChevronDown aria-hidden="true" /></button><button type="button" className="csp-collab-detail-button" onClick={onToggle}>{expanded ? 'ปิด' : 'ดูรายละเอียด'}</button></div>
    {expanded && <div className="csp-collab-shared-detail" id={`csp-collab-shared-detail-${item.id}`}>
      <div className="csp-collab-detail-fields"><label className="csp-field">ชื่อหัวข้อ<input value={item.title} onChange={event => onChange({ title: event.target.value })} placeholder="ตั้งชื่อข้อมูลที่ต้องการแชร์" /></label><div className="csp-field"><span>ประเภทข้อมูล</span><div className="csp-choice-row csp-collab-choice-row">{([['text', 'ข้อความ'], ['code', 'โค้ด']] as const).map(([value, label]) => <button type="button" key={value} className={item.type === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={item.type === value} onClick={() => onChange({ type: value })}>{label}</button>)}</div></div></div>
      <div className="csp-collab-detail-group"><div className="csp-collab-detail-heading"><strong>ใช้กับ</strong><span>ไม่บังคับ</span></div><div className="csp-choice-row csp-collab-choice-row">{([['unspecified', 'ไม่ระบุ'], ['all_apps', 'ทุกแอป'], ['specific_apps', 'เฉพาะแอป']] as const).map(([value, label]) => <button type="button" key={value} className={item.appScope === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={item.appScope === value} onClick={() => onChange({ appScope: value })}>{label}</button>)}</div>{item.appScope === 'specific_apps' && <div className="csp-collab-app-scope"><PlatformPicker selected={item.platforms} options={platformOptions} label={`แพลตฟอร์มของ ${item.title || 'ข้อมูลกลาง'}`} onChange={platforms => onChange({ platforms })} /><input className="csp-collab-inline-input" aria-label="เพิ่มแพลตฟอร์มเฉพาะข้อมูลกลาง" placeholder="พิมพ์ชื่อแอปแล้วกด Enter" onKeyDown={event => { if (event.key !== 'Enter') return; event.preventDefault(); const value = event.currentTarget.value.trim(); if (value && !item.platforms.includes(value)) onChange({ platforms: [...item.platforms, value] }); event.currentTarget.value = ''; }} /></div>}</div>
      <div className={`csp-content-long-editor csp-collab-long-editor ${item.type === 'code' ? 'is-code-editor' : ''}`}><div className="csp-content-editor-heading"><label htmlFor={`csp-collab-shared-editor-${item.id}`}>เนื้อหา</label><div className="csp-content-editor-tools"><span>{formatContentCounter(item.content, counterMode)}</span><button type="button" className="csp-content-expand-button" onClick={onExpand}><Maximize2 className="h-3.5 w-3.5" />ขยาย</button></div></div><textarea id={`csp-collab-shared-editor-${item.id}`} value={item.content} onChange={event => onChange({ content: event.target.value })} placeholder={item.type === 'code' ? 'วางหรือเขียน code snippet ที่ต้องการแชร์' : 'เขียนข้อมูลกลางที่ต้องการแชร์กับคอลแลป'} rows={8} spellCheck={item.type !== 'code'} className={item.type === 'code' ? 'csp-code-textarea' : undefined} /></div>
      <div className="csp-collab-shared-footer"><button type="button" className="csp-secondary-button" onClick={() => void copy()}><Copy className="h-3.5 w-3.5" />{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button><button type="button" className="csp-collab-remove-button" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />ลบข้อมูล</button></div>
    </div>}
  </article>;
};

interface ParticipantReferenceGalleryProps { participant: CreatorCollabParticipant; onAdd: (files: File[]) => void; onRemove: (imageId: string) => void; onDimensions: (imageId: string, width: number, height: number) => void; }
const ParticipantReferenceGallery: React.FC<ParticipantReferenceGalleryProps> = ({ participant, onAdd, onRemove, onDimensions }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const onFiles = (event: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files || []); const available = CREATOR_MEDIA_MAX_ITEMS - participant.referenceImages.length; if (files.length > available) setError(`เพิ่มได้สูงสุด ${CREATOR_MEDIA_MAX_ITEMS} รูป`); const validFiles = files.slice(0, Math.max(0, available)).filter(file => isSupportedCreatorGlobalMediaFile(file)); if (validFiles.length !== Math.min(files.length, Math.max(0, available))) setError('รองรับ PNG, JPG หรือ WebP ขนาดไม่เกิน 10MB'); if (validFiles.length) onAdd(validFiles); event.target.value = ''; };
  return <div className="csp-collab-reference-gallery"><div className="csp-collab-detail-heading"><strong>รูป / Reference</strong><span>{participant.referenceImages.length} / {CREATOR_MEDIA_MAX_ITEMS} รูป</span></div><input ref={inputRef} className="csp-visually-hidden-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onFiles} /><button type="button" className="csp-secondary-button" onClick={() => inputRef.current?.click()} disabled={participant.referenceImages.length >= CREATOR_MEDIA_MAX_ITEMS}><ImagePlus className="h-3.5 w-3.5" />เพิ่มรูป</button>{error && <span className="csp-collab-inline-error" role="alert">{error}</span>}{participant.referenceImages.length > 0 && <div className="csp-collab-reference-grid">{participant.referenceImages.map((image, index) => <figure key={image.id}><button type="button" onClick={() => setViewingImage(image.src)} aria-label={`ดูรูป Reference ${index + 1}`}><img src={image.src} alt={`Reference ${index + 1} ของ ${participant.creatorName || 'ผู้เข้าร่วม'}`} onLoad={event => onDimensions(image.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} /></button><button type="button" className="csp-collab-reference-remove" onClick={() => onRemove(image.id)} aria-label={`ลบรูป Reference ${index + 1}`}><X className="h-3.5 w-3.5" /></button></figure>)}</div>}{viewingImage && <div className="csp-collab-image-lightbox" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setViewingImage(null); }}><section role="dialog" aria-modal="true" aria-label="ดูรูป Reference"><button type="button" className="csp-icon-button" onClick={() => setViewingImage(null)} aria-label="ปิดรูป Reference">×</button><img src={viewingImage} alt="รูป Reference ขนาดเต็ม" /></section></div>}</div>;
};

interface ParticipantRowProps { participant: CreatorCollabParticipant; isExpanded: boolean; draft: CreatorCollaborationDraft; platformOptions: string[]; linkableWorks: Asset[]; counterMode: CreatorContentCounterMode; onToggle: () => void; onChange: (update: Partial<CreatorCollabParticipant>) => void; onRemove: () => void; onExpandNotes: () => void; onAddReference: (files: File[]) => void; onRemoveReference: (imageId: string) => void; onReferenceDimensions: (imageId: string, width: number, height: number) => void; }
const ParticipantRow: React.FC<ParticipantRowProps> = ({ participant, isExpanded, draft, platformOptions, linkableWorks, counterMode, onToggle, onChange, onRemove, onExpandNotes, onAddReference, onRemoveReference, onReferenceDimensions }) => {
  const enabledDeadlines = draft.deadlines;
  const toggleLinkedWork = (workId: string) => onChange({ linkedWorkIds: participant.linkedWorkIds.includes(workId) ? participant.linkedWorkIds.filter(id => id !== workId) : [...participant.linkedWorkIds, workId] });
  return <article className={`csp-collab-participant ${isExpanded ? 'is-expanded' : ''}`} data-participant-id={participant.id}><div className="csp-collab-participant-summary"><button type="button" className="csp-collab-participant-toggle" aria-expanded={isExpanded} aria-controls={`csp-collab-participant-detail-${participant.id}`} onClick={onToggle}><span className="csp-collab-participant-main"><strong>{participant.creatorName.trim() || 'ยังไม่ได้ระบุชื่อ'}</strong><span>{participant.houseTag.trim() ? `#${participant.houseTag.replace(/^#/, '')}` : '#ยังไม่ระบุบ้าน'}{participant.platforms.length ? ` · ${participant.platforms.join(', ')}` : ''}</span></span><span className="csp-collab-participant-statuses"><span className={`csp-collab-status-pill status-${participant.dataStatus}`}>{getCollabStatusLabel(participant.dataStatus)} <small>ข้อมูล</small></span><span className={`csp-collab-status-pill status-${participant.imageStatus}`}>{getCollabStatusLabel(participant.imageStatus)} <small>รูป</small></span></span><ChevronDown className="csp-collab-participant-chevron" aria-hidden="true" /></button><button type="button" className="csp-collab-detail-button" onClick={onToggle}>{isExpanded ? 'ปิดรายละเอียด' : 'ดูรายละเอียด'}</button></div>
    {isExpanded && <div className="csp-collab-participant-detail" id={`csp-collab-participant-detail-${participant.id}`}><div className="csp-collab-detail-fields"><label className="csp-field">ชื่อครีเอเตอร์<input value={participant.creatorName} onChange={event => onChange({ creatorName: event.target.value })} placeholder="เช่น Juon" /></label><label className="csp-field">แท็กบ้าน / กลุ่ม<input value={participant.houseTag} onChange={event => onChange({ houseTag: event.target.value.replace(/^#/, '') })} placeholder="เช่น บ้านA" /></label><label className="csp-field">ช่องทางติดต่อ / ลิงก์ <span className="csp-collab-optional">ไม่บังคับ</span><input value={participant.contact} onChange={event => onChange({ contact: event.target.value })} placeholder="เช่น @name หรือ https://…" /></label><label className="csp-field">ตัวละคร / ผลงานที่ส่ง <span className="csp-collab-optional">ชื่อสั้น ๆ</span><input value={participant.externalWorkName} onChange={event => onChange({ externalWorkName: event.target.value })} placeholder="เช่น หลิวเฉิง" /></label></div><div className="csp-collab-detail-group"><div className="csp-collab-detail-heading"><strong>แอป / แพลตฟอร์มของคนนี้</strong><span>เลือกได้หลายรายการ</span></div><PlatformPicker selected={participant.platforms} options={platformOptions} onChange={platforms => onChange({ platforms })} label={`แพลตฟอร์มของ ${participant.creatorName || 'ผู้เข้าร่วม'}`} /><input className="csp-collab-inline-input" aria-label="เพิ่มแพลตฟอร์มเฉพาะผู้เข้าร่วม" placeholder="พิมพ์ชื่อแอปแล้วกด Enter" onKeyDown={event => { if (event.key !== 'Enter') return; event.preventDefault(); const value = event.currentTarget.value.trim(); if (value && !participant.platforms.includes(value)) onChange({ platforms: [...participant.platforms, value] }); event.currentTarget.value = ''; }} /></div><div className="csp-collab-detail-group"><div className="csp-collab-detail-heading"><strong>สถานะการส่งข้อมูล</strong><span>แยกข้อมูลกับรูปคนละสถานะ</span></div><div className="csp-collab-status-field"><span>ข้อมูล</span><StatusPicker value={participant.dataStatus} onChange={dataStatus => onChange({ dataStatus })} label="สถานะข้อมูล" /></div><div className="csp-collab-status-field"><span>รูป</span><StatusPicker value={participant.imageStatus} onChange={imageStatus => onChange({ imageStatus })} label="สถานะรูป" /></div></div><div className="csp-content-long-editor csp-collab-long-editor"><div className="csp-content-editor-heading"><label htmlFor={`csp-collab-notes-${participant.id}`}>ข้อมูล / โน้ตที่ได้รับ</label><div className="csp-content-editor-tools"><span>{formatContentCounter(participant.notes, counterMode)}</span><button type="button" className="csp-content-expand-button" onClick={onExpandNotes}><Maximize2 className="h-3.5 w-3.5" />ขยาย</button></div></div><textarea id={`csp-collab-notes-${participant.id}`} value={participant.notes} onChange={event => onChange({ notes: event.target.value })} placeholder="วางข้อมูลที่ส่งมา บันทึกการแก้ไข หรือเตือนความจำ" rows={7} /></div><ParticipantReferenceGallery participant={participant} onAdd={onAddReference} onRemove={onRemoveReference} onDimensions={onReferenceDimensions} />{participant.isOwner && <div className="csp-collab-detail-group csp-collab-linked-works"><div className="csp-collab-detail-heading"><strong><Link2 className="h-3.5 w-3.5" />ผลงานที่เชื่อมจาก CXL</strong><span>เก็บเป็นลิงก์ ไม่คัดลอกเนื้อหา</span></div>{linkableWorks.length ? <div className="csp-collab-linked-work-list">{linkableWorks.map(work => <label key={work.id} className="csp-collab-linked-work"><input type="checkbox" checked={participant.linkedWorkIds.includes(work.id)} onChange={() => toggleLinkedWork(work.id)} /><span><strong>{work.title}</strong><small>{getAssetTypeLabel(work)}</small></span></label>)}</div> : <p className="csp-collab-muted">ยังไม่มีผลงานอื่นที่เชื่อมได้ในคลังของคุณ</p>}</div>}{enabledDeadlines.length > 0 && <div className="csp-collab-detail-group csp-collab-overrides"><label className="csp-collab-override-toggle"><input type="checkbox" checked={participant.useDeadlineOverrides} onChange={event => onChange({ useDeadlineOverrides: event.target.checked })} /><span>กำหนดส่งเฉพาะคนนี้</span></label><span className="csp-collab-override-hint">ถ้าไม่เปิด จะใช้กำหนดส่งร่วมของคอลแลปเป็นค่าเริ่มต้น</span>{participant.useDeadlineOverrides && <div className="csp-collab-override-list">{enabledDeadlines.map(deadline => <label key={deadline.id} className="csp-field">{deadline.label || 'กำหนดส่ง'}<input type="date" value={participant.deadlineOverrides[deadline.id] || ''} onChange={event => onChange({ deadlineOverrides: { ...participant.deadlineOverrides, [deadline.id]: event.target.value } })} /></label>)}</div>}</div>}<div className="csp-collab-participant-footer"><span>{participant.isOwner ? 'รายการของฉัน · ข้อมูลนี้อยู่เฉพาะใน draft ของ Composer' : 'ข้อมูลผู้เข้าร่วมนี้อยู่ในคอลแลปนี้เท่านั้น ไม่สร้างผลงานเข้าคลังอัตโนมัติ'}</span><button type="button" className="csp-collab-remove-button" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />ลบผู้เข้าร่วม</button></div></div>}
  </article>;
};

const DeadlineRow: React.FC<{ deadline: CreatorCollabDeadline; onChange: (update: Partial<CreatorCollabDeadline>) => void; onRemove: () => void }> = ({ deadline, onChange, onRemove }) => <div className="csp-collab-deadline-row"><input value={deadline.label} onChange={event => onChange({ label: event.target.value })} placeholder="ชื่อกำหนดส่ง" aria-label="ชื่อกำหนดส่ง" /><input type="date" value={deadline.date} onChange={event => onChange({ date: event.target.value })} aria-label={`วันที่ ${deadline.label || 'กำหนดส่ง'}`} /><span className="csp-collab-deadline-readable">{formatDeadlineDate(deadline.date)}</span><button type="button" className="csp-collab-inline-remove" onClick={onRemove} aria-label={`ลบกำหนดส่ง ${deadline.label || ''}`}><X className="h-3.5 w-3.5" /></button></div>;

export const CreatorCollabPanel: React.FC<CreatorCollabPanelProps> = ({ draft, visibility, onVisibilityChange, platformOptions, counterMode, onCounterModeChange, creatorProfile = null, ownedWorks = [], currentWorkId, onChange }) => {
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  const [expandedSharedId, setExpandedSharedId] = useState<string | null>(null);
  const [participantToRemove, setParticipantToRemove] = useState<CreatorCollabParticipant | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const summary = getCollaborationSummary(draft);
  const linkableWorks = useMemo(() => ownedWorks.filter(work => work.userId === creatorProfile?.id && work.id !== currentWorkId && !work.deletedAt && work.category !== 'collab'), [creatorProfile?.id, currentWorkId, ownedWorks]);
  const visibleParticipants = useMemo(() => { const query = search.trim().toLowerCase(); return query ? draft.participants.filter(participant => [participant.creatorName, participant.houseTag, participant.externalWorkName, participant.contact, ...participant.platforms].some(value => value.toLowerCase().includes(query))) : draft.participants; }, [draft.participants, search]);
  const changeDraft = (update: Partial<CreatorCollaborationDraft>) => onChange(updateCollabDraft(draft, update));
  const addParticipant = (isOwner = false) => { const participant = createBlankCollabParticipant({ isOwner, creatorName: isOwner ? creatorProfile?.displayName || 'ฉัน' : '', platforms: isOwner ? [...draft.platforms] : [] }); onChange(addCollabParticipant(draft, participant)); setExpandedParticipantId(participant.id); };
  const addSharedInformation = () => { const item = createBlankCollabSharedInformation(); onChange(addCollabSharedInformation(draft, item)); setExpandedSharedId(item.id); };
  const addDeadline = (kind: CreatorCollabDeadline['kind']) => { const next = addCollabDeadline(draft, kind); onChange(next); setDeadlinePickerOpen(false); };
  const updateFocusValue = (value: string) => { if (!focusTarget) return; if (focusTarget.kind === 'shared') onChange(updateCollabSharedInformation(draft, focusTarget.id, { content: value })); else onChange(updateCollabParticipant(draft, focusTarget.id, { notes: value })); };
  const focusValue = focusTarget?.kind === 'shared' ? draft.sharedInformation.find(item => item.id === focusTarget.id)?.content || '' : focusTarget ? draft.participants.find(item => item.id === focusTarget.id)?.notes || '' : '';
  const ownerEntry = draft.participants.find(participant => participant.isOwner);
  const publicSnapshot = useMemo(() => createPublicCollaborationSnapshot(draft), [draft]);
  const copyPublicSummary = async () => {
    const participantLines = publicSnapshot.participants.map(participant => [
      participant.creatorName,
      participant.houseTag ? `#${participant.houseTag}` : '',
      participant.platforms.join(', '),
      participant.externalWorkName,
      participant.notes
    ].filter(Boolean).join(' · '));
    const text = [
      publicSnapshot.name,
      publicSnapshot.sharedTag ? `#${publicSnapshot.sharedTag}` : '',
      publicSnapshot.platforms.length ? `แพลตฟอร์ม: ${publicSnapshot.platforms.join(', ')}` : '',
      ...publicSnapshot.sharedInformation.map(item => `${item.title || 'ข้อมูลกลาง'}\n${item.content}`),
      ...publicSnapshot.deadlines.map(deadline => `${deadline.label || 'กำหนดส่ง'}: ${deadline.date || 'ยังไม่ระบุวันที่'}`),
      ...(participantLines.length ? ['ผู้เข้าร่วม', ...participantLines] : [])
    ].filter(Boolean).join('\n\n');
    await copyCollabText(text);
  };
  const visibilityControls = <section className="csp-collab-area csp-collab-public-settings" aria-labelledby="csp-collab-public-settings-title">
    <div className="csp-collab-area-heading">
      <div><h3 id="csp-collab-public-settings-title">ข้อมูลที่เปิดให้คนอื่นเห็น</h3><p>ข้อมูลโปรโมตพื้นฐานแสดงตามปกติ ส่วนข้อมูลจัดการเปิดเผยได้เป็นหมวด</p></div>
      <button type="button" className="csp-secondary-button" onClick={() => void copyPublicSummary()}><Copy className="h-3.5 w-3.5" />คัดลอกข้อมูลสาธารณะ</button>
    </div>
    <div className="csp-collab-public-options">
      {([
        ['showParticipantStatuses', 'เผยแพร่สถานะการส่ง', 'แสดงสถานะข้อมูลและรูปของผู้เข้าร่วม'],
        ['showParticipantNotes', 'เผยแพร่โน้ตผู้เข้าร่วม', 'แสดงเฉพาะโน้ตที่ตั้งใจใช้สื่อสารหรือโปรโมต'],
        ['showParticipantDeadlineOverrides', 'เผยแพร่กำหนดส่งเฉพาะคน', 'แสดงวันที่กำหนดส่งรายคนที่ตั้งไว้']
      ] as const).map(([key, label, description]) => <label key={key} className="csp-collab-public-option">
        <input type="checkbox" checked={draft.visibilityPolicy[key]} onChange={event => changeDraft({ visibilityPolicy: { ...draft.visibilityPolicy, [key]: event.target.checked } })} />
        <span><strong>{label}</strong><small>{description}</small></span>
      </label>)}
    </div>
    <p className="csp-collab-contact-guard">ช่องทางติดต่อและลิงก์ในช่องติดต่อเป็นข้อมูลส่วนตัวเสมอ และจะไม่อยู่ในหน้าสาธารณะหรือไฟล์ส่งออก</p>
  </section>;
  return <section className="csp-work-section csp-collab-panel" aria-labelledby="csp-collab-title"><div className="csp-section-heading csp-collab-heading"><div><h2 id="csp-collab-title">คอลแลป</h2><p>จัดข้อมูลคอลแลปและติดตามการส่งงานของแต่ละคนใน draft นี้</p></div><span className="csp-collab-private-badge">{visibility === 'public' ? '🌐 สาธารณะ' : '🔒 ส่วนตัว'}</span></div><section className="csp-collab-visibility" aria-labelledby="csp-collab-visibility-title"><div><h3 id="csp-collab-visibility-title">การมองเห็นคอลแลป</h3><p>{visibility === 'public' ? 'คนอื่นจะเปิดดูและคัดลอกข้อมูลกลางได้' : 'มีเพียงคุณที่เปิดดูผลงานคอลแลปนี้ได้'}</p></div><div className="csp-choice-row">{([['private', '🔒 ส่วนตัว'], ['public', '🌐 สาธารณะ']] as const).map(([value, label]) => <button type="button" key={value} className={visibility === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={visibility === value} onClick={() => onVisibilityChange(value)}>{label}</button>)}</div></section><div className="csp-collab-private-note">{visibility === 'public' ? 'เผยแพร่ข้อมูลกลาง กำหนดส่งร่วม รายชื่อผู้เข้าร่วม และข้อมูลโปรโมต ส่วนข้อมูลจัดการจะแสดงตามสวิตช์ที่คุณเลือก' : 'ข้อมูลคอลแลปทั้งหมดจะไม่แสดงใน Work Card, หน้ารายละเอียดสาธารณะ หรือ Review'}</div>{visibilityControls}<section className="csp-collab-area" aria-labelledby="csp-collab-info-title"><div className="csp-collab-area-heading"><div><h3 id="csp-collab-info-title">ข้อมูลคอลแลป</h3><p>ชื่อคอลแลปแยกจากชื่อผลงาน ไม่ต้องกรอกซ้ำกัน</p></div></div><div className="csp-collab-info-grid"><label className="csp-field">ชื่อคอลแลป<input value={draft.name} onChange={event => changeDraft({ name: event.target.value })} placeholder="เช่น 77 จังหวัด" /></label><label className="csp-field">แท็กรวมคอลแลป<input value={draft.sharedTag} onChange={event => changeDraft({ sharedTag: event.target.value.replace(/^#/, '') })} placeholder="เช่น บ้านนักเดินทาง" /></label></div><div className="csp-collab-platform-block"><div className="csp-collab-detail-heading"><strong>แอป / แพลตฟอร์มของคอลแลป</strong><span>เลือกได้หลายรายการ · ไม่บังคับ</span></div><PlatformPicker selected={draft.platforms} options={platformOptions} onChange={platforms => changeDraft({ platforms })} label="แพลตฟอร์มของคอลแลป" /></div></section><section className="csp-collab-area" aria-labelledby="csp-collab-shared-title"><div className="csp-collab-area-heading"><div><h3 id="csp-collab-shared-title">ข้อมูลกลางของคอลแลป</h3><p>สร้างหัวข้อเองตามโครงสร้างที่คอลแลปนี้ต้องใช้</p></div><CounterSwitcher value={counterMode} onChange={onCounterModeChange} /></div>{draft.sharedInformation.length ? <div className="csp-collab-shared-list">{draft.sharedInformation.map(item => <SharedInformationItem key={item.id} item={item} expanded={expandedSharedId === item.id} counterMode={counterMode} platformOptions={platformOptions} onToggle={() => setExpandedSharedId(previous => previous === item.id ? null : item.id)} onChange={update => onChange(updateCollabSharedInformation(draft, item.id, update))} onRemove={() => { onChange(removeCollabSharedInformation(draft, item.id)); if (expandedSharedId === item.id) setExpandedSharedId(null); }} onExpand={() => setFocusTarget({ kind: 'shared', id: item.id, title: item.title || 'ข้อมูลกลางของคอลแลป', code: item.type === 'code' })} />)}</div> : <div className="csp-collab-empty-state"><strong>ยังไม่มีข้อมูลกลาง</strong><p>เพิ่มหัวข้อเมื่อคอลแลปนี้มีข้อมูลที่อยากแชร์ร่วมกัน</p></div>}<button type="button" className="csp-secondary-button" onClick={addSharedInformation}><Plus className="h-3.5 w-3.5" />เพิ่มข้อมูล</button></section><section className="csp-collab-area" aria-labelledby="csp-collab-deadline-title"><div className="csp-collab-area-heading"><div><h3 id="csp-collab-deadline-title">กำหนดส่ง</h3><p>เพิ่มเฉพาะเส้นตายที่คอลแลปนี้ต้องใช้</p></div></div>{draft.deadlines.length ? <div className="csp-collab-deadline-list">{draft.deadlines.map(deadline => <DeadlineRow key={deadline.id} deadline={deadline} onChange={update => onChange(upsertCollabDeadline(draft, deadline.id, update))} onRemove={() => onChange(removeCollabDeadline(draft, deadline.id))} />)}</div> : <div className="csp-collab-empty-state"><strong>ยังไม่มีกำหนดส่ง</strong><p>ถ้าไม่มี deadline ก็ปล่อยส่วนนี้ว่างได้เลย</p></div>}<div className="csp-collab-deadline-actions"><button type="button" className="csp-secondary-button" onClick={() => setDeadlinePickerOpen(previous => !previous)}><Plus className="h-3.5 w-3.5" />เพิ่มกำหนดส่ง</button>{deadlinePickerOpen && <div className="csp-collab-deadline-picker" role="group" aria-label="เลือกประเภทกำหนดส่ง">{CREATOR_COLLAB_DEADLINE_PRESETS.map(preset => <button type="button" key={preset.kind} onClick={() => addDeadline(preset.kind)}>{preset.label}</button>)}<button type="button" onClick={() => addDeadline('custom')}>✏️ กำหนดเอง</button></div>}</div></section><section className="csp-collab-area csp-collab-participants-area" aria-labelledby="csp-collab-participant-title"><div className="csp-collab-area-heading csp-collab-participant-heading"><div><h3 id="csp-collab-participant-title">ผู้เข้าร่วม</h3><p>เพิ่มรายชื่อและเปิดรายละเอียดเฉพาะคนที่กำลังจัดการ</p></div><div className="csp-collab-participant-summary-count"><strong>ผู้เข้าร่วม {summary.participants} คน</strong><span>ข้อมูลผ่าน {summary.dataApproved} / {summary.participants}</span><span>รูปผ่าน {summary.imageApproved} / {summary.participants}</span></div></div><div className="csp-collab-participant-actions"><div className="csp-collab-search"><Search className="h-4 w-4" aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาผู้เข้าร่วม" aria-label="ค้นหาผู้เข้าร่วม" /></div><div className="csp-collab-add-actions"><button type="button" className="csp-secondary-button" onClick={() => addParticipant(false)}><Plus className="h-3.5 w-3.5" />เพิ่มผู้เข้าร่วม</button>{!ownerEntry && <button type="button" className="csp-secondary-button csp-collab-owner-button" onClick={() => addParticipant(true)}><Plus className="h-3.5 w-3.5" />เพิ่มรายการของฉัน</button>}</div></div>{visibleParticipants.length ? <div className="csp-collab-participant-list">{visibleParticipants.map(participant => <ParticipantRow key={participant.id} participant={participant} isExpanded={expandedParticipantId === participant.id} draft={draft} platformOptions={platformOptions} linkableWorks={linkableWorks} counterMode={counterMode} onToggle={() => setExpandedParticipantId(previous => previous === participant.id ? null : participant.id)} onChange={update => onChange(updateCollabParticipant(draft, participant.id, update))} onRemove={() => setParticipantToRemove(participant)} onExpandNotes={() => setFocusTarget({ kind: 'participant', id: participant.id, title: participant.creatorName || 'ข้อมูล / โน้ตที่ได้รับ', code: false })} onAddReference={files => { void Promise.all(files.map(readReferenceImage)).then(sources => { let nextDraft = draft; sources.forEach((source, index) => { if (source) nextDraft = addCollabParticipantReferenceImage(nextDraft, participant.id, createMediaItem(source, files[index].type, `collab-reference-${participant.id}-${Date.now()}-${index}`)); }); onChange(nextDraft); }); }} onRemoveReference={imageId => onChange(removeCollabParticipantReferenceImage(draft, participant.id, imageId))} onReferenceDimensions={(imageId, width, height) => onChange(setCollabParticipantReferenceImageDimensions(draft, participant.id, imageId, width, height))} />)}</div> : <div className="csp-collab-empty-participants"><strong>{search ? 'ไม่พบผู้เข้าร่วมที่ค้นหา' : 'ยังไม่มีผู้เข้าร่วม'}</strong><p>{search ? 'ลองค้นหาด้วยชื่อครีเอเตอร์ บ้าน หรือแพลตฟอร์ม' : 'เริ่มจากเพิ่มคนในคอลแลป หรือเพิ่มรายการของฉันเพื่อเชื่อมผลงานตัวเอง'}</p></div>}</section><ConfirmationDialog isOpen={Boolean(participantToRemove)} title="ลบผู้เข้าร่วม?" description={participantToRemove ? `ลบ “${participantToRemove.creatorName.trim() || 'ผู้เข้าร่วมคนนี้'}” ออกจากคอลแลปนี้หรือไม่? ข้อมูลที่กรอกไว้จะถูกนำออกจาก draft นี้` : ''} confirmLabel="ลบผู้เข้าร่วม" onCancel={() => setParticipantToRemove(null)} onConfirm={() => { if (!participantToRemove) return; onChange(removeCollabParticipant(draft, participantToRemove.id)); if (expandedParticipantId === participantToRemove.id) setExpandedParticipantId(null); setParticipantToRemove(null); }} />{focusTarget && <CreatorFocusEditor title={focusTarget.title} value={focusValue} counterMode={counterMode} code={focusTarget.code} onChange={updateFocusValue} onClose={() => setFocusTarget(null)} />}</section>;
};
