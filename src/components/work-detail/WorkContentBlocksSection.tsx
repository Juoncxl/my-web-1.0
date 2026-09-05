import React from 'react';
import { Check, Copy, FileText } from 'lucide-react';
import type { WorkContentBlock } from '../../types';
import type { AssetCopyType } from '../asset-view/AssetViewContentSection';

interface WorkContentBlocksSectionProps {
  blocks: WorkContentBlock[];
  legacyContent: string;
  copiedType: AssetCopyType | null;
  onCopy: (text: string, type: AssetCopyType) => void;
}

const BLOCK_LABELS: Record<WorkContentBlock['type'], string> = {
  Text: 'ข้อความ', Heading: 'หัวข้อ', Image: 'รูปภาพ', Prompt: 'Prompt',
  'UI Code': 'UI Code', Divider: 'เส้นแบ่ง', Note: 'โน้ต'
};

export const WorkContentBlocksSection: React.FC<WorkContentBlocksSectionProps> = ({ blocks, legacyContent, copiedType, onCopy }) => {
  const visibleBlocks = blocks.filter(block => block.type !== 'UI Code');
  const copyableBlocks = visibleBlocks.filter(block => ['Text', 'Prompt', 'Note'].includes(block.type) && block.body.trim());
  const copyText = copyableBlocks.length
    ? copyableBlocks.map(block => `${block.title}\n${block.body}`).join('\n\n')
    : legacyContent;

  if (visibleBlocks.length === 0 && !legacyContent.trim()) return null;

  return <section className="space-y-3" data-work-detail-section="main-content">
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />Main Content</h3>
      {copyText.trim() && <button type="button" onClick={() => onCopy(copyText, 'content')} className="flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:border-slate-700 dark:bg-slate-800 dark:text-purple-300">{copiedType === 'content' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedType === 'content' ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>}
    </div>
    {visibleBlocks.length > 0 ? <div className="space-y-3">{visibleBlocks.map(block => <article key={block.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"><div className="mb-2 flex items-center justify-between gap-3"><strong className="text-sm text-slate-800 dark:text-slate-100">{block.title}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300">{BLOCK_LABELS[block.type]}</span></div><div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{block.body}</div></article>)}</div> : <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">{legacyContent}</div>}
  </section>;
};
