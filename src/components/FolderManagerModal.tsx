import React, { useRef, useState } from 'react';
import { Folder as FolderIcon, X } from 'lucide-react';
import type { Folder } from '../types';
import { FolderForm } from './folder-manager/FolderForm';
import type { FolderIconMode } from './folder-manager/FolderIconPicker';
import { FolderList } from './folder-manager/FolderList';
import { ConfirmationDialog } from './ConfirmationDialog';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onCreateFolder: (name: string, icon?: string, color?: string) => Promise<boolean>;
  onUpdateFolder: (id: string, name: string, icon?: string, color?: string) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  onClose,
  folders,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder
}) => {
  const [folderName, setFolderName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [selectedColor, setSelectedColor] = useState('purple');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [iconMode, setIconMode] = useState<FolderIconMode>('presets');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [folderPendingDeletion, setFolderPendingDeletion] = useState<Folder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setFolderName('');
    setSelectedIcon('📁');
    setSelectedColor('purple');
    setEditingFolderId(null);
    setIconMode('presets');
    setCustomEmojiInput('');
    setImageUrlInput('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedIcon(reader.result);
        setError('');
      }
    };
    reader.onerror = () => setError('ไม่สามารถอ่านไฟล์รูปภาพได้');
    reader.readAsDataURL(file);
  };

  const handleApplyImageUrl = () => {
    const cleanUrl = imageUrlInput.trim();
    if (!cleanUrl) {
      setError('กรุณาวางลิงก์รูปภาพหรือ GIF');
      return;
    }
    setSelectedIcon(cleanUrl);
    setImageUrlInput('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!folderName.trim()) {
      setError('กรุณากรอกชื่อโฟลเดอร์');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const success = editingFolderId
      ? await onUpdateFolder(editingFolderId, folderName.trim(), selectedIcon, selectedColor)
      : await onCreateFolder(folderName.trim(), selectedIcon, selectedColor);
    setIsSubmitting(false);
    if (success) resetForm();
    else setError('เกิดข้อผิดพลาดในการบันทึกโฟลเดอร์');
  };

  const handleStartEdit = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    const icon = folder.icon || '📁';
    setSelectedIcon(icon);
    setSelectedColor(folder.color || 'purple');
    setError('');
    setIconMode(icon.startsWith('data:image') || icon.startsWith('http') ? 'media' : 'presets');
  };

  const handleCancelEdit = () => {
    resetForm();
    setError('');
  };

  const handleDelete = (folder: Folder) => {
    setFolderPendingDeletion(folder);
  };

  const handleConfirmDelete = () => {
    if (!folderPendingDeletion) return;
    const folderId = folderPendingDeletion.id;
    setFolderPendingDeletion(null);
    void onDeleteFolder(folderId);
  };

  return (
    <>
      <div className="cv-modal-backdrop fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200" role="presentation">
        <div className="cv-modal-panel cv-folder-manager-modal relative flex max-h-[90vh] max-w-xl flex-col animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="folder-manager-title">
          <div className="cv-modal-heading flex items-center justify-between p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="cv-modal-icon"><FolderIcon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h2 id="folder-manager-title" className="text-sm font-bold text-slate-800 dark:text-white">จัดการโฟลเดอร์</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">สร้างและจัดระเบียบคอลเลกชันของคุณ</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="cv-modal-close" aria-label="ปิดหน้าต่างจัดการโฟลเดอร์"><X className="h-4 w-4" /></button>
          </div>

          <div className="cv-folder-manager-content flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
            <FolderForm
              editing={Boolean(editingFolderId)}
              folderName={folderName}
              selectedIcon={selectedIcon}
              selectedColor={selectedColor}
              iconMode={iconMode}
              customEmojiInput={customEmojiInput}
              imageUrlInput={imageUrlInput}
              error={error}
              isSubmitting={isSubmitting}
              fileInputRef={fileInputRef}
              onFolderNameChange={setFolderName}
              onIconChange={setSelectedIcon}
              onColorChange={setSelectedColor}
              onIconModeChange={setIconMode}
              onCustomEmojiChange={setCustomEmojiInput}
              onImageUrlChange={setImageUrlInput}
              onApplyEmoji={() => {
                if (customEmojiInput.trim()) {
                  setSelectedIcon(customEmojiInput.trim());
                  setCustomEmojiInput('');
                }
              }}
              onApplyUrl={handleApplyImageUrl}
              onFileUpload={handleFileUpload}
              onResetIcon={() => setSelectedIcon('📁')}
              onCancel={handleCancelEdit}
              onSubmit={handleSubmit}
            />
            <FolderList folders={folders} onEdit={handleStartEdit} onDelete={handleDelete} />
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={Boolean(folderPendingDeletion)}
        title="ลบโฟลเดอร์?"
        description={folderPendingDeletion ? `ต้องการลบโฟลเดอร์ "${folderPendingDeletion.name}" ใช่หรือไม่? (ผลงานข้างในจะไม่ถูกลบ)` : ''}
        confirmLabel="ลบโฟลเดอร์"
        onCancel={() => setFolderPendingDeletion(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
