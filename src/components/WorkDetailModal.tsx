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
  ImageIcon,
  LockKeyhole,
  RotateCcw,
  Share2,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import type { Asset, AssetIcon, Folder as WorkFolder, User, WorkContentBlock } from '../types';
import { CATEGORIES, STATUS_PRESETS } from '../lib/constants';
import { canViewAssetDetail } from '../lib/accessPolicy';
import { formatShortDate, formatThaiDate } from '../lib/dateUtils';
import { resolveWorkCreator } from '../lib/workPresentation';
import { resolveWorkPresentationContent } from '../lib/workContent';
import { isValidWorkIcon } from '../lib/assetVisibility';
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

function ContentBlock({ block, copied, onCopy }: { block: WorkContentBlock; copied: boolean; onCopy: () => void }) {
  if (block.type === 'Divider') {
    return <div className="work-detail-divider" aria-label={block.title || 'เส้นแบ่ง'}><span>✦</span></div>;
  }

  const body = block.body.trim();
  const isImageSource = block.type === 'Image' && /^(?:data:image\/|blob:|https?:\/\/)/i.test(body);

  return <article className={`work-detail-block is-${block.type.toLowerCase().replace(/\s+/g, '-')}`}>
    <header>
      <div>
        <span>{BLOCK_LABELS[block.type]}</span>
        <strong>{block.title || BLOCK_LABELS[block.type]}</strong>
      </div>
      {body && <CopyButton copied={copied} label="คัดลอก block" onClick={onCopy} />}
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
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onSelectLinkedAsset?: (assetId: string) => void;
  allAssets?: Asset[];
  isOwner?: boolean;
  isBookmarked?: boolean;
  isTrashMode?: boolean;
  creatorProfile?: User | null;
  folders?: WorkFolder[];
  onMoveToFolder?: (asset: Asset) => void;
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
  isTrashMode = false,
  creatorProfile = null,
  folders = [],
  onMoveToFolder
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeView, setCodeView] = useState<CodeView>('split');
  const [shareToast, setShareToast] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isTrashConfirmationOpen, setIsTrashConfirmationOpen] = useState(false);
  const [isPermanentDeleteConfirmationOpen, setIsPermanentDeleteConfirmationOpen] = useState(false);
  const canRender = Boolean(isOpen && asset && canViewAssetDetail(asset, isOwner));

  useEffect(() => {
    if (!canRender) return;
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
  }, [canRender, onClose]);

  useEffect(() => {
    setActiveImageIndex(0);
    setShowVersionHistory(false);
    setCodeView('split');
    setIsTrashConfirmationOpen(false);
    setIsPermanentDeleteConfirmationOpen(false);
  }, [asset?.id]);

  if (!canRender || !asset) return null;

  const creator = resolveWorkCreator(asset, creatorProfile);
  const galleryImages = asset.previewImages?.length
    ? asset.previewImages.filter(Boolean)
    : asset.previewImage ? [asset.previewImage] : [];
  const linkedAssets = (asset.linkedAssetIds || [])
    .map(id => allAssets.find(candidate => candidate.id === id))
    .filter((candidate): candidate is Asset => Boolean(candidate))
    .filter(candidate => canViewAssetDetail(candidate, isOwner && candidate.userId === asset.userId));
  const category = CATEGORIES[asset.category] || CATEGORIES.character;
  const status = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;
  const { contentBlocks, shortDescription, uiCode, legacyContent } = resolveWorkPresentationContent(asset);
  const mainBlocks = contentBlocks.filter(block => block.type !== 'UI Code');
  const mainContentCopy = mainBlocks.length
    ? mainBlocks.map(block => `${block.title}\n${block.body}`).join('\n\n')
    : legacyContent;
  const isPublic = asset.visibility === 'public' && asset.isPublic === true;
  const assignedFolder = folders.find(folder => folder.id === asset.folderId);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 }, colors: ['#8B5CF6', '#EC4899', '#3B82F6'] });
    window.setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleShare = () => {
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

  const safeFilename = asset.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
  const markdown = `# ${asset.title}\n**หมวดหมู่:** ${category.name} (${category.nameEn})\n**ผู้สร้าง:** ${creator.displayName}\n**วันที่สร้าง:** ${asset.createdAt}\n**ลิขสิทธิ์ / Proof Hash:** #VAULT-${asset.id.slice(0, 8).toUpperCase()}\n\n## คำอธิบายสั้น\n${shortDescription}\n\n---\n\n## เนื้อหาหลัก\n${mainContentCopy}\n${uiCode ? `\n---\n\n## โค้ด UI Snippet\n\`\`\`html\n${uiCode}\n\`\`\`` : ''}\n`;
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
    className="work-detail-backdrop"
    data-work-detail-presentation="canonical"
    data-work-detail-source="recovered-final"
    aria-label="Canonical Work Detail"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section className="work-detail-modal" role="dialog" aria-modal="true" aria-labelledby="work-detail-title">
      <header className="work-detail-header">
        <div>
          <p className="work-detail-eyebrow">WORK DETAIL</p>
          <h2 id="work-detail-title">รายละเอียดผลงาน</h2>
          <p>เปิดจาก Work Card · Canonical Creator Space presentation</p>
        </div>
        <div className="work-detail-header-actions">
          <button type="button" onClick={handleShare} aria-label="แชร์ลิงก์ผลงาน" title="แชร์ลิงก์">
            <Share2 aria-hidden="true" />
            {shareToast && <span role="status">คัดลอกลิงก์แล้ว</span>}
          </button>
          {!isOwner && onReport && <button type="button" onClick={() => onReport(asset)} aria-label="รายงานผลงาน" title="รายงานผลงาน"><Flag aria-hidden="true" /></button>}
          <button type="button" onClick={onClose} aria-label="ปิดรายละเอียดผลงาน" title="ปิด"><X aria-hidden="true" /></button>
        </div>
      </header>

      <div className="work-detail-body">
        <div className="work-detail-grid">
          <div className="work-detail-media-column" data-work-detail-section="media">
            <div className="work-detail-cover">
              {galleryImages.length > 0 && <img src={galleryImages[activeImageIndex] || galleryImages[0]} alt={`ภาพปก ${asset.title}`} referrerPolicy="no-referrer" />}
              <div className={`work-detail-mark ${asset.icon.type === 'image' ? 'is-media' : ''}`}><WorkMark icon={asset.icon} /></div>
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
              <span>{category.emoji} {category.name}</span>
              <span>{isPublic ? <Globe2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{isPublic ? 'สาธารณะ' : 'ส่วนตัว'}</span>
              <span>{status.emoji} {status.name}</span>
              <span><Folder aria-hidden="true" />{assignedFolder?.name || (asset.folderId ? 'ไม่พบโฟลเดอร์' : 'ไม่จัดโฟลเดอร์')}</span>
            </div>

            <h3>{asset.title}</h3>

            <div className="work-detail-creator" data-work-detail-section="creator">
              <div className="work-detail-avatar"><CreatorAvatar avatarUrl={creator.avatarUrl} displayName={creator.displayName} /></div>
              <div>
                <strong>{creator.displayName}</strong>
                {creator.username && <span>@{creator.username}</span>}
                <small><Clock3 aria-hidden="true" />สร้าง {formatThaiDate(asset.createdAt)}{asset.updatedAt && asset.updatedAt !== asset.createdAt ? ` · แก้ไข ${formatThaiDate(asset.updatedAt)}` : ''}</small>
              </div>
            </div>

            {shortDescription && <section className="work-detail-summary" data-work-detail-section="short-description">
              <strong>คำอธิบายสั้น</strong>
              <p>{shortDescription}</p>
            </section>}

            {asset.tags && asset.tags.length > 0 && <div className="work-detail-tags" data-work-detail-section="tags">
              <Tag aria-hidden="true" />
              {asset.tags.map(tag => <span key={tag}>#{tag}</span>)}
            </div>}

            <div className="work-detail-proof">
              <span>#VAULT-{asset.id.slice(0, 8).toUpperCase()}</span>
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
            <div><FileText aria-hidden="true" /><div><strong>Main Content</strong><span>เนื้อหาผลงานแบบแยก Content Blocks</span></div></div>
            {mainContentCopy && <CopyButton copied={copiedKey === 'content'} label="คัดลอกเนื้อหา" onClick={() => copyToClipboard(mainContentCopy, 'content')} />}
          </div>
          <div className="work-detail-blocks">
            {mainBlocks.length > 0
              ? mainBlocks.map(block => <ContentBlock key={block.id} block={block} copied={copiedKey === `block-${block.id}`} onCopy={() => copyToClipboard(block.body, `block-${block.id}`)} />)
              : <article className="work-detail-block is-text"><p>{legacyContent}</p></article>}
          </div>
        </section>}

        {uiCode && <section className="work-detail-section work-detail-code" data-work-detail-section="ui-code">
          <div className="work-detail-section-heading">
            <div><Code2 aria-hidden="true" /><div><strong>UI Code</strong><span>HTML + CSS sandbox · scripts และ inline handlers ถูกบล็อก</span></div></div>
            <CopyButton copied={copiedKey === 'code'} label="Copy Code" onClick={() => copyToClipboard(uiCode, 'code')} />
          </div>
          <div className="work-detail-code-tabs" role="tablist" aria-label="มุมมอง UI Code">
            {(['split', 'preview', 'code'] as const).map(view => <button type="button" role="tab" aria-selected={codeView === view} className={codeView === view ? 'is-active' : ''} key={view} onClick={() => setCodeView(view)}>{view === 'split' ? 'PREVIEW + CODE' : view === 'preview' ? 'PREVIEW' : 'RAW CODE'}</button>)}
          </div>
          <div className={`work-detail-code-layout ${codeView === 'split' ? 'is-split' : ''}`}>
            {(codeView === 'split' || codeView === 'preview') && <div className="work-detail-code-panel"><span>Safe Sandboxed Preview</span><SandboxedCodePreview code={uiCode} minHeight="220px" /></div>}
            {(codeView === 'split' || codeView === 'code') && <div className="work-detail-code-panel"><span>HTML / CSS Source</span><pre><code>{uiCode}</code></pre></div>}
          </div>
        </section>}

        {linkedAssets.length > 0 && <section className="work-detail-section" data-work-detail-section="linked-works">
          <div className="work-detail-section-heading"><div><FileText aria-hidden="true" /><div><strong>ผลงานที่เชื่อมโยง</strong><span>Related Works</span></div></div></div>
          <div className="work-detail-linked-grid">{linkedAssets.map(linked => <button type="button" key={linked.id} onClick={() => onSelectLinkedAsset?.(linked.id)}><WorkMark icon={linked.icon} /><span><strong>{linked.title}</strong><small>{CATEGORIES[linked.category]?.name || linked.category}</small></span><b>ดู →</b></button>)}</div>
        </section>}
      </div>

      <footer className="work-detail-footer">
        <div className="work-detail-footer-note">
          <span>♡ {asset.likesCount || 0}</span>
          <span>โดย {creator.displayName}</span>
        </div>
        <div className="work-detail-footer-actions">
          <button type="button" className="is-secondary" onClick={() => downloadText(markdown, `${safeFilename}.md`, 'text/markdown')}><Download aria-hidden="true" />Markdown</button>
          <button type="button" className="is-secondary" onClick={() => downloadText(JSON.stringify(asset, null, 2), `${safeFilename}_vault.json`, 'text/json')}><Download aria-hidden="true" />JSON</button>
          {isTrashMode ? <>
            {onRestore && <button type="button" className="is-positive" onClick={() => { onRestore(asset.id); onClose(); }}><RotateCcw aria-hidden="true" />กู้คืน</button>}
            {onPermanentDelete && <button type="button" className="is-danger" onClick={() => setIsPermanentDeleteConfirmationOpen(true)}><Trash2 aria-hidden="true" />ลบถาวร</button>}
          </> : <>
            {onBookmark && <button type="button" className={`is-secondary ${isBookmarked ? 'is-selected' : ''}`} onClick={() => onBookmark(asset.id)}><Bookmark aria-hidden="true" className={isBookmarked ? 'is-filled' : ''} />{isBookmarked ? 'บันทึกแล้ว' : 'บันทึกไว้'}</button>}
            {!isOwner && onFork && <button type="button" className="is-secondary" onClick={() => onFork(asset)}><GitFork aria-hidden="true" />Fork</button>}
            {isOwner && onEdit && <button type="button" className="is-secondary" onClick={() => onEdit(asset)}><Edit3 aria-hidden="true" />แก้ไขผลงาน</button>}
            {isOwner && onMoveToFolder && <button type="button" className="is-secondary" onClick={() => onMoveToFolder(asset)}><FolderInput aria-hidden="true" />ย้ายไปโฟลเดอร์</button>}
            {isOwner && onDelete && <button type="button" className="is-danger" onClick={() => setIsTrashConfirmationOpen(true)}><Trash2 aria-hidden="true" />ย้ายลงถังขยะ</button>}
          </>}
          <button type="button" className="is-primary" onClick={onClose}>ปิด</button>
        </div>
      </footer>
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
