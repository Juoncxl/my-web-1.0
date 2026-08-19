import React, { useState } from 'react';
import { Asset, Folder } from '../types';
import { FOLDER_COLOR_PRESETS } from '../lib/constants';
import { X, FolderInput, Folder as FolderIcon, Check, Plus, FolderMinus } from 'lucide-react';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  folders: Folder[];
  onMoveToFolder: (assetId: string, folderId: string | null) => Promise<boolean>;
  onOpenFolderManager: () => void;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  asset,
  folders,
  onMoveToFolder,
  onOpenFolderManager
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(asset?.folderId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with current asset when opened
  React.useEffect(() => {
    if (asset) {
      setSelectedFolderId(asset.folderId || null);
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    const success = await onMoveToFolder(asset.id, selectedFolderId);
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-100 dark:border-purple-900/50 bg-gradient-to-r from-purple-50 via-pink-50 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                ย้ายผลงานไปยังโฟลเดอร์
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {asset.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Folder Options */}
        <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            เลือกโฟลเดอร์ปลายทาง:
          </p>

          {/* Option: No Folder / Root */}
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
              selectedFolderId === null
                ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 shadow-xs'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🗃️</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  ไม่มีโฟลเดอร์ (หน้าแรกของ Dashboard)
                </p>
                <p className="text-[10px] text-slate-500">ผลงานทั่วไปไม่อยู่ในโฟลเดอร์ใดๆ</p>
              </div>
            </div>
            {selectedFolderId === null && (
              <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            )}
          </button>

          {/* Folders List */}
          {folders.map(f => {
            const isSelected = selectedFolderId === f.id;
            const colorMeta = FOLDER_COLOR_PRESETS.find(c => c.id === f.color) || FOLDER_COLOR_PRESETS[0];
            const folderIsImage = f.icon && (f.icon.startsWith('data:image') || f.icon.startsWith('http'));

            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFolderId(f.id)}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? `${colorMeta.bg} border-purple-500 dark:border-purple-500 shadow-xs ring-2 ring-purple-400/40`
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {folderIsImage ? (
                    <img
                      src={f.icon}
                      alt={f.name}
                      className="w-6 h-6 rounded-lg object-cover shadow-xs shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-lg shrink-0">{f.icon || '📁'}</span>
                  )}
                  <div className="text-left min-w-0">
                    <p className={`text-xs font-bold truncate ${colorMeta.text}`}>
                      {f.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {f.assetsCount || 0} ผลงานข้างใน
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Create New Folder Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFolderManager();
            }}
            className="w-full py-2.5 px-3 border border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 rounded-2xl text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1.5 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>สร้างโฟลเดอร์ใหม่...</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-purple-100 dark:border-purple-900/50 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 rounded-xl shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}
          </button>
        </div>

      </div>

    </div>
  );
};
