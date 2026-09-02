import React, { useState } from 'react';
import type { Asset, AssetCategory, User } from '../types';
import { resolveWorkCreator } from '../lib/workPresentation';
import { isPublicFeedVisibility, isValidWorkIcon } from '../lib/assetVisibility';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, STATUS_PRESETS } from '../lib/constants';
import { formatShortDate } from '../lib/dateUtils';
import {
  Bookmark as BookmarkIcon,
  Check,
  Copy,
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
import confetti from 'canvas-confetti';

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
}

function getTitleMark(title: string) {
  const mark = title.trim().split(/\s+/).map(word => word.slice(0, 1)).join('').slice(0, 2);
  return mark.toUpperCase() || 'CX';
}

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
  onSelectTag,
  onOpenMoveToFolder,
  folderName,
  folderIcon,
  isOwner = false,
  isBookmarked = false,
  isLiked = false,
  isTrashMode = false,
  creatorProfile = null
}) => {
  const { currentUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;
  const statusMeta = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;
  const galleryCount = asset.previewImages?.length || (asset.previewImage ? 1 : 0);
  const mainImage = asset.previewImages?.[0] || asset.previewImage;
  const snippet = (asset.shortDescription ?? asset.content).replace(/[#*`_]/g, '').trim();
  const creator = resolveWorkCreator(asset, creatorProfile || (currentUser?.id === asset.userId ? currentUser : null));

  const handleQuickCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(asset.uiCodeSnippet || asset.content);
    setCopied(true);
    confetti({ particleCount: 20, spread: 45, origin: { y: 0.8 }, colors: ['#A78BFA', '#F472B6', '#FBBF24'] });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = (event: React.MouseEvent) => {
    event.stopPropagation();
    onLike?.(asset.id);
  };

  const handleBookmark = (event: React.MouseEvent) => {
    event.stopPropagation();
    onBookmark?.(asset.id);
  };

  const handleMenuToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(previous => !previous);
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

  const handleTagClick = (event: React.MouseEvent, tag: string) => {
    event.stopPropagation();
    onSelectTag?.(tag);
  };

  return (
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
      aria-label={`เปิดผลงาน ${asset.title}`}
      className={`cv-asset-card group ${isTrashMode ? 'is-trash' : ''}`}
    >
      <div className={`cv-card-cover ${mainImage ? 'has-image' : 'has-fallback'}`}>
        {mainImage ? (
          <img src={mainImage} alt="" className="cv-card-cover-image" referrerPolicy="no-referrer" />
        ) : (
          <div className={`cv-card-fallback cv-fallback-${asset.category}`} aria-hidden="true">
            <span className="cv-fallback-kicker">CXL / {categoryMeta.nameEn}</span>
            <span className="cv-fallback-mark">{getTitleMark(asset.title)}</span>
            <span className="cv-fallback-symbol">{asset.icon.type === 'emoji' ? asset.icon.value : categoryMeta.emoji}</span>
            <span className="cv-fallback-orbit cv-fallback-orbit-one" />
            <span className="cv-fallback-orbit cv-fallback-orbit-two" />
            <span className="cv-fallback-spark">✦</span>
          </div>
        )}

        {mainImage && <div className="cv-card-cover-overlay" aria-hidden="true" />}

        <div className="cv-cover-topline">
          <button type="button" onClick={handleCategoryClick} className="cv-cover-category">
            <span>{categoryMeta.emoji}</span>
            <span>{categoryMeta.name}</span>
          </button>
          <span className={`cv-cover-status ${statusMeta.text}`} title={statusMeta.name}>{statusMeta.emoji}</span>
        </div>

        <div className="cv-cover-actions">
          {galleryCount > 1 && <span className="cv-gallery-count"><Images className="w-3 h-3" />{galleryCount}</span>}
          {onBookmark && (
            <button type="button" onClick={handleBookmark} title={isBookmarked ? 'ยกเลิกการบันทึก' : 'บันทึกเก็บไว้'} aria-label={isBookmarked ? 'ยกเลิกการบันทึก' : 'บันทึกเก็บไว้'} className={`cv-bookmark-button ${isBookmarked ? 'is-bookmarked' : ''}`}>
              <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="cv-card-body">
        <div className="cv-card-meta-row">
          <button type="button" onClick={handleCategoryClick} className="cv-card-category"><span>{categoryMeta.emoji}</span>{categoryMeta.name}</button>
          <span className="cv-card-visibility">
            {isPublicFeedVisibility(asset) ? <><Globe className="w-3 h-3" />สาธารณะ</> : <><Lock className="w-3 h-3" />ส่วนตัว</>}
          </span>
        </div>

        <div className="cv-card-title-row">
          <div className="cv-card-icon" aria-hidden="true">{isValidWorkIcon(asset.icon)
            ? asset.icon.type === 'emoji' || asset.icon.type === 'kaomoji'
              ? asset.icon.value
              : <img src={asset.icon.value} alt="" referrerPolicy="no-referrer" />
            : categoryMeta.emoji}</div>
          <div className="min-w-0 flex-1">
            <h3>{asset.title}</h3>
            {asset.forkedFromAuthor && <p className="cv-fork-note"><GitFork className="w-3 h-3" />โคลนจาก @{asset.forkedFromAuthor}</p>}
          </div>
        </div>

        <p className="cv-card-snippet">{snippet || 'ยังไม่มีคำอธิบายสำหรับผลงานชิ้นนี้'}</p>

        {asset.tags && asset.tags.length > 0 && (
          <div className="cv-card-tags">
            {asset.tags.slice(0, 2).map(tag => <button type="button" key={tag} onClick={event => handleTagClick(event, tag)}>#{tag}</button>)}
            {asset.tags.length > 2 && <span>+{asset.tags.length - 2}</span>}
          </div>
        )}

        <footer className="cv-card-footer">
          <div className="cv-card-author">
            <img src={creator.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} alt="" referrerPolicy="no-referrer" />
            <div className="min-w-0">
              <p>{creator.displayName}</p>
              <small>{formatShortDate(asset.createdAt)}</small>
            </div>
          </div>

          <div className="cv-card-actions">
            {!isTrashMode && onLike && (
              <button type="button" onClick={handleLike} title={isLiked ? 'ยกเลิกถูกใจ' : 'กดถูกใจ'} className={`cv-like-button ${isLiked ? 'is-liked' : ''}`}>
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{asset.likesCount || 0}</span>
              </button>
            )}
            <div className="cv-card-menu-wrap">
              <button type="button" onClick={handleMenuToggle} aria-expanded={menuOpen} aria-label="การทำงานเพิ่มเติม" className="cv-more-button"><MoreHorizontal className="w-4 h-4" /></button>
              {menuOpen && (
                <div className="cv-card-menu" onClick={event => event.stopPropagation()}>
                  {!isTrashMode && !isOwner && onFork && <button type="button" onClick={handleMenuAction(() => onFork(asset))}><GitFork className="w-3.5 h-3.5" />Fork เข้าคลังของฉัน</button>}
                  {!isTrashMode && !isOwner && onReport && <button type="button" onClick={handleMenuAction(() => onReport(asset))}><Flag className="w-3.5 h-3.5" />รายงานผลงาน</button>}
                  {!isTrashMode && isOwner && onEdit && <button type="button" onClick={handleMenuAction(() => onEdit(asset))}><FileEdit className="w-3.5 h-3.5" />แก้ไขผลงาน</button>}
                  {!isTrashMode && isOwner && onOpenMoveToFolder && <button type="button" onClick={handleMenuAction(() => onOpenMoveToFolder(asset))}><FolderInput className="w-3.5 h-3.5" />ย้ายไปยังโฟลเดอร์</button>}
                  {!isTrashMode && <button type="button" onClick={handleQuickCopy}>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'คัดลอกแล้ว' : 'คัดลอกเนื้อหา'}</button>}
                  {!isTrashMode && isOwner && onDelete && <button type="button" onClick={handleMenuAction(() => onDelete(asset))} className="is-danger"><Trash2 className="w-3.5 h-3.5" />ย้ายไปถังขยะ</button>}
                  {isTrashMode && onRestore && <button type="button" onClick={handleMenuAction(() => onRestore(asset.id))}><RotateCcw className="w-3.5 h-3.5" />กู้คืนผลงาน</button>}
                  {isTrashMode && onPermanentDelete && <button type="button" onClick={handleMenuAction(() => { if (window.confirm('คุณต้องการลบผลงานนี้ถาวรใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) onPermanentDelete(asset.id); })} className="is-danger"><Trash2 className="w-3.5 h-3.5" />ลบถาวร</button>}
                  {folderName && <span className="cv-card-menu-folder">{folderIcon || '📁'} {folderName}</span>}
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
};
