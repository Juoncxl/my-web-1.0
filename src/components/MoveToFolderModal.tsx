import React, { useState } from 'react';
import { Check, Folder as FolderIcon, FolderInput, Plus, X } from 'lucide-react';
import type { Asset, Folder } from '../types';
import { FOLDER_COLOR_PRESETS } from '../lib/constants';

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

  React.useEffect(() => {
    if (asset) setSelectedFolderId(asset.folderId || null);
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    const success = await onMoveToFolder(asset.id, selectedFolderId);
    setIsSubmitting(false);
    if (success) onClose();
  };

  return (
    <div className="cv-modal-backdrop fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200" role="presentation">
      <div className="cv-modal-panel relative flex max-w-md flex-col animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="move-folder-title">
        <div className="cv-modal-heading flex items-center justify-between p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="cv-modal-icon"><FolderInput className="h-4 w-4" /></div>
            <div className="min-w-0">
              <h3 id="move-folder-title" className="text-sm font-bold text-slate-800 dark:text-white">ย้ายผลงานไปยังโฟลเดอร์</h3>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{asset.title}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="cv-modal-close" aria-label="ปิดหน้าต่างย้ายโฟลเดอร์"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[60vh] space-y-2.5 overflow-y-auto p-4 sm:p-5">
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">เลือกโฟลเดอร์ปลายทาง</p>
          <button type="button" onClick={() => setSelectedFolderId(null)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${selectedFolderId === null ? 'border-purple-400 bg-purple-50 dark:border-purple-600 dark:bg-purple-950/50' : 'border-[var(--cv-line)] bg-[var(--cv-control-surface)] hover:border-purple-300'}`}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--cv-surface-soft)] text-lg">🗃️</span>
              <div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">ไม่มีโฟลเดอร์</p><p className="text-[10px] text-slate-500">เก็บไว้ที่หน้าแรกของคลัง</p></div>
            </div>
            {selectedFolderId === null && <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
          </button>

          {folders.map(folder => {
            const isSelected = selectedFolderId === folder.id;
            const colorMeta = FOLDER_COLOR_PRESETS.find(color => color.id === folder.color) || FOLDER_COLOR_PRESETS[0];
            const folderIsImage = Boolean(folder.icon && (folder.icon.startsWith('data:image') || folder.icon.startsWith('http')));
            return (
              <button key={folder.id} type="button" onClick={() => setSelectedFolderId(folder.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${isSelected ? `${colorMeta.bg} border-purple-400 ring-2 ring-purple-300/30` : 'border-[var(--cv-line)] bg-[var(--cv-control-surface)] hover:border-purple-300'}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--cv-surface-soft)] text-lg">{folderIsImage ? <img src={folder.icon} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : folder.icon || <FolderIcon className="h-4 w-4" />}</span>
                  <div className="min-w-0"><p className={`truncate text-xs font-bold ${colorMeta.text}`}>{folder.name}</p><p className="text-[10px] text-slate-500">{folder.assetsCount || 0} ผลงานข้างใน</p></div>
                </div>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />}
              </button>
            );
          })}

          <button type="button" onClick={() => { onClose(); onOpenFolderManager(); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-purple-300 px-3 py-2.5 text-xs font-bold text-purple-600 transition-colors hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/30"><Plus className="h-3.5 w-3.5" />สร้างโฟลเดอร์ใหม่</button>
        </div>

        <div className="cv-modal-footer flex items-center justify-end gap-2 p-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">ยกเลิก</button>
          <button type="button" disabled={isSubmitting} onClick={handleSave} className="cv-create-button rounded-lg px-5 py-2 text-xs font-bold disabled:opacity-50">{isSubmitting ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}</button>
        </div>
      </div>
    </div>
  );
};
