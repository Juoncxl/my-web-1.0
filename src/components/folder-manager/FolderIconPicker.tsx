import React from 'react';
import { Check, Image as ImageIcon, Link as LinkIcon, RotateCcw, Smile, Upload, WandSparkles } from 'lucide-react';

export type FolderIconMode = 'presets' | 'custom' | 'media';
export const FOLDER_ICON_PRESETS = ['📁', '📂', '🤖', '🎨', '📖', '🔮', '💡', '🍓', '🎀', '🍵', '🌙', '🧸', '⚡', '🌸', '✨', '💎', '🎮', '🦄', '🎧', '🧁', '🚀', '🔥', '📚', '⭐'];

interface FolderIconPickerProps {
  selectedIcon: string;
  iconMode: FolderIconMode;
  customEmojiInput: string;
  imageUrlInput: string;
  error: string;
  onIconChange: (value: string) => void;
  onModeChange: (mode: FolderIconMode) => void;
  onCustomEmojiChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onApplyEmoji: () => void;
  onApplyUrl: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const FolderIconPicker: React.FC<FolderIconPickerProps> = ({
  selectedIcon,
  iconMode,
  customEmojiInput,
  imageUrlInput,
  onIconChange,
  onModeChange,
  onCustomEmojiChange,
  onImageUrlChange,
  onApplyEmoji,
  onApplyUrl,
  onFileUpload,
  onReset,
  fileInputRef
}) => {
  const isImageIcon = selectedIcon.startsWith('data:image') || selectedIcon.startsWith('http');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          <WandSparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span>ไอคอนโฟลเดอร์</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">ตัวอย่าง</span>
          <div className="cv-folder-icon-preview">
            {isImageIcon ? <img src={selectedIcon} alt="ตัวอย่างไอคอนโฟลเดอร์" referrerPolicy="no-referrer" /> : <span>{selectedIcon || '📁'}</span>}
          </div>
          {isImageIcon && <button type="button" onClick={onReset} className="text-[10px] font-semibold text-rose-500 hover:underline" title="รีเซ็ตไอคอน">รีเซ็ต</button>}
        </div>
      </div>

      <div className="cv-folder-icon-tabs" role="tablist" aria-label="รูปแบบไอคอนโฟลเดอร์">
        <button type="button" role="tab" aria-selected={iconMode === 'presets'} onClick={() => onModeChange('presets')} className={iconMode === 'presets' ? 'is-active' : ''}><Smile className="h-3.5 w-3.5" />Emoji แนะนำ</button>
        <button type="button" role="tab" aria-selected={iconMode === 'custom'} onClick={() => onModeChange('custom')} className={iconMode === 'custom' ? 'is-active' : ''}><span className="text-sm">☺</span>Emoji ของฉัน</button>
        <button type="button" role="tab" aria-selected={iconMode === 'media'} onClick={() => onModeChange('media')} className={iconMode === 'media' ? 'is-active' : ''}><ImageIcon className="h-3.5 w-3.5" />GIF / รูป</button>
      </div>

      {iconMode === 'presets' && (
        <div className="cv-folder-icon-panel">
          <div className="cv-folder-icon-grid">
            {FOLDER_ICON_PRESETS.map(icon => <button key={icon} type="button" onClick={() => onIconChange(icon)} className={selectedIcon === icon ? 'is-selected' : ''} aria-label={`เลือกไอคอน ${icon}`}>{icon}</button>)}
          </div>
          <p className="text-[10px] text-slate-400">เลือกไอคอนแนะนำสำหรับคอลเลกชันของคุณ</p>
        </div>
      )}

      {iconMode === 'custom' && (
        <div className="cv-folder-icon-panel space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="custom-folder-emoji">Emoji หรือสัญลักษณ์ของฉัน</label>
          <div className="flex gap-2">
            <input id="custom-folder-emoji" type="text" value={customEmojiInput} onChange={event => onCustomEmojiChange(event.target.value)} placeholder="วาง Emoji จาก keyboard หรือใส่ Kaomoji" className="min-w-0 flex-1 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <button type="button" onClick={onApplyEmoji} disabled={!customEmojiInput.trim()} className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">ใช้ไอคอนนี้</button>
          </div>
          <p className="text-[10px] text-slate-400">รองรับ Emoji จากอุปกรณ์และข้อความสั้น ๆ ตาม behavior เดิม</p>
        </div>
      )}

      {iconMode === 'media' && (
        <div className="cv-folder-icon-panel space-y-3">
          <input type="file" ref={fileInputRef} onChange={onFileUpload} accept="image/*,.gif" className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="cv-folder-upload-zone">
            <span className="cv-folder-upload-icon"><Upload className="h-4 w-4" /></span>
            <span><strong>เลือก GIF หรือรูปจากเครื่อง</strong><small>PNG, JPG, WEBP, Animated GIF · ไม่เกิน 5MB</small></span>
          </button>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1"><LinkIcon className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" /><input type="url" value={imageUrlInput} onChange={event => onImageUrlChange(event.target.value)} placeholder="ลิงก์รูปหรือ GIF ที่มีอยู่แล้ว" className="w-full rounded-xl border border-purple-100 bg-white py-2 pl-8 pr-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></div>
            <button type="button" onClick={onApplyUrl} disabled={!imageUrlInput.trim()} className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">ใช้ลิงก์</button>
          </div>
          <p className="text-[10px] text-slate-400">วิธีนี้คงการรองรับ URL image/GIF เดิมไว้ และไม่เปลี่ยน validation ของการอัปโหลด</p>
        </div>
      )}
    </div>
  );
};
