import React from 'react';
import { Asset } from '../../types';
import { CATEGORIES, STATUS_PRESETS } from '../../lib/constants';
import {
  Bookmark as BookmarkIcon,
  FileEdit,
  Flag,
  GitFork,
  Globe,
  Lock,
  Share2,
  X
} from 'lucide-react';

interface AssetViewHeaderProps {
  asset: Asset;
  isOwner: boolean;
  isBookmarked: boolean;
  shareToast: boolean;
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onShare: () => void;
  onClose: () => void;
}

export const AssetViewHeader: React.FC<AssetViewHeaderProps> = ({
  asset,
  isOwner,
  isBookmarked,
  shareToast,
  onBookmark,
  onFork,
  onReport,
  onShare,
  onClose
}) => {
  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;
  const statusMeta = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;

  return (
    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-100/70 dark:border-slate-800 bg-gradient-to-r from-purple-50/50 via-white to-pink-50/50 dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          {asset.icon.type === 'image' ? (
            <img
              src={asset.icon.value}
              alt="icon"
              className="w-11 h-11 rounded-2xl object-cover ring-2 ring-purple-200 dark:ring-purple-800"
            />
          ) : asset.icon.type === 'kaomoji' ? (
            <span className="px-3 py-1.5 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 text-sm font-mono font-bold border border-purple-200 dark:border-purple-800">
              {asset.icon.value}
            </span>
          ) : (
            <span className="text-3xl filter drop-shadow-xs">
              {asset.icon.value || '✨'}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor}`}>
              {categoryMeta.emoji} {categoryMeta.name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusMeta.bg} ${statusMeta.text} border ${statusMeta.border} flex items-center gap-1`}>
              <span>{statusMeta.emoji}</span>
              <span>{statusMeta.name}</span>
            </span>
            {asset.visibility === 'public' || asset.isPublic ? (
              <span className="flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 font-semibold">
                <Globe className="w-3 h-3 text-indigo-500" />
                <span>สาธารณะ</span>
              </span>
            ) : asset.visibility === 'draft' ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-semibold">
                <FileEdit className="w-3 h-3 text-slate-500" />
                <span>แบบร่าง (Draft)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900 font-semibold">
                <Lock className="w-3 h-3 text-rose-500" />
                <span>ส่วนตัว (Private Lock)</span>
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
            {asset.title}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onBookmark && (
          <button
            onClick={() => onBookmark(asset.id)}
            title={isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์กเก็บไว้ (Bookmark)'}
            className={`p-2 rounded-full border transition-all ${
              isBookmarked
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        )}
        {!isOwner && onFork && (
          <button
            onClick={() => onFork(asset)}
            title="โคลนผลงานเข้าสู่คลังของคุณ (Fork/Duplicate)"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors border border-slate-200 dark:border-slate-700"
          >
            <GitFork className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onShare}
          title="แชร์ลิงก์"
          className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors relative"
        >
          <Share2 className="w-4 h-4" />
          {shareToast && (
            <span className="absolute -bottom-7 right-0 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap shadow-md">
              คัดลอกลิงก์แล้ว!
            </span>
          )}
        </button>
        {!isOwner && onReport && (
          <button
            onClick={() => onReport(asset)}
            title="รายงานเนื้อหานี้ (Report)"
            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <Flag className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
