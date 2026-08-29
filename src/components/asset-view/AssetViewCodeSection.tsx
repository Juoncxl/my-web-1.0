import React from 'react';
import { Code, Copy } from 'lucide-react';
import { SandboxedCodePreview } from '../SandboxedCodePreview';
import { AssetCopyType } from './AssetViewContentSection';

export type AssetViewTab = 'preview' | 'code' | 'split';

interface AssetViewCodeSectionProps {
  code: string;
  uiTab: AssetViewTab;
  copiedType: AssetCopyType | null;
  onTabChange: (tab: AssetViewTab) => void;
  onCopy: (text: string, type: AssetCopyType) => void;
}

export const AssetViewCodeSection: React.FC<AssetViewCodeSectionProps> = ({
  code,
  uiTab,
  copiedType,
  onTabChange,
  onCopy
}) => {
  if (!code) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>โค้ดตกแต่ง UI & การแสดงผล (HTML/CSS)</span>
        </h3>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => onTabChange('split')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              uiTab === 'split' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
            }`}
          >
            พรีวิวคู่
          </button>
          <button
            onClick={() => onTabChange('preview')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              uiTab === 'preview' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
            }`}
          >
            พรีวิวอย่างเดียว
          </button>
          <button
            onClick={() => onTabChange('code')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              uiTab === 'code' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
            }`}
          >
            Raw Code
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${uiTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {(uiTab === 'preview' || uiTab === 'split') && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              ✦ Safe Sandboxed Preview
            </div>
            <div className="p-2 rounded-2xl bg-gradient-to-br from-slate-100 to-purple-50/50 dark:from-slate-900 dark:to-slate-850 border border-purple-200 dark:border-slate-800 min-h-[220px] flex items-center justify-center overflow-hidden">
              <SandboxedCodePreview
                code={code}
                minHeight="200px"
              />
            </div>
          </div>
        )}
        {(uiTab === 'code' || uiTab === 'split') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>HTML / CSS Source</span>
              <button
                onClick={() => onCopy(code, 'code')}
                className="text-purple-600 dark:text-purple-400 hover:underline lowercase font-medium flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedType === 'code' ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 text-purple-200 text-xs font-mono overflow-x-auto max-h-[260px] border border-slate-800">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
