import React, { useEffect, useRef, useState } from 'react';
import type { Asset, AssetCategory, PublicAssetCollaboration, User } from '../types';
import { resolveWorkCreator } from '../lib/workPresentation';
import { isPublicFeedVisibility, isValidWorkIcon } from '../lib/assetVisibility';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, STATUS_PRESETS } from '../lib/constants';
import { formatShortDate } from '../lib/dateUtils';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  Bookmark as BookmarkIcon,
  FileEdit,
  Flag,
  FolderInput,
  GitFork,
  Globe,
  Heart,
  Images,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { getWorkDisplayPresentation, type CollaborationDisplayContext } from '../lib/workDisplayPresentation';

interface AssetCardProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onLike?: (assetId: string) => void;
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onRestore?: (assetId: string) => void;
  onPermanentDelete?: (assetId: string) => void;
  onSelectCategory?: (category: AssetCategory) => void;
  onSelectTag?: (tag: string) => void;
  onOpenMoveToFolder?: (asset: Asset) => void;
  folderName?: string;
  folderIcon?: string;
  isOwner?: boolean;
  isBookmarked?: boolean;
  isLiked?: boolean;
  isTrashMode?: boolean;
  creatorProfile?: User | null;
  allAssets?: Asset[];
  viewerMode?: 'public' | 'owner';
  interactionMode?: 'live' | 'preview';
  /** Compact showcase presentation used only by the Creator profile Portfolio. */
  presentationMode?: 'full' | 'profile-compact';
  /** Review-only label for an unselected or multi-type Composer draft. */
  categoryLabelOverride?: string;
  /** In-memory Composer context only; no Collaboration data is persisted through this prop. */
  collaborationDisplayContext?: CollaborationDisplayContext;
}

function getTitleMark(title: string) {
  const mark = title.trim().split(/\s+/).map(word => word.slice(0, 1)).join('').slice(0, 2);
  return mark.toUpperCase() || 'CX';
}

const CONTENT_TYPE_CARD_LABELS: Record<NonNullable<Asset['contentTypes']>[number], string> = {
  character: '👤 โปรไฟล์ / ประวัติตัวละคร',
  lore: '📖 เนื้อเรื่อง / โลกทัศน์',
  image_prompt: '🎨 พรอมต์เจนรูป',
  ui_code: '💻 โค้ดหน้า UI',
  bot_prompt: '🧩 พรอมต์ / OOC / เทมเพลตบอท'
};

function getStandardCardCategoryLabel(asset: Asset, fallback: string): string {
  if (asset.contentTypeLabels?.length) return asset.contentTypeLabels.join(' · ');
  if (asset.contentTypes?.length) return asset.contentTypes.map(type => CONTENT_TYPE_CARD_LABELS[type]).join(' · ');

  const blocks = asset.contentBlocks || [];
  const signatures = blocks.map(block => `${block.id} ${block.title} ${block.type}`.toLowerCase());
  const inferred: Array<NonNullable<Asset['contentTypes']>[number]> = [];
  if (asset.category === 'character' || signatures.some(value => value.includes('character') || value.includes('ตัวละคร'))) inferred.push('character');
  if (asset.category === 'lore' || signatures.some(value => value.includes('story') || value.includes('เนื้อเรื่อง') || value.includes('โลกทัศน์'))) inferred.push('lore');
  if (signatures.some(value => value.includes('image-prompt') || value.includes('คำสั่งเจนรูป') || value.includes('prompt'))) inferred.push('image_prompt');
  if (asset.category === 'ui_code' || asset.uiCodeSnippet?.trim() || blocks.some(block => block.type === 'UI Code')) inferred.push('ui_code');
  if (signatures.some(value => value.includes('bot-') || value.includes('ooc') || value.includes('เทมเพลต') || value.includes('บอท'))) inferred.push('bot_prompt');
  return [...new Set(inferred)].map(type => CONTENT_TYPE_CARD_LABELS[type]).join(' · ') || fallback;
}

