import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Bookmark,
  Check,
  Clock3,
  Code2,
  Copy,
  Download,
  Edit3,
  FileText,
  Flag,
  Folder,
  FolderInput,
  GitFork,
  Globe2,
  History,
  Heart,
  ImageIcon,
  LockKeyhole,
  RotateCcw,
  Share2,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import type { Asset, AssetIcon, Folder as WorkFolder, User, WorkContentBlock } from '../types';
import { AUDIENCE_RATING_LABELS, CATEGORIES, STATUS_PRESETS } from '../lib/constants';
import { canViewAssetDetail } from '../lib/accessPolicy';
import { formatShortDate, formatThaiDate } from '../lib/dateUtils';
import { resolveWorkCreator } from '../lib/workPresentation';
import { resolveWorkPresentationContent } from '../lib/workContent';
import { getWorkDisplayPresentation } from '../lib/workDisplayPresentation';
import { isValidWorkIcon } from '../lib/assetVisibility';
import { createPublicAssetExport } from './creator/creatorWorkSerializer';
import { getCollabStatusLabel } from './creator/creatorCollabModel';
import { SandboxedCodePreview } from './SandboxedCodePreview';
import { ConfirmationDialog } from './ConfirmationDialog';

type CodeView = 'split' | 'preview' | 'code';

const BLOCK_LABELS: Record<WorkContentBlock['type'], string> = {
  Text: 'ข้อความ',
  Heading: 'หัวข้อ',
  Image: 'รูปภาพ',
  Prompt: 'Prompt',
  'UI Code': 'UI Code',
  Divider: 'เส้นแบ่ง',
  Note: 'โน้ต'
};

function WorkMark({ icon }: { icon?: AssetIcon }) {
  if (isValidWorkIcon(icon) && icon?.type === 'image') {
    return <img src={icon.value} alt="" />;
  }
  return <span>{isValidWorkIcon(icon) ? icon?.value : '✦'}</span>;
}

function CreatorAvatar({ avatarUrl, displayName }: { avatarUrl?: string; displayName: string }) {
  if (avatarUrl) return <img src={avatarUrl} alt={`Avatar ของ ${displayName}`} referrerPolicy="no-referrer" />;
  return <span aria-hidden="true">{Array.from(displayName.trim()).slice(0, 2).join('').toUpperCase() || 'CX'}</span>;
}

function CopyButton({ copied, label, onClick }: { copied: boolean; label: string; onClick: () => void }) {
  return <button type="button" className="work-detail-copy-button" onClick={onClick}>
    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    {copied ? 'คัดลอกแล้ว' : label}
  </button>;
}

const NON_DATA_LABELS = new Set(['ข้อมูล', 'ข้อความ', 'ข้อมูลกลางของคอลแลป', 'เนื้อหาหลัก', 'ช่องข้อมูล']);

function isMeaningfulCopyText(value: string, title = ''): boolean {
  const body = value.trim();
  const heading = title.trim();
  if (!body || body === heading || NON_DATA_LABELS.has(body)) return false;
  if (/^(?:ยังไม่มี|ไม่พบ|ไม่มี)/u.test(body)) return false;
  return true;
}

function CodePresentation({ code, view, onViewChange }: { code: string; view: CodeView; onViewChange: (view: CodeView) => void }) {
  return <>
    <div className="work-detail-code-tabs" role="tablist" aria-label="มุมมอง UI Code">
      {(['split', 'preview', 'code'] as const).map(option => <button type="button" role="tab" aria-selected={view === option} className={view === option ? 'is-active' : ''} key={option} onClick={() => onViewChange(option)}>{option === 'split' ? 'ตัวอย่าง + โค้ด' : option === 'preview' ? 'ตัวอย่าง' : 'โค้ดดิบ'}</button>)}
    </div>
    <div className={`work-detail-code-layout ${view === 'split' ? 'is-split' : ''}`}>
      {(view === 'split' || view === 'preview') && <div className="work-detail-code-panel"><span>ตัวอย่างแบบปลอดภัย</span><SandboxedCodePreview code={code} minHeight="280px" /></div>}
      {(view === 'split' || view === 'code') && <div className="work-detail-code-panel"><span>โค้ด HTML / CSS</span><pre><code>{code}</code></pre></div>}
    </div>
  </>;
}

