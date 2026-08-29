import React, { useState } from 'react';
import { Code, Eye, FileText, Sparkles } from 'lucide-react';
import { SandboxedCodePreview } from '../SandboxedCodePreview';

export type AssetTemplateType = 'bot_char' | 'system_prompt' | 'ui_bubble';

interface AssetEditorContentSectionProps {
  content: string;
  uiCodeSnippet: string;
  onContentChange: (content: string) => void;
  onUiCodeSnippetChange: (code: string) => void;
  onApplyTemplate: (type: AssetTemplateType) => void;
  onOpenAIModalWithContext?: (type: string, context: string) => void;
}

export const AssetEditorContentSection: React.FC<AssetEditorContentSectionProps> = ({
  content,
  uiCodeSnippet,
  onContentChange,
  onUiCodeSnippetChange,
  onApplyTemplate,
  onOpenAIModalWithContext
}) => {
  const [showCodePreview, setShowCodePreview] = useState(false);

  return (
    <>
      <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>เทมเพลตเริ่มต้นด่วน (Starter Presets)</span>
          </span>
          <span className="text-[10px] text-slate-400">กดเพื่อแทรกโครงสร้าง</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApplyTemplate('bot_char')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
          >
            🎭 ตัวละครแชทบอท & First Message
          </button>
          <button
            type="button"
            onClick={() => onApplyTemplate('system_prompt')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
          >
            📝 System Prompts Directives
          </button>
          <button
            type="button"
            onClick={() => onApplyTemplate('ui_bubble')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
          >
            💻 กล่องแชทพาสเทล CSS
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>เนื้อหาหลัก / สคริปต์ / Prompt (รองรับ Markdown)</span>
          </label>

          {onOpenAIModalWithContext && (
            <button
              type="button"
              onClick={() => onOpenAIModalWithContext('refine', content)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>ใช้ AI ช่วยเกลาเนื้อหา</span>
            </button>
          )}
        </div>

        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="พิมพ์ข้อความรายละเอียด, First message, System Prompt, หรือบันทึกต่างๆ..."
          rows={8}
          className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 leading-relaxed"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>โค้ดตกแต่ง UI เพิ่มเติม (HTML / CSS - Optional)</span>
          </label>

          {uiCodeSnippet.trim() && (
            <button
              type="button"
              onClick={() => setShowCodePreview(!showCodePreview)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showCodePreview ? 'ซ่อนพรีวิว' : 'ทดสอบพรีวิวโค้ด'}</span>
            </button>
          )}
        </div>

        <textarea
          value={uiCodeSnippet}
          onChange={(event) => onUiCodeSnippetChange(event.target.value)}
          placeholder="เช่น: <div class='card'>...</div> <style>.card {...}</style>"
          rows={4}
          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-mono text-indigo-900 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-800"
        />

        {showCodePreview && uiCodeSnippet.trim() && (
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-900/60 mt-2 overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">ผลลัพธ์พรีวิว UI:</div>
            <div className="p-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <SandboxedCodePreview
                code={uiCodeSnippet}
                minHeight="140px"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