const CollabCardSummary: React.FC<{ collaboration: PublicAssetCollaboration }> = ({ collaboration }) => {
  const hasIdentity = Boolean(collaboration.name.trim() || collaboration.sharedTag.trim() || collaboration.platforms.length);
  const hasCreatedData = hasIdentity || collaboration.sharedInformation.length > 0 || collaboration.deadlines.length > 0 || collaboration.participants.length > 0;
  if (!hasCreatedData) return null;

  const nextDeadline = collaboration.deadlines
    .filter(deadline => Boolean(deadline.date))
    .sort((left, right) => left.date.localeCompare(right.date))[0];

  return <div className="cv-collab-card-summary" aria-label="สรุปข้อมูลคอลแลป">
    <div className="cv-collab-card-chips">
      {collaboration.sharedTag.trim() && <span>#{collaboration.sharedTag.trim().replace(/^#/, '')}</span>}
      {collaboration.platforms.slice(0, 2).map(platform => <span key={platform}>{platform}</span>)}
      {collaboration.platforms.length > 2 && <span>+{collaboration.platforms.length - 2}</span>}
    </div>
    <div className="cv-collab-card-stats">
      <span>ผู้เข้าร่วม {collaboration.participants.length} คน</span>
      <span>ข้อมูลกลาง {collaboration.sharedInformation.length} รายการ</span>
      {nextDeadline && <time dateTime={nextDeadline.date}>{nextDeadline.label.trim() || 'กำหนดส่ง'} · {nextDeadline.date}</time>}
    </div>
  </div>;
};

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onClick,
  onEdit,
  onDelete,
  onLike,
  onBookmark,
  onFork,
  onReport,
  onRestore,
  onPermanentDelete,
  onSelectCategory,
  onOpenMoveToFolder,
  folderName,
  folderIcon,
  isOwner = false,
  isBookmarked = false,
  isLiked = false,
  isTrashMode = false,
  creatorProfile = null,
  allAssets = [],
  viewerMode = 'public',
  interactionMode = 'live',
  presentationMode = 'full',
  categoryLabelOverride,
  collaborationDisplayContext
}) => {
  const { currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPermanentDeleteConfirmationOpen, setIsPermanentDeleteConfirmationOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeWhenAnotherMenuOpens = (event: Event) => {
      const otherAssetId = (event as CustomEvent<{ assetId?: string }>).detail?.assetId;
      if (otherAssetId !== asset.id) setMenuOpen(false);
    };
    window.addEventListener('creator-vault:card-menu-open', closeWhenAnotherMenuOpens);
    return () => window.removeEventListener('creator-vault:card-menu-open', closeWhenAnotherMenuOpens);
  }, [asset.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;
  const display = getWorkDisplayPresentation(asset, collaborationDisplayContext);
  const collaboration = display.isCollaborationFocused ? display.collaboration : null;
  const cardTitle = display.title;
  const categoryLabel = display.isCollaborationFocused
    ? 'คอลแลป'
    : categoryLabelOverride || getStandardCardCategoryLabel(asset, categoryMeta.name);
  const statusMeta = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;
  const galleryCount = asset.previewImages?.length || (asset.previewImage ? 1 : 0);
  const mainImage = asset.previewImage || asset.previewImages?.[0];
  const snippetSource = display.isCollaborationFocused ? asset.shortDescription || '' : display.summary || asset.content;
  const snippet = snippetSource.replace(/[#*`_]/g, '').trim();
  const creator = resolveWorkCreator(asset, creatorProfile || (currentUser?.id === asset.userId ? currentUser : null));
  const linkedCollaboration = asset.collaborationAssetId
    ? allAssets.find(candidate => candidate.id === asset.collaborationAssetId && candidate.category === 'collab')
    : undefined;
  const visibleLinkedCollaboration = linkedCollaboration && (viewerMode === 'owner' || isPublicFeedVisibility(linkedCollaboration))
    ? linkedCollaboration
    : undefined;

  const handleLike = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (interactionMode === 'live') onLike?.(asset.id);
  };

  const handleBookmark = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (interactionMode === 'live') onBookmark?.(asset.id);
  };

  const handleMenuToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    window.dispatchEvent(new CustomEvent('creator-vault:card-menu-open', { detail: { assetId: asset.id } }));
    setMenuOpen(true);
  };

  const handleMenuAction = (callback: (() => void) | undefined) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(false);
    callback?.();
  };

  const handleCategoryClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onSelectCategory?.(asset.category);
  };

  const confirmPermanentDelete = () => {
    if (!onPermanentDelete) return;
    setIsPermanentDeleteConfirmationOpen(false);
    onPermanentDelete(asset.id);
  };

  return (
    <>
    <article
      onClick={() => onClick(asset)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(asset);
        }
      }}
      tabIndex={0}
      aria-label={`เปิดผลงาน ${cardTitle}`}
      className={`cv-asset-card group ${display.isCollaborationFocused ? 'is-collaboration-card' : 'is-standard-card'} ${presentationMode === 'profile-compact' ? 'is-profile-compact' : ''} ${isTrashMode ? 'is-trash' : ''} ${(onLike || onBookmark) && !isTrashMode ? 'has-quick-actions' : ''}`}
    >
      <div className="cv-card-visual">
      <div className={`cv-card-cover ${mainImage ? 'has-image' : 'has-fallback'}`}>
        {mainImage ? (
          <img src={mainImage} alt="" className="cv-card-cover-image" referrerPolicy="no-referrer" />
        ) : (
          <div className={`cv-card-fallback cv-fallback-${asset.category}`} aria-hidden="true">
            <span className="cv-fallback-kicker">CXL / {categoryLabel}</span>
            <span className="cv-fallback-mark">{getTitleMark(cardTitle)}</span>
            <span className="cv-fallback-orbit cv-fallback-orbit-one" />
            <span className="cv-fallback-orbit cv-fallback-orbit-two" />
            <span className="cv-fallback-spark">✦</span>
          </div>
        )}

        <div className="cv-cover-actions">
          {galleryCount > 1 && <span className="cv-gallery-count"><Images className="w-3 h-3" />{galleryCount}</span>}
        </div>
      </div>
      {(onLike || onBookmark) && !isTrashMode && <div className="cv-card-quick-actions" aria-label="การทำงานด่วนของผลงาน">
        {onLike && <button type="button" onClick={handleLike} title={isLiked ? 'ยกเลิกถูกใจ' : 'กดถูกใจ'} aria-label={isLiked ? 'ยกเลิกถูกใจ' : 'กดถูกใจ'} className={`cv-like-button ${isLiked ? 'is-liked' : ''}`}>
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          <span>{asset.likesCount || 0}</span>
        </button>}
        {onBookmark && <button type="button" onClick={handleBookmark} title={isBookmarked ? 'ยกเลิกการบันทึก' : 'บันทึกเก็บไว้'} aria-label={isBookmarked ? 'ยกเลิกการบันทึก' : 'บันทึกเก็บไว้'} className={`cv-bookmark-button ${isBookmarked ? 'is-bookmarked' : ''}`}>
          <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>}
      </div>}
      </div>

      <div className="cv-card-body">
        <div className="cv-card-meta-row">
          <button type="button" onClick={handleCategoryClick} className="cv-card-category"><span>{categoryMeta.emoji}</span>{categoryLabel}</button>
          <div className="cv-card-meta-actions">
            <span className="cv-card-visibility">
              {isPublicFeedVisibility(asset) ? <><Globe className="w-3 h-3" />สาธารณะ</> : <><Lock className="w-3 h-3" />ส่วนตัว</>}
            </span>
            <span className="cv-card-status" title={`สถานะผลงาน: ${statusMeta.name}`}>{statusMeta.emoji} {statusMeta.name}</span>
          </div>
        </div>

        <div className="cv-card-title-row">
          <div className="cv-card-icon" aria-hidden="true">{isValidWorkIcon(asset.icon)
            ? asset.icon.type === 'emoji' || asset.icon.type === 'kaomoji'
              ? asset.icon.value
              : <img src={asset.icon.value} alt="" referrerPolicy="no-referrer" />
            : categoryMeta.emoji}</div>
          <div className="min-w-0 flex-1">
            <h3>{cardTitle}</h3>
            {asset.forkedFromAuthor && <p className="cv-fork-note"><GitFork className="w-3 h-3" />โคลนจาก @{asset.forkedFromAuthor}</p>}
          </div>
        </div>

        {(!collaboration || snippet) && <p className="cv-card-snippet">{snippet || 'ยังไม่มีคำอธิบายสำหรับผลงานชิ้นนี้'}</p>}

        {collaboration && <CollabCardSummary collaboration={collaboration} />}
        {visibleLinkedCollaboration && <div className="cv-card-collab-link" title={`เชื่อมกับคอลแลป ${visibleLinkedCollaboration.title}`}>
          <span>คอลแลป</span><strong>{visibleLinkedCollaboration.publicCollaboration?.name || visibleLinkedCollaboration.title}</strong>
        </div>}

        <footer className="cv-card-footer">
          <div className="cv-card-author">
            {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="cv-card-author-avatar-fallback" aria-hidden="true">{getTitleMark(creator.displayName)}</span>}
            <div className="min-w-0">
              <p>{creator.displayName}</p>
            </div>
          </div>

          <time className="cv-card-date" dateTime={asset.createdAt}>{formatShortDate(asset.createdAt)}</time>

          <div className="cv-card-actions">
            <div ref={menuRef} className="cv-card-menu-wrap">
              <button type="button" onClick={handleMenuToggle} aria-expanded={menuOpen} aria-label="การทำงานเพิ่มเติม" className="cv-more-button"><MoreHorizontal className="w-4 h-4" /></button>
              {menuOpen && (
                <div className="cv-card-menu" onClick={event => event.stopPropagation()}>
                  {!isTrashMode && !isOwner && onFork && <button type="button" onClick={handleMenuAction(() => onFork(asset))}><GitFork className="w-3.5 h-3.5" />Fork เข้าคลังของฉัน</button>}
                  {!isTrashMode && !isOwner && onReport && <button type="button" onClick={handleMenuAction(() => onReport(asset))}><Flag className="w-3.5 h-3.5" />รายงานผลงาน</button>}
                  {!isTrashMode && isOwner && onEdit && <button type="button" onClick={handleMenuAction(() => onEdit(asset))}><FileEdit className="w-3.5 h-3.5" />แก้ไขผลงาน</button>}
                  {!isTrashMode && isOwner && onOpenMoveToFolder && <button type="button" onClick={handleMenuAction(() => onOpenMoveToFolder(asset))}><FolderInput className="w-3.5 h-3.5" />ย้ายไปยังโฟลเดอร์</button>}
                  {!isTrashMode && isOwner && onDelete && <button type="button" onClick={handleMenuAction(() => onDelete(asset))} className="is-danger"><Trash2 className="w-3.5 h-3.5" />ย้ายไปถังขยะ</button>}
                  {isTrashMode && onRestore && <button type="button" onClick={handleMenuAction(() => onRestore(asset.id))}><RotateCcw className="w-3.5 h-3.5" />กู้คืนผลงาน</button>}
                  {isTrashMode && onPermanentDelete && <button type="button" onClick={handleMenuAction(() => setIsPermanentDeleteConfirmationOpen(true))} className="is-danger"><Trash2 className="w-3.5 h-3.5" />ลบถาวร</button>}
                  {folderName && <span className="cv-card-menu-folder">{folderIcon || '📁'} {folderName}</span>}
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>
    </article>
    <ConfirmationDialog
      isOpen={isPermanentDeleteConfirmationOpen}
      title="ลบผลงานถาวร?"
      description={`ลบผลงาน “${asset.title}” อย่างถาวรหรือไม่? เมื่อลบแล้วจะไม่สามารถกู้คืนผลงานนี้ได้`}
      confirmLabel="ลบถาวร"
      onCancel={() => setIsPermanentDeleteConfirmationOpen(false)}
      onConfirm={confirmPermanentDelete}
    />
    </>
  );
};
