import React from 'react';
import { Check, Plus, Sparkles, X } from 'lucide-react';

export const QUICK_APP_TAGS = [
  'Doki chat',
  'Khui ai',
  'Rubii ai',
  'Puean ai',
  'Lovey Dovey',
  'By me chocolate',
  'Joylada',
  'Silly tavern'
];

interface AssetEditorTagsSectionProps {
  tags: string[];
  tagInputValue: string;
  onTagInputValueChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (index: number) => void;
  onTagInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onToggleAppTag: (appTag: string) => void;
}

export const AssetEditorTagsSection: React.FC<AssetEditorTagsSectionProps> = ({
  tags,
  tagInputValue,
  onTagInputValueChange,
  onAddTag,
  onRemoveTag,
  onTagInputKeyDown,
  onToggleAppTag
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        แท็กค้นหา (พิมพ์แล้วกด + เพื่อเพิ่มแท็ก - สูงสุด 10 แท็ก)
      </label>
      <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold">
        {tags.length}/10
      </span>
    </div>

    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-pink-500" />
          <span>⚡ แอพที่รองรับ (Quick App Tags - กดเพื่อเลือกหลายแอพ):</span>
        </span>
        <span className="text-[10px] text-slate-400">เลือกได้หลายรายการ</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_APP_TAGS.map((appTag) => {
          const isSelected = tags.includes(appTag);
          return (
            <button
              key={appTag}
              type="button"
              onClick={() => onToggleAppTag(appTag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow-xs font-bold ring-2 ring-purple-300 dark:ring-purple-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-purple-100 dark:border-slate-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-750'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
              <span>{appTag}</span>
            </button>
          );
        })}
      </div>
    </div>

    <div className="flex gap-2">
      <input
        type="text"
        value={tagInputValue}
        onChange={(event) => onTagInputValueChange(event.target.value)}
        onKeyDown={onTagInputKeyDown}
        disabled={tags.length >= 10}
        placeholder={tags.length >= 10 ? "เพิ่มแท็กครบ 10 รายการแล้ว" : "เช่น: Roleplay, Tsundere, Prompt (กด Enter หรือคลิก +)"}
        className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onAddTag}
        disabled={!tagInputValue.trim() || tags.length >= 10}
        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed active:scale-95 shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>เพิ่ม</span>
      </button>
    </div>

    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {tags.map((tag, index) => {
          const isAppTag = QUICK_APP_TAGS.includes(tag);
          return (
            <span
              key={index}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs animate-in fade-in zoom-in-95 duration-150 border ${
                isAppTag
                  ? 'bg-purple-100 dark:bg-purple-900/60 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200'
                  : 'bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300'
              }`}
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => onRemoveTag(index)}
                className="w-4 h-4 rounded-full bg-purple-200/60 dark:bg-purple-800/60 hover:bg-rose-500 hover:text-white text-purple-700 dark:text-purple-200 flex items-center justify-center transition-colors cursor-pointer"
                title="ลบแท็กนี้"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
      </div>
    )}
  </div>
);
