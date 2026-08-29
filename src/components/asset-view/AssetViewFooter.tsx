import React from 'react';
import { Asset } from '../../types';
import {
  Download,
  Edit3,
  RotateCcw,
  Trash2
} from 'lucide-react';

interface AssetViewFooterProps {
  asset: Asset;
  isOwner: boolean;
  isTrashMode: boolean;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  onRestore?: (assetId: string) => void;
  onPermanentDelete?: (assetId: string) => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (assetId: string) => void;
  onClose: () => void;
}

export const AssetViewFooter: React.FC<AssetViewFooterProps> = ({
  asset,
  isOwner,
  isTrashMode,
  onExportMarkdown,
  onExportJSON,
  onRestore,
  onPermanentDelete,
  onEdit,
  onDelete,
  onClose
}) => (
  <div className="p-4 sm:p-6 border-t border-purple-100/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <button
        onClick={onExportMarkdown}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-purple-100 dark:border-slate-700 transition-colors"
      >
        <Download className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>ส่งออก Markdown (.md)</span>
      </button>
      <button
        onClick={onExportJSON}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-purple-100 dark:border-slate-700 transition-colors"
      >
        <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        <span>ส่งออก JSON</span>
      </button>
    </div>

    <div className="flex items-center gap-2">
      {isTrashMode ? (
        <>
          {onRestore && (
            <button
              onClick={() => {
                onRestore(asset.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>กู้คืนผลงาน</span>
            </button>
          )}
          {onPermanentDelete && (
            <button
              onClick={() => {
                if (window.confirm('คุณต้องการลบผลงานนี้ถาวรใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                  onPermanentDelete(asset.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบถาวร</span>
            </button>
          )}
        </>
      ) : (
        <>
          {isOwner && (
            <>
              <button
                onClick={() => {
                  if (onEdit) onEdit(asset);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold border border-purple-200 dark:border-slate-700 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไขผลงาน</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm('ต้องการย้ายผลงานนี้ไปยังถังขยะ (Trash) ใช่หรือไม่?')) {
                    if (onDelete) onDelete(asset.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ย้ายลงถังขยะ</span>
              </button>
            </>
          )}
        </>
      )}

      <button
        onClick={onClose}
        className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
      >
        ปิดหน้าต่าง
      </button>
    </div>
  </div>
);
