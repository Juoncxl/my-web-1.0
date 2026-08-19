import React, { useState, useRef } from 'react';
import { Folder } from '../types';
import { FOLDER_COLOR_PRESETS } from '../lib/constants';
import { 
  X, 
  FolderPlus, 
  Folder as FolderIcon, 
  Edit3, 
  Trash2, 
  Check, 
  Sparkles, 
  Upload, 
  Link as LinkIcon, 
  Smile, 
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onCreateFolder: (name: string, icon?: string, color?: string) => Promise<boolean>;
  onUpdateFolder: (id: string, name: string, icon?: string, color?: string) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
}

const FOLDER_ICON_PRESETS = [
  '📁', '📂', '🤖', '🎨', '📖', '🔮', '💡', '🍓', 
  '🎀', '🍵', '🌙', '🧸', '⚡', '🌸', '✨', '💎', 
  '🎮', '🦄', '🎧', '🧁', '🚀', '🔥', '📚', '⭐'
];

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

  // Icon Mode: 'presets' | 'upload' | 'url'
  const [iconMode, setIconMode] = useState<'presets' | 'upload' | 'url'>('presets');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isImageIcon = selectedIcon.startsWith('data:image') || selectedIcon.startsWith('http');
  const isGif = isImageIcon && (selectedIcon.includes('image/gif') || selectedIcon.toLowerCase().includes('.gif'));

  // Handle local image / GIF file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size check (under 5MB for responsiveness)
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
    reader.onerror = () => {
      setError('ไม่สามารถอ่านไฟล์รูปภาพได้');
    };
    reader.readAsDataURL(file);
  };

  // Handle Image URL apply
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
      setIconMode('presets');
    } else {
      setError('เกิดข้อผิดพลาดในการบันทึกโฟลเดอร์');
    }
  };

  const handleStartEdit = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    const icon = folder.icon || '📁';
    setSelectedIcon(icon);
    setSelectedColor(folder.color || 'purple');
    setError('');

    if (icon.startsWith('data:image') || icon.startsWith('http')) {
      setIconMode('upload');
    } else {
      setIconMode('presets');
    }
  };

  const handleCancelEdit = () => {
    setEditingFolderId(null);
    setFolderName('');
    setSelectedIcon('📁');
    setSelectedColor('purple');
    setError('');
    setIconMode('presets');
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
                รองรับไอคอนรูปภาพ, ภาพ GIF เคลื่อนไหว, และอีโมจิ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Create or Edit Form */}
          <form onSubmit={handleSubmit} className="p-4 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{editingFolderId ? '✏️ แก้ไขข้อมูลโฟลเดอร์' : '➕ สร้างโฟลเดอร์ใหม่'}</span>
              </span>
              {editingFolderId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                >
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>

            {/* Folder Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                ชื่อโฟลเดอร์:
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="เช่น: โปรเจกต์บอทแฟนตาซี, รวม System Prompts ลับ..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-400 font-medium"
              />
            </div>

            {/* Folder Icon Section (Emoji / Image / GIF) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>ไอคอนโฟลเดอร์ (Icon / Image / GIF):</span>
                </label>

                {/* Preview Thumbnail */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">ตัวอย่าง:</span>
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 shadow-xs flex items-center justify-center overflow-hidden">
                    {isImageIcon ? (
                      <img 
                        src={selectedIcon} 
                        alt="Folder Icon Preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-base">{selectedIcon}</span>
                    )}
                  </div>
                  {isImageIcon && (
                    <button
                      type="button"
                      onClick={() => setSelectedIcon('📁')}
                      className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                      title="รีเซ็ตเป็นไอคอนปกติ"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>รีเซ็ต</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Icon Mode Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setIconMode('presets')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    iconMode === 'presets'
                      ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>อีโมจิ & พรีเซ็ต</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIconMode('upload')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    iconMode === 'upload'
                      ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>อัปโหลดรูปภาพ / GIF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIconMode('url')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    iconMode === 'url'
                      ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>วางลิงก์ URL</span>
                </button>
              </div>

              {/* Mode 1: Preset Emojis */}
              {iconMode === 'presets' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-800/80 rounded-xl border border-purple-100 dark:border-purple-900/50">
                    {FOLDER_ICON_PRESETS.map((ic, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedIcon(ic)}
                        className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                          selectedIcon === ic
                            ? 'bg-purple-600 text-white shadow-xs scale-105 ring-2 ring-purple-300 dark:ring-purple-700'
                            : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-950'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>

                  {/* Custom Emoji / Text Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customEmojiInput}
                      onChange={(e) => setCustomEmojiInput(e.target.value)}
                      placeholder="พิมพ์หรือวางอีโมจิ / Kaomoji อื่นๆ ที่ต้องการ..."
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customEmojiInput.trim()) {
                          setSelectedIcon(customEmojiInput.trim());
                          setCustomEmojiInput('');
                        }
                      }}
                      disabled={!customEmojiInput.trim()}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      นำไปใช้
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Upload Image / GIF */}
              {iconMode === 'upload' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.gif"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 bg-white dark:bg-slate-800/80 hover:bg-purple-50/50 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-800 dark:text-purple-300">
                        คลิกเพื่อเลือกไฟล์รูปภาพ หรือภาพ GIF เคลื่อนไหว
                      </p>
                      <p className="text-[10.5px] text-slate-400">
                        รองรับ PNG, JPG, WEBP, Animated GIF (ขนาดแนะนำสี่เหลี่ยมจัตุรัส ไม่เกิน 5MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 3: Image / GIF URL */}
              {iconMode === 'url' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/icon.gif หรือ .png..."
                      className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleApplyImageUrl}
                      disabled={!imageUrlInput.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>นำไปใช้</span>
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    💡 สามารถคัดลอกลิงก์ตรงของรูปภาพหรือ GIF จาก Discord, Tenor, Giphy, Pinterest หรือเว็บไซต์อื่นมาวางได้ทันที
                  </p>
                </div>
              )}
            </div>

            {/* Color Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                เลือกโทนสีกรอบโฟลเดอร์:
              </label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLOR_PRESETS.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColor(col.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${col.bg} ${col.text} ${col.border} ${
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
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isSubmitting ? 'กำลังบันทึก...' : editingFolderId ? 'บันทึกการแก้ไข' : 'สร้างโฟลเดอร์'}
              </button>
            </div>
          </form>

          {/* List of Existing Folders */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>โฟลเดอร์ทั้งหมดของคุณ ({folders.length}):</span>
            </h3>

            {folders.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                ยังไม่มีโฟลเดอร์ สร้างโฟลเดอร์แรกของคุณพร้อมใส่รูปหรือภาพ GIF ด้านบนได้เลย 🌸
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {folders.map(f => {
                  const colorMeta = FOLDER_COLOR_PRESETS.find(c => c.id === f.color) || FOLDER_COLOR_PRESETS[0];
                  const folderIsImage = f.icon && (f.icon.startsWith('data:image') || f.icon.startsWith('http'));

                  return (
                    <div
                      key={f.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${colorMeta.bg} ${colorMeta.border}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {folderIsImage ? (
                          <img
                            src={f.icon}
                            alt={f.name}
                            className="w-7 h-7 rounded-lg object-cover shadow-xs shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xl shrink-0">{f.icon || '📁'}</span>
                        )}
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
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
