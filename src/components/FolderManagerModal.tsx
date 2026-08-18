import React, { useState } from 'react';
import { Folder } from '../types';
import { FOLDER_COLOR_PRESETS } from '../lib/constants';
import { X, FolderPlus, Folder as FolderIcon, Edit3, Trash2, Check, Sparkles } from 'lucide-react';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onCreateFolder: (name: string, icon?: string, color?: string) => Promise<boolean>;
  onUpdateFolder: (id: string, name: string, icon?: string, color?: string) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
}

const FOLDER_ICON_PRESETS = ['📁', '🤖', '🎨', '📖', '🔮', '💡', '🍓', '🎀', '🍵', '🌙', '🧸', '⚡'];

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('กรุณากรอกชื่อโฟลเดอร์');
      return;
    }

    setIsSubmitting(true);
    setError('');

    let success = false;
    if (editingFolderId) {
      success = await onUpdateFolder(editingFolderId, folderName.trim(), selectedIcon, selectedColor);
    } else {
      success = await onCreateFolder(folderName.trim(), selectedIcon, selectedColor);
    }

    setIsSubmitting(false);
    if (success) {
      setFolderName('');
      setSelectedIcon('📁');
      setSelectedColor('purple');
      setEditingFolderId(null);
    } else {
      setError('เกิดข้อผิดพลาดในการบันทึกโฟลเดอร์');
    }
  };

  const handleStartEdit = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setSelectedIcon(folder.icon || '📁');
    setSelectedColor(folder.color || 'purple');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingFolderId(null);
    setFolderName('');
    setSelectedIcon('📁');
    setSelectedColor('purple');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-100 dark:border-purple-900/50 bg-gradient-to-r from-purple-50 via-pink-50 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center text-lg shadow-sm shadow-purple-200 dark:shadow-purple-950">
              <FolderIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                จัดการโฟลเดอร์ผลงาน (Custom Folders)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                จัดระเบียบโปรเจกต์บอท, พรอมต์ และโค้ด UI ใน Dashboard ส่วนตัว
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Create or Edit Form */}
          <form onSubmit={handleSubmit} className="p-4 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{editingFolderId ? '✏️ แก้ไขข้อมูลโฟลเดอร์' : '➕ สร้างโฟลเดอร์ใหม่'}</span>
              </span>
              {editingFolderId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                >
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>

            {/* Folder Name Input */}
            <div className="space-y-1">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="เช่น: โปรเจกต์บอทแฟนตาซี, รวม System Prompts ลับ..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Icon Presets */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">เลือกไอคอนโฟลเดอร์:</label>
              <div className="flex flex-wrap gap-1.5">
                {FOLDER_ICON_PRESETS.map((ic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIcon(ic)}
                    className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-all ${
                      selectedIcon === ic
                        ? 'bg-purple-600 text-white shadow-xs scale-105'
                        : 'bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900 text-slate-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-950'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Presets */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">เลือกโทนสี:</label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLOR_PRESETS.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColor(col.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${col.bg} ${col.text} ${col.border} ${
                      selectedColor === col.id ? 'ring-2 ring-purple-500 scale-105 font-bold shadow-xs' : 'opacity-80'
                    }`}
                  >
                    {selectedColor === col.id && <Check className="w-3 h-3" />}
                    <span>{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !folderName.trim()}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'กำลังบันทึก...' : editingFolderId ? 'บันทึกการแก้ไข' : 'สร้างโฟลเดอร์'}
              </button>
            </div>
          </form>

          {/* List of Existing Folders */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>โฟลเดอร์ของคุณ ({folders.length}):</span>
            </h3>

            {folders.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                ยังไม่มีโฟลเดอร์ สร้างโฟลเดอร์แรกของคุณด้านบนได้เลย 🌸
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {folders.map(f => {
                  const colorMeta = FOLDER_COLOR_PRESETS.find(c => c.id === f.color) || FOLDER_COLOR_PRESETS[0];
                  return (
                    <div
                      key={f.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${colorMeta.bg} ${colorMeta.border}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl">{f.icon || '📁'}</span>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${colorMeta.text}`}>
                            {f.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {f.assetsCount || 0} ผลงาน
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(f)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
                          title="แก้ไขโฟลเดอร์"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`ต้องการลบโฟลเดอร์ "${f.name}" ใช่หรือไม่? (ผลงานข้างในจะไม่ถูกลบ)`)) {
                              onDeleteFolder(f.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
                          title="ลบโฟลเดอร์"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
