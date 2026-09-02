import React, { useRef } from 'react';
import { AssetIcon, IconType } from '../../types';
import { POPULAR_EMOJIS } from '../../lib/constants';
import { Upload } from 'lucide-react';

interface AssetEditorIdentitySectionProps {
  title: string;
  iconType: IconType;
  iconValue: string;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: AssetIcon) => void;
  onError: (message: string) => void;
}

export const AssetEditorIdentitySection: React.FC<AssetEditorIdentitySectionProps> = ({
  title,
  iconType,
  iconValue,
  onTitleChange,
  onIconChange,
  onError
}) => {
  const iconImageInputRef = useRef<HTMLInputElement>(null);

  const handleIconImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError('ขนาดรูปไอคอนต้องไม่เกิน 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onIconChange({ type: 'image', value: reader.result as string, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex gap-3 items-start">
      <div className="space-y-1 shrink-0">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          ไอคอน
        </label>
        <div className="relative group">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800 flex items-center justify-center text-2xl overflow-hidden shadow-inner">
            {iconType === 'image' ? (
              <img src={iconValue} alt="Icon" className="w-full h-full object-cover" />
            ) : (
              <span>{iconValue}</span>
            )}
          </div>

          <div className="absolute -bottom-1 -right-1 flex gap-1">
            <input
              type="file"
              ref={iconImageInputRef}
              onChange={handleIconImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => iconImageInputRef.current?.click()}
              title="อัปโหลดรูปภาพไอคอน"
              className="p-1 bg-purple-600 text-white rounded-full shadow-md hover:bg-purple-700 transition-colors"
            >
              <Upload className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          ชื่อผลงาน / ชื่อตัวละคร / หัวข้อ <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="เช่น: 🌸 พลอยใส (Ploysai) — บอทเพื่อนสนิทสายฮีลใจ"
          className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 transition-all"
          required
        />

        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400">อีโมจิด่วน:</span>
          {POPULAR_EMOJIS.slice(0, 10).map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onIconChange({ type: 'emoji', value: emoji })}
              className="w-6 h-6 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950 text-xs transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