function ContentBlock({ block, copied, onCopy }: { block: WorkContentBlock; copied: boolean; onCopy: () => void }) {
  if (block.type === 'Divider') {
    return <div className="work-detail-divider" aria-label={block.title || 'เส้นแบ่ง'}><span>✦</span></div>;
  }

  const body = block.body.trim();
  const isImageSource = block.type === 'Image' && /^(?:data:image\/|blob:|https?:\/\/)/i.test(body);
  const isCopyable = ['Text', 'Prompt', 'Note'].includes(block.type) && isMeaningfulCopyText(body, block.title);

  return <article className={`work-detail-block is-${block.type.toLowerCase().replace(/\s+/g, '-')}`}>
    <header>
      <div>
        <span>{BLOCK_LABELS[block.type]}</span>
        <strong>{block.title || BLOCK_LABELS[block.type]}</strong>
      </div>
      {isCopyable && <CopyButton copied={copied} label="คัดลอก" onClick={onCopy} />}
    </header>
    {block.type === 'Heading' ? <h4>{body || block.title}</h4>
      : isImageSource ? <figure><img src={body} alt={block.title || 'ภาพประกอบผลงาน'} referrerPolicy="no-referrer" /><figcaption>{block.title}</figcaption></figure>
        : block.type === 'Image' ? <div className="work-detail-image-placeholder"><ImageIcon aria-hidden="true" /><p>{body || 'ยังไม่มีภาพประกอบ'}</p></div>
          : block.type === 'Prompt' ? <pre>{body}</pre>
            : block.type === 'Note' ? <aside>{body}</aside>
              : <p>{body}</p>}
  </article>;
}

export interface WorkDetailModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (assetId: string) => void;
  onPermanentDelete?: (assetId: string) => void;
  onRestore?: (assetId: string) => void;
  onLike?: (assetId: string) => void;
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onSelectLinkedAsset?: (assetId: string) => void;
  allAssets?: Asset[];
  isOwner?: boolean;
  isBookmarked?: boolean;
  isLiked?: boolean;
  isTrashMode?: boolean;
  creatorProfile?: User | null;
  folders?: WorkFolder[];
  onMoveToFolder?: (asset: Asset) => void;
  /** Render the canonical presentation inside Composer Review instead of a viewport modal. */
  embedded?: boolean;
  /** Optional draft cover reference; the persisted Asset contract stays unchanged. */
  coverImage?: string;
  /** Preview-only switch so an unselected draft cover never falls back to gallery[0]. */
  coverImageSelected?: boolean;
  /** Preview keeps the exact public layout while disabling state-changing actions. */
  interactionMode?: 'live' | 'preview';
}

