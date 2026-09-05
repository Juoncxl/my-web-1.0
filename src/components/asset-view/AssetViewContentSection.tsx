import React from 'react';
import { Check, Copy, FileText } from 'lucide-react';

export type AssetCopyType = 'content' | 'code' | 'json' | 'md';

interface AssetViewContentSectionProps {
  content: string;
  copiedType: AssetCopyType | null;
  onCopy: (text: string, type: AssetCopyType) => void;
}

export const AssetViewContentSection: React.FC<AssetViewContentSectionProps> = ({
  content,
  copiedType,
  onCopy
}) => {
  const hasCopyableContent = Boolean(content.trim());
  return (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>เนื้อหา / ข้อมูลตัวละคร / Prompt Directives</span>
      </h3>
      {hasCopyableContent && <button
        onClick={() => onCopy(content, 'content')}
        className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
          copiedType === 'content'
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-slate-700 hover:bg-purple-100'
        }`}
      >
        {copiedType === 'content' ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span>คัดลอกสำเร็จ!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>คัดลอก</span>
          </>
        )}
      </button>}
    </div>
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-text selection:bg-purple-200 dark:selection:bg-purple-900">
      {content}
    </div>
  </div>
  );
};
