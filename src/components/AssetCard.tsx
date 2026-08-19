import React, { useState } from 'react';
import { Asset, AssetCategory } from '../types';
import { CATEGORIES, STATUS_PRESETS, VISIBILITY_PRESETS } from '../lib/constants';
import { formatShortDate } from '../lib/dateUtils';
import { 
  Lock, 
  Globe, 
  Copy, 
  Check, 
  Heart, 
  Images, 
  FolderInput, 
  Bookmark as BookmarkIcon,
  GitFork,
  Flag,
  FileEdit,
  RotateCcw,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AssetCardProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
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
  isTrashMode?: boolean;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onClick,
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
  isTrashMode = false
}) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(asset.likesCount || 0);

  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;
  const statusMeta = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;
  
  const galleryCount = asset.previewImages && asset.previewImages.length > 0
    ? asset.previewImages.length
    : (asset.previewImage ? 1 : 0);
  const mainImage = (asset.previewImages && asset.previewImages.length > 0)
    ? asset.previewImages[0]
    : asset.previewImage;

  const handleQuickCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = asset.uiCodeSnippet || asset.content;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    
    // Mini confetti
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.8 },
      colors: ['#A78BFA', '#F472B6', '#FBBF24']
    });

    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikeCount(prev => prev + 1);
    if (onLike) onLike(asset.id);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookmark) onBookmark(asset.id);
  };

  const handleFork = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFork) onFork(asset);
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReport) onReport(asset);
  };

  const handleCategoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectCategory) {
      onSelectCategory(asset.category);
    } else {
      onClick(asset);
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    if (onSelectTag) {
      onSelectTag(tag);
    }
  };

  const handleMoveFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenMoveToFolder) {
      onOpenMoveToFolder(asset);
    }
  };

  return (
    <div
      onClick={() => onClick(asset)}
      className={`group relative bg-white dark:bg-slate-850 rounded-3xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
        isTrashMode 
          ? 'border-rose-200 dark:border-rose-900/60 opacity-85 hover:opacity-100'
          : 'border-purple-100/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 shadow-xs hover:shadow-lg'
      }`}
    >
      {/* Top Banner / Preview Image (If available) */}
      {mainImage ? (
        <div className="relative w-full h-40 overflow-hidden bg-purple-50 dark:bg-slate-900">
          <img
            src={mainImage}
            alt={asset.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          
          {/* Category & Status Badges over image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <button
              onClick={handleCategoryClick}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md bg-white/90 dark:bg-slate-900/90 ${categoryMeta.color} hover:scale-105 transition-transform shadow-xs flex items-center gap-1`}
            >
              <span>{categoryMeta.emoji}</span>
              <span>{categoryMeta.name}</span>
            </button>

            {/* Workflow Status Badge */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md ${statusMeta.bg} ${statusMeta.text} border ${statusMeta.border} shadow-xs flex items-center gap-0.5`}
            >
              <span>{statusMeta.emoji}</span>
              <span>{statusMeta.name}</span>
            </span>
          </div>

          {/* Top Right Badges: Bookmark, Gallery Count & Visibility */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {galleryCount > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <Images className="w-3 h-3 text-pink-300" />
                <span>{galleryCount}</span>
              </span>
            )}

            {/* Bookmark button */}
            {onBookmark && (
              <button
                onClick={handleBookmark}
                title={isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บันทึกเก็บไว้ (Bookmark)'}
                className={`p-1.5 rounded-full backdrop-blur-md shadow-xs transition-transform active:scale-90 ${
                  isBookmarked
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-amber-500'
                }`}
              >
                <BookmarkIcon className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* Visibility Badge */}
            {asset.visibility === 'public' || asset.isPublic ? (
              <span className="p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-200 flex items-center justify-center shadow-xs" title="สาธารณะ">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
              </span>
            ) : asset.visibility === 'draft' ? (
              <span className="px-2 py-0.5 rounded-full bg-slate-600/90 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 shadow-xs" title="แบบร่าง">
                <FileEdit className="w-3 h-3 text-slate-300" />
                <span>Draft</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/90 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 shadow-xs" title="ส่วนตัว (Private)">
                <Lock className="w-3 h-3" />
                <span>ส่วนตัว</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Top Row without Image */
        <div className="pt-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCategoryClick}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor} hover:scale-105 transition-transform flex items-center gap-1`}
            >
              <span>{categoryMeta.emoji}</span>
              <span>{categoryMeta.name}</span>
            </button>

            {/* Workflow Status Badge */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.bg} ${statusMeta.text} border ${statusMeta.border} flex items-center gap-0.5`}
            >
              <span>{statusMeta.emoji}</span>
              <span>{statusMeta.name}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bookmark button */}
            {onBookmark && (
              <button
                onClick={handleBookmark}
                title={isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บันทึกเก็บไว้ (Bookmark)'}
                className={`p-1.5 rounded-xl border transition-all ${
                  isBookmarked
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-amber-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <BookmarkIcon className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* Visibility Badge */}
            {asset.visibility === 'public' || asset.isPublic ? (
              <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3 text-indigo-500" />
                <span>สาธารณะ</span>
              </span>
            ) : asset.visibility === 'draft' ? (
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                <FileEdit className="w-3 h-3" />
                <span>แบบร่าง</span>
              </span>
            ) : (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/60">
                <Lock className="w-3 h-3" />
                <span>ส่วนตัว</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        
        <div>
          {/* Custom Icon & Title */}
          <div className="flex items-start gap-2.5 mb-2">
            
            {/* Custom Icon Render */}
            <div className="shrink-0 mt-0.5">
              {asset.icon.type === 'image' ? (
                <img
                  src={asset.icon.value}
                  alt="icon"
                  className="w-8 h-8 rounded-xl object-cover ring-2 ring-purple-100 dark:ring-purple-900"
                />
              ) : asset.icon.type === 'kaomoji' ? (
                <span className="inline-block px-2 py-1 rounded-xl bg-purple-100/80 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 text-xs font-mono font-bold tracking-tight shadow-xs border border-purple-200 dark:border-purple-800">
                  {asset.icon.value}
                </span>
              ) : (
                <span className="inline-block text-2xl filter drop-shadow-xs">
                  {asset.icon.value || '✨'}
                </span>
              )}
            </div>

            {/* Title */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 leading-snug">
                {asset.title}
              </h3>
              
              {/* Fork attribution note if cloned */}
              {asset.forkedFromAuthor && (
                <p className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                  <GitFork className="w-3 h-3" />
                  <span>โคลนจาก @{asset.forkedFromAuthor}</span>
                </p>
              )}
            </div>
          </div>

          {/* Snippet / Description Preview */}
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed font-normal">
            {asset.content.replace(/[#*`_]/g, '').trim()}
          </p>
        </div>

        {/* Tags (Clickable) */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {asset.tags.slice(0, 3).map((tag, idx) => (
              <button
                key={idx}
                onClick={(e) => handleTagClick(e, tag)}
                className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 dark:hover:text-purple-300 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors"
              >
                #{tag}
              </button>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer Area: Author, Date & Quick Actions */}
        <div className="pt-3 border-t border-purple-50/80 dark:border-slate-800 flex items-center justify-between gap-2">
          
          {/* Author info & Copyright date */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={asset.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={asset.authorName}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-purple-100 dark:ring-purple-900 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate leading-tight">
                {asset.authorName}
              </p>
              <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono tracking-tight" title={`สร้างเมื่อ: ${asset.createdAt}`}>
                © {formatShortDate(asset.createdAt)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Trash Mode Actions */}
            {isTrashMode ? (
              <>
                {onRestore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(asset.id);
                    }}
                    title="กู้คืนผลงานกลับสู่คลัง"
                    className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onPermanentDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPermanentDelete(asset.id);
                    }}
                    title="ลบถาวร (ไม่สามารถกู้คืนได้)"
                    className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Fork / Clone Button for public assets */}
                {!isOwner && onFork && (
                  <button
                    onClick={handleFork}
                    title="โคลนเป็นของฉัน (Fork into My Vault)"
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Report Flag Button for public community assets */}
                {!isOwner && onReport && (
                  <button
                    onClick={handleReport}
                    title="รายงานเนื้อหาไม่เหมาะสม"
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Move to Folder Button (for owner) */}
                {isOwner && onOpenMoveToFolder && (
                  <button
                    onClick={handleMoveFolderClick}
                    title="ย้ายไปยังโฟลเดอร์"
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
                  >
                    <FolderInput className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* 1-Click Copy Button */}
                <button
                  onClick={handleQuickCopy}
                  title="คัดลอกคำสั่ง / โค้ดทันที"
                  className={`p-1.5 rounded-xl border transition-all ${
                    copied
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-purple-50/60 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-slate-700'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                {/* Like Button */}
                <button
                  onClick={handleLike}
                  title="กดถูกใจ"
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition-all text-[11px] ${
                    liked
                      ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-500 border-slate-100 dark:border-slate-700'
                  }`}
                >
                  <Heart className={`w-3 h-3 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{likeCount}</span>
                </button>
              </>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