/** The one canonical Work presentation for both legacy and newly-created data. */
export const WorkDetailModal: React.FC<WorkDetailModalProps> = ({
  asset,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPermanentDelete,
  onRestore,
  onBookmark,
  onFork,
  onReport,
  onSelectLinkedAsset,
  allAssets = [],
  isOwner = false,
  isBookmarked = false,
  isLiked = false,
  isTrashMode = false,
  onLike,
  creatorProfile = null,
  folders = [],
  onMoveToFolder,
  embedded = false,
  coverImage = '',
  coverImageSelected = true,
  interactionMode = 'live'
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeView, setCodeView] = useState<CodeView>('split');
  const [shareToast, setShareToast] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isTrashConfirmationOpen, setIsTrashConfirmationOpen] = useState(false);
  const [isPermanentDeleteConfirmationOpen, setIsPermanentDeleteConfirmationOpen] = useState(false);
  // Composer Review uses a temporary private asset that is not yet published.
  // It may render inside the owner's editor, but the live route must continue
  // to enforce the normal visibility policy.
  const canRender = Boolean(isOpen && asset && (interactionMode === 'preview' || canViewAssetDetail(asset, isOwner)));

  useEffect(() => {
    if (!canRender || embedded) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canRender, embedded, onClose]);

  useEffect(() => {
    setActiveImageIndex(coverImageSelected ? 0 : -1);
    setShowVersionHistory(false);
    setCodeView('split');
    setIsTrashConfirmationOpen(false);
    setIsPermanentDeleteConfirmationOpen(false);
  }, [asset?.id, coverImageSelected]);

  if (!canRender || !asset) return null;

  const creator = resolveWorkCreator(asset, creatorProfile);
  const sourceGalleryImages = asset.previewImages?.length
    ? asset.previewImages.filter(Boolean)
    : asset.previewImage ? [asset.previewImage] : [];
  const galleryImages = coverImage
    ? [coverImage, ...sourceGalleryImages.filter(image => image !== coverImage)]
    : sourceGalleryImages;
  const explicitLinkedAssets = (asset.linkedAssetIds || [])
    .map(id => allAssets.find(candidate => candidate.id === id))
    .filter((candidate): candidate is Asset => Boolean(candidate))
    .filter(candidate => canViewAssetDetail(candidate, isOwner && candidate.userId === asset.userId));
  const linkedCollaborationAsset = asset.collaborationAssetId
    ? allAssets.find(candidate => candidate.id === asset.collaborationAssetId && candidate.category === 'collab')
    : undefined;
  const visibleLinkedCollaboration = linkedCollaborationAsset && canViewAssetDetail(linkedCollaborationAsset, isOwner && linkedCollaborationAsset.userId === asset.userId)
    ? linkedCollaborationAsset
    : undefined;
  const category = CATEGORIES[asset.category] || CATEGORIES.character;
  const status = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;
  const { contentBlocks, shortDescription, uiCode, legacyContent: resolvedLegacyContent } = resolveWorkPresentationContent(asset);
  const display = getWorkDisplayPresentation(asset);
  const publicCollaboration = display.collaboration;
  const collaborationMemberWorks = display.isCollaborationFocused
    ? allAssets.filter(candidate => candidate.collaborationAssetId === asset.id)
      .filter(candidate => canViewAssetDetail(candidate, isOwner && candidate.userId === asset.userId))
    : [];
  const linkedAssets = [...explicitLinkedAssets, ...collaborationMemberWorks]
    .filter((candidate, index, items) => items.findIndex(item => item.id === candidate.id) === index);
  const presentationMetadata = asset.presentationMetadata;
  const imagePromptToolModelBlock = contentBlocks.find(block => block.id.includes('image-prompt-tool-model') || block.title === 'เครื่องมือ / โมเดลที่ใช้');
  const mainBlocks = contentBlocks.filter(block => block.type !== 'UI Code' && block !== imagePromptToolModelBlock && !display.publicCollaborationBlocks.some(publicBlock => publicBlock.id === block.id));
  const publicCollaborationBlocks = display.publicCollaborationBlocks.filter(block => block.type !== 'UI Code');
  // Only CreatorCollabPanel's explicitly public shared-information blocks may enter this surface.
  const legacyContent = asset.category === 'collab' ? '' : resolvedLegacyContent;
  const mainContentCopy = mainBlocks.length
    ? mainBlocks.map(block => `${block.title}\n${block.body}`).join('\n\n')
    : legacyContent;
  const isPublic = asset.visibility === 'public' && asset.isPublic === true;
  const assignedFolder = folders.find(folder => folder.id === asset.folderId);
  const detailContentTypes = asset.contentTypeLabels?.length
    ? asset.contentTypeLabels
    : presentationMetadata?.contentTypes?.length ? presentationMetadata.contentTypes : [category.name];
  const detailWorkMode = asset.category === 'collab' ? 'คอลแลป' : 'งานทั่วไป';
  const isImagePromptPresentation = presentationMetadata?.contentTypes?.includes('image_prompt') || (!presentationMetadata && asset.category === 'prompts') || Boolean(imagePromptToolModelBlock);
  const imagePromptToolModel = presentationMetadata?.imagePromptToolModel?.trim() || imagePromptToolModelBlock?.body?.trim() || '';
  const audienceRating = presentationMetadata?.audienceRating;
  const audienceRatingLabel = audienceRating
    ? AUDIENCE_RATING_LABELS[audienceRating] || audienceRating
    : '';
  const detailMetadataItems = [
    display.isCollaborationFocused
      ? { label: 'รูปแบบผลงาน', value: 'คอลแลป' }
      : { label: 'ประเภทเนื้อหา', value: detailContentTypes.join(' · ') },
    ...(!display.isCollaborationFocused ? [{ label: 'รูปแบบผลงาน', value: detailWorkMode }] : []),
    ...(audienceRatingLabel ? [{ label: 'ระดับผู้ชม', value: audienceRatingLabel }] : []),
    ...(presentationMetadata?.appPlatforms?.length ? [{ label: 'แอป / แพลตฟอร์ม', value: presentationMetadata.appPlatforms.join(' · ') }] : [])
  ].slice(0, 4);
  const supplementalMetadata = [
    ...(presentationMetadata?.genres || []).map(value => `แนว · ${value}`),
    ...(presentationMetadata?.contentWarnings || []).map(value => `คำเตือน · ${value}`)
  ];

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 }, colors: ['#8B5CF6', '#EC4899', '#3B82F6'] });
    window.setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleShare = () => {
    if (interactionMode === 'preview') return;
    void navigator.clipboard?.writeText(window.location.href);
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 2000);
  };

  const downloadText = (content: string, filename: string, mime: string) => {
    const anchor = document.createElement('a');
    anchor.href = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const safeFilename = display.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
  const publicCollaborationCopy = display.collaboration
    ? [
      `## ข้อมูลคอลแลป\n${display.collaboration.name}`,
      display.collaboration.sharedTag ? `แท็กกลาง: #${display.collaboration.sharedTag.replace(/^#/, '')}` : '',
      display.collaboration.platforms.length ? `แพลตฟอร์ม: ${display.collaboration.platforms.join(' · ')}` : '',
      ...display.collaboration.sharedInformation.map(item => `### ${item.title || 'ข้อมูลกลาง'}\n${item.content}`),
      ...display.collaboration.deadlines.map(item => `- ${item.label || 'กำหนดส่ง'}: ${item.date || 'ยังไม่ระบุวันที่'}`),
      ...display.collaboration.participants.map(participant => `### ${participant.creatorName || 'ผู้เข้าร่วม'}\n${participant.houseTag ? `#${participant.houseTag.replace(/^#/, '')}\n` : ''}${participant.externalWorkName || ''}`)
    ].filter(Boolean).join('\n\n')
    : '';
  const participantCopy = (participant: NonNullable<typeof publicCollaboration>['participants'][number]) => [
    participant.creatorName || 'ผู้เข้าร่วม',
    participant.houseTag ? `#${participant.houseTag.replace(/^#/, '')}` : '',
    participant.platforms.join(' · '),
    participant.externalWorkName,
    participant.dataStatus ? `สถานะข้อมูล: ${getCollabStatusLabel(participant.dataStatus)}` : '',
    participant.imageStatus ? `สถานะรูป: ${getCollabStatusLabel(participant.imageStatus)}` : '',
    participant.notes ? `โน้ต: ${participant.notes}` : '',
    participant.deadlineOverrides ? `กำหนดส่งเฉพาะคน: ${Object.values(participant.deadlineOverrides).filter(Boolean).join(' · ')}` : ''
  ].filter(Boolean).join('\n');
  const markdown = `# ${display.title}\n**หมวดหมู่:** ${category.name} (${category.nameEn})\n**ผู้สร้าง:** ${creator.displayName}\n**วันที่สร้าง:** ${asset.createdAt}\n**ลิขสิทธิ์ / Proof Hash:** #VAULT-${asset.id.slice(0, 8).toUpperCase()}\n\n## คำอธิบายสั้น\n${display.summary || shortDescription}\n\n---\n\n## เนื้อหาหลัก\n${mainContentCopy}\n${publicCollaborationCopy ? `\n\n---\n\n${publicCollaborationCopy}` : ''}${uiCode ? `\n---\n\n## โค้ด UI Snippet\n\`\`\`html\n${uiCode}\n\`\`\`` : ''}\n`;
  const confirmMoveToTrash = () => {
    if (!onDelete) return;
    setIsTrashConfirmationOpen(false);
    onDelete(asset.id);
    onClose();
  };
  const confirmPermanentDelete = () => {
    if (!onPermanentDelete) return;
    setIsPermanentDeleteConfirmationOpen(false);
    onPermanentDelete(asset.id);
    onClose();
  };

  return <>
    <div
    className={`work-detail-backdrop ${embedded ? 'is-embedded' : ''}`}
    data-work-detail-presentation="canonical"
    data-work-detail-source="recovered-final"
    aria-label="Canonical Work Detail"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
  >
      <section className="work-detail-modal" role="dialog" aria-modal="true" aria-labelledby="work-detail-title">
        {!embedded && <header className="work-detail-header work-detail-header-actions-only">
        <div className="work-detail-header-actions">
          {!isOwner && onReport && <button type="button" onClick={() => onReport(asset)} aria-label="รายงานผลงาน" title="รายงานผลงาน"><Flag aria-hidden="true" /></button>}
          <button type="button" onClick={onClose} aria-label="ปิดรายละเอียดผลงาน" title="ปิด"><X aria-hidden="true" /></button>
        </div>
      </header>}

      <div className="work-detail-body">
        <div className="work-detail-grid">
          <div className="work-detail-media-column" data-work-detail-section="media">
            <div className={`work-detail-cover ${activeImageIndex >= 0 && galleryImages[activeImageIndex] ? 'has-image' : 'has-fallback'}`}>
              {activeImageIndex >= 0 && galleryImages[activeImageIndex] && <img src={galleryImages[activeImageIndex]} alt={`ภาพปก ${display.title}`} referrerPolicy="no-referrer" />}
              {!(activeImageIndex >= 0 && galleryImages[activeImageIndex]) && <div className={`work-detail-mark ${asset.icon.type === 'image' ? 'is-media' : ''}`}><WorkMark icon={asset.icon} /></div>}
            </div>
            {galleryImages.length > 1 && <div className="work-detail-thumbnails" aria-label="รูปภาพประกอบ">
              {galleryImages.map((image, index) => <button
                type="button"
                key={`${image.slice(0, 24)}-${index}`}
                className={activeImageIndex === index ? 'is-active' : ''}
                onClick={() => setActiveImageIndex(index)}
                aria-label={`ดูรูปที่ ${index + 1}`}
                aria-pressed={activeImageIndex === index}
              ><img src={image} alt="" referrerPolicy="no-referrer" /></button>)}
            </div>}
          </div>

          <div className="work-detail-copy">
            <div className="work-detail-meta" aria-label="ข้อมูลผลงาน">
              <span>{isPublic ? <Globe2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{isPublic ? 'สาธารณะ' : 'ส่วนตัว'}</span>
              <span>{status.emoji} {status.name}</span>
              <span><Folder aria-hidden="true" />{assignedFolder?.name || (asset.folderId ? 'ไม่พบโฟลเดอร์' : 'ยังไม่ได้เลือกโฟลเดอร์')}</span>
            </div>

            <h3 id="work-detail-title">{display.title}</h3>

            <div className="work-detail-creator" data-work-detail-section="creator">
              <div className="work-detail-avatar"><CreatorAvatar avatarUrl={creator.avatarUrl} displayName={creator.displayName} /></div>
              <div>
                <strong>{creator.displayName}</strong>
                {creator.username && <span>@{creator.username}</span>}
                <small><Clock3 aria-hidden="true" />สร้าง {formatThaiDate(asset.createdAt)}{asset.updatedAt && asset.updatedAt !== asset.createdAt ? ` · แก้ไข ${formatThaiDate(asset.updatedAt)}` : ''}</small>
              </div>
            </div>

            <section className={`work-detail-summary ${display.summary || shortDescription ? '' : 'is-empty'}`} data-work-detail-section="short-description">
              <strong>คำอธิบายสั้น</strong>
              <p>{display.summary || shortDescription || 'ยังไม่มีคำอธิบายสั้นสำหรับผลงานชิ้นนี้'}</p>
            </section>

            <div className={`work-detail-tags ${asset.tags?.length ? '' : 'is-empty'}`} data-work-detail-section="tags">
              <Tag aria-hidden="true" />
              {asset.tags?.length ? asset.tags.map(tag => <span key={tag}>#{tag}</span>) : <p>ยังไม่มีแท็กสำหรับผลงานชิ้นนี้</p>}
            </div>

            <div className="work-detail-presentation-metadata" data-work-detail-section="draft-metadata">
              {detailMetadataItems.map(item => <div key={item.label}><strong>{item.label}</strong><span>{item.value}</span></div>)}
            </div>
            {supplementalMetadata.length > 0 && <div className="work-detail-secondary-metadata" data-work-detail-section="secondary-metadata">
              {supplementalMetadata.map(item => <span key={item}>{item}</span>)}
            </div>}

            {isImagePromptPresentation && <section className={`work-detail-prompt-meta ${imagePromptToolModel ? '' : 'is-empty'}`} data-work-detail-section="image-prompt-tool-model">
              <strong>เครื่องมือ / โมเดลที่ใช้</strong>
              <p>{imagePromptToolModel || 'ยังไม่ได้ระบุเครื่องมือหรือโมเดลสำหรับพรอมต์นี้'}</p>
            </section>}

            <div className="work-detail-history-control">
              <button type="button" onClick={() => setShowVersionHistory(value => !value)} aria-expanded={showVersionHistory}><History aria-hidden="true" />ประวัติ ({asset.versions?.length || 1})</button>
            </div>
            {showVersionHistory && <div className="work-detail-history">
              {asset.versions?.length ? asset.versions.map((version, index) => <div key={`${version.version}-${index}`}><strong>v{version.version || index + 1}.0</strong><span>{version.summary || 'บันทึกการแก้ไขเนื้อหา'}</span><time>{formatShortDate(version.updatedAt || asset.updatedAt)}</time></div>)
                : <div><strong>v1.0</strong><span>สร้างเอกสารครั้งแรก</span><time>{formatShortDate(asset.createdAt)}</time></div>}
            </div>}
          </div>
        </div>

        {(mainBlocks.length > 0 || legacyContent.trim()) && <section className="work-detail-section" data-work-detail-section="main-content">
          <div className="work-detail-section-heading">
            <div><FileText aria-hidden="true" /><div><strong>เนื้อหาหลัก</strong><span>เนื้อหาผลงานแบบแยกเป็นส่วน</span></div></div>
          </div>
          <div className="work-detail-blocks">
            {mainBlocks.length > 0
              ? mainBlocks.map(block => <ContentBlock key={block.id} block={block} copied={copiedKey === `block-${block.id}`} onCopy={() => copyToClipboard(block.body, `block-${block.id}`)} />)
              : <article className="work-detail-block is-text"><header><div><span>ข้อความ</span><strong>เนื้อหา</strong></div>{isMeaningfulCopyText(legacyContent, 'เนื้อหา') && <CopyButton copied={copiedKey === 'content'} label="คัดลอก" onClick={() => copyToClipboard(legacyContent, 'content')} />}</header><p>{legacyContent}</p></article>}
          </div>
        </section>}

        {display.isCollaborationFocused && publicCollaboration && <section className="work-detail-section work-detail-collaboration-identity" data-work-detail-section="collaboration-identity">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>ข้อมูลคอลแลป</strong><span>ข้อมูลสาธารณะสำหรับครีเอเตอร์ที่เข้าร่วม</span></div></div></div>
          <div className="work-detail-collaboration-card">
            <strong>{publicCollaboration.name || display.collaborationTitle}</strong>
            <div className="work-detail-collaboration-chips">
              {publicCollaboration.sharedTag && <span>#{publicCollaboration.sharedTag.replace(/^#/, '')}</span>}
              {publicCollaboration.platforms.map(platform => <span key={platform}>{platform}</span>)}
            </div>
          </div>
        </section>}

        {display.isCollaborationFocused && publicCollaboration?.sharedInformation.length ? <section className="work-detail-section work-detail-collaboration-content" data-work-detail-section="collaboration-content">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>ข้อมูลกลางของคอลแลป</strong><span>คัดลอกไปใช้สร้างหรือโปรโมตผลงานได้</span></div></div></div>
          <div className="work-detail-blocks">{publicCollaboration.sharedInformation.map(item => <article className={`work-detail-block ${item.type === 'code' ? 'is-prompt work-detail-collaboration-code-block' : 'is-text'}`} key={item.id}>
            <header><div><span>{item.type === 'code' ? 'ข้อมูลแบบโค้ด' : 'ข้อความ'}</span><strong>{item.title || 'ข้อมูลกลางของคอลแลป'}</strong></div>{isMeaningfulCopyText(item.content, item.title) && <CopyButton copied={copiedKey === `collaboration-${item.id}`} label="คัดลอก" onClick={() => copyToClipboard(item.content, `collaboration-${item.id}`)} />}</header>
            {item.type === 'code' ? <CodePresentation code={item.content} view={codeView} onViewChange={setCodeView} /> : <p>{item.content}</p>}
            {(item.appScope !== 'unspecified' || item.platforms.length > 0) && <small>{item.appScope === 'all_apps' ? 'ใช้กับทุกแอป' : item.platforms.join(' · ')}</small>}
          </article>)}</div>
        </section> : null}

        {display.isCollaborationFocused && publicCollaboration?.deadlines.length ? <section className="work-detail-section work-detail-collaboration-deadlines" data-work-detail-section="collaboration-deadlines">
          <div className="work-detail-section-heading"><div><Clock3 aria-hidden="true" /><div><strong>กำหนดส่ง</strong><span>กำหนดการกลางของคอลแลป</span></div></div></div>
          <div className="work-detail-collaboration-deadline-grid">{publicCollaboration.deadlines.map(deadline => <article key={deadline.id}><strong>{deadline.label || 'กำหนดส่ง'}</strong><time dateTime={deadline.date}>{deadline.date || 'ยังไม่ระบุวันที่'}</time></article>)}</div>
        </section> : null}

        {display.isCollaborationFocused && publicCollaboration?.participants.length ? <section className="work-detail-section work-detail-collaboration-participants" data-work-detail-section="collaboration-participants">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>ผู้เข้าร่วม {publicCollaboration.participants.length} คน</strong><span>ข้อมูลสาธารณะที่ผู้สร้างคอลแลปเลือกให้แสดง</span></div></div></div>
          <div className="work-detail-participant-grid">{publicCollaboration.participants.map(participant => <article key={participant.id}>
            <header><div><strong>{participant.creatorName || 'ยังไม่ได้ระบุชื่อ'}</strong>{participant.isOwner && <span>เจ้าของคอลแลป</span>}</div>{isMeaningfulCopyText(participantCopy(participant), participant.creatorName) && <CopyButton copied={copiedKey === `participant-${participant.id}`} label="คัดลอก" onClick={() => copyToClipboard(participantCopy(participant), `participant-${participant.id}`)} />}</header>
            <div className="work-detail-collaboration-chips">{participant.houseTag && <span>#{participant.houseTag.replace(/^#/, '')}</span>}{participant.platforms.map(platform => <span key={platform}>{platform}</span>)}</div>
            {participant.externalWorkName && <p><strong>ผลงาน:</strong> {participant.externalWorkName}</p>}
            {(participant.dataStatus || participant.imageStatus) && <p><strong>สถานะ:</strong> {participant.dataStatus ? `${getCollabStatusLabel(participant.dataStatus)} ข้อมูล` : ''}{participant.dataStatus && participant.imageStatus ? ' · ' : ''}{participant.imageStatus ? `${getCollabStatusLabel(participant.imageStatus)} รูป` : ''}</p>}
            {participant.notes && <p><strong>โน้ต:</strong> {participant.notes}</p>}
            {participant.deadlineOverrides && Object.values(participant.deadlineOverrides).some(Boolean) && <p><strong>กำหนดส่งเฉพาะคน:</strong> {Object.values(participant.deadlineOverrides).filter(Boolean).join(' · ')}</p>}
            {participant.referenceImages.length > 0 && <div className="work-detail-participant-references">{participant.referenceImages.map(image => <img key={image.id} src={image.src} alt={`รูปอ้างอิงของ ${participant.creatorName || 'ผู้เข้าร่วม'}`} referrerPolicy="no-referrer" />)}</div>}
          </article>)}</div>
        </section> : null}

        {display.isCollaborationFocused && !publicCollaboration && publicCollaborationBlocks.length > 0 && <section className="work-detail-section work-detail-collaboration-content" data-work-detail-section="collaboration-content-legacy">
          <div className="work-detail-blocks">{publicCollaborationBlocks.map(block => <ContentBlock key={block.id} block={block} copied={copiedKey === `collaboration-${block.id}`} onCopy={() => copyToClipboard(block.body, `collaboration-${block.id}`)} />)}</div>
        </section>}

        {!display.isCollaborationFocused && visibleLinkedCollaboration && <section className="work-detail-section work-detail-linked-collaboration" data-work-detail-section="linked-collaboration">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>คอลแลปที่เชื่อม</strong><span>ผลงานชิ้นนี้เป็นส่วนหนึ่งของคอลแลป</span></div></div></div>
          <button type="button" className="work-detail-linked-collaboration-card" onClick={() => onSelectLinkedAsset?.(visibleLinkedCollaboration.id)}><WorkMark icon={visibleLinkedCollaboration.icon} /><span><strong>{visibleLinkedCollaboration.publicCollaboration?.name || visibleLinkedCollaboration.title}</strong><small>{visibleLinkedCollaboration.shortDescription || 'ดูข้อมูลคอลแลป'}</small></span><b>ดูคอลแลป →</b></button>
        </section>}

        {mainBlocks.length === 0 && !legacyContent.trim() && !uiCode && !display.isCollaborationFocused && <section className="work-detail-section work-detail-empty-state" data-work-detail-section="main-content-empty">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>เนื้อหาหลัก</strong><span>ยังไม่มีข้อมูลเนื้อหาสำหรับแสดง</span></div></div></div>
          <p>ยังไม่มีข้อมูลเนื้อหาในผลงานชิ้นนี้</p>
        </section>}

        {uiCode && <section className="work-detail-section work-detail-code" data-work-detail-section="ui-code">
          <div className="work-detail-section-heading">
            <div><Code2 aria-hidden="true" /><div><strong>โค้ดหน้า UI</strong><span>พื้นที่แสดงผล HTML + CSS แบบปลอดภัย</span></div></div>
            {isMeaningfulCopyText(uiCode, 'โค้ดหน้า UI') && <CopyButton copied={copiedKey === 'code'} label="คัดลอกโค้ด" onClick={() => copyToClipboard(uiCode, 'code')} />}
          </div>
          <CodePresentation code={uiCode} view={codeView} onViewChange={setCodeView} />
        </section>}

        {linkedAssets.length > 0 && <section className="work-detail-section" data-work-detail-section="linked-works">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>ผลงานที่เชื่อมโยง</strong><span>ผลงานที่เชื่อมโยงจากรายการเดียวกัน</span></div></div></div>
          <div className="work-detail-linked-grid">{linkedAssets.map(linked => <button type="button" key={linked.id} onClick={() => onSelectLinkedAsset?.(linked.id)}><WorkMark icon={linked.icon} /><span><strong>{linked.title}</strong><small>{CATEGORIES[linked.category]?.name || linked.category}</small></span><b>ดู →</b></button>)}</div>
        </section>}
      </div>

      {!embedded && <footer className="work-detail-footer" data-work-detail-actions={isOwner ? 'owner' : 'visitor'}>
        <div className="work-detail-footer-note">
          <span><Heart aria-hidden="true" /> {asset.likesCount || 0}</span>
          <span>โดย {creator.displayName}</span>
        </div>
        <div className="work-detail-footer-actions">
          {isTrashMode ? <>
            {onRestore && <button type="button" className="is-positive" onClick={() => { onRestore(asset.id); onClose(); }}><RotateCcw aria-hidden="true" />กู้คืน</button>}
            {onPermanentDelete && <button type="button" className="is-danger" onClick={() => setIsPermanentDeleteConfirmationOpen(true)}><Trash2 aria-hidden="true" />ลบถาวร</button>}
          </> : <>
            {!isOwner && onLike && <button type="button" className={`is-secondary work-detail-like-action ${isLiked ? 'is-selected' : ''}`} onClick={() => onLike(asset.id)}><Heart aria-hidden="true" className={isLiked ? 'is-filled' : ''} />{isLiked ? 'ถูกใจแล้ว' : 'ถูกใจ'}<span className="work-detail-action-count">{asset.likesCount || 0}</span></button>}
            <button type="button" className="is-secondary work-detail-share-action" onClick={handleShare}><Share2 aria-hidden="true" />แชร์{shareToast && <span role="status" className="work-detail-share-status">คัดลอกลิงก์แล้ว</span>}</button>
            {!isOwner && onBookmark && <button type="button" className={`is-secondary ${isBookmarked ? 'is-selected' : ''}`} onClick={() => onBookmark(asset.id)}><Bookmark aria-hidden="true" className={isBookmarked ? 'is-filled' : ''} />{isBookmarked ? 'บันทึกแล้ว' : 'บันทึกไว้'}</button>}
            {!isOwner && onFork && <button type="button" className="is-secondary" onClick={() => onFork(asset)}><GitFork aria-hidden="true" />Fork</button>}
            {isOwner && onEdit && <button type="button" className="is-secondary" onClick={() => onEdit(asset)}><Edit3 aria-hidden="true" />แก้ไขผลงาน</button>}
            {isOwner && onMoveToFolder && <button type="button" className="is-secondary" onClick={() => onMoveToFolder(asset)}><FolderInput aria-hidden="true" />ย้ายไปโฟลเดอร์</button>}
            {isOwner && onDelete && <button type="button" className="is-danger" onClick={() => setIsTrashConfirmationOpen(true)}><Trash2 aria-hidden="true" />ย้ายลงถังขยะ</button>}
          </>}
          <button type="button" className="is-secondary work-detail-download-action" onClick={() => downloadText(markdown, `${safeFilename}.md`, 'text/markdown')}><Download aria-hidden="true" />Markdown</button>
          <button type="button" className="is-secondary work-detail-download-action" onClick={() => downloadText(JSON.stringify(createPublicAssetExport(asset), null, 2), `${safeFilename}_vault.json`, 'text/json')}><Download aria-hidden="true" />JSON</button>
          <button type="button" className="is-primary" onClick={onClose}>ปิด</button>
        </div>
      </footer>}
    </section>
  </div>
  <ConfirmationDialog
    isOpen={isTrashConfirmationOpen}
    title="ย้ายผลงานไปถังขยะ?"
    description={`ย้ายผลงาน “${asset.title}” ไปยังถังขยะหรือไม่?`}
    confirmLabel="ย้ายไปถังขยะ"
    onCancel={() => setIsTrashConfirmationOpen(false)}
    onConfirm={confirmMoveToTrash}
  />
  <ConfirmationDialog
    isOpen={isPermanentDeleteConfirmationOpen}
    title="ลบผลงานถาวร?"
    description={`ลบผลงาน “${asset.title}” อย่างถาวรหรือไม่? เมื่อลบแล้วจะไม่สามารถกู้คืนผลงานนี้ได้`}
    confirmLabel="ลบถาวร"
    onCancel={() => setIsPermanentDeleteConfirmationOpen(false)}
    onConfirm={confirmPermanentDelete}
  />
  </>;
};
