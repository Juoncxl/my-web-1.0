import React from 'react';
import { Asset } from '../../types';
import { Check, Link2 } from 'lucide-react';

interface AssetEditorLinkedAssetsSectionProps {
  availableAssets: Asset[];
  currentAssetId?: string;
  linkedAssetIds: string[];
  onToggleLinkedAsset: (assetId: string) => void;
}

export const AssetEditorLinkedAssetsSection: React.FC<AssetEditorLinkedAssetsSectionProps> = ({
  availableAssets,
  currentAssetId,
  linkedAssetIds,
  onToggleLinkedAsset
}) => {
  if (availableAssets.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>ผลงานที่เชื่อมโยงกัน (Linked Related Resources)</span>
      </label>
      <p className="text-[11px] text-slate-400">
        เลือกเชื่อมโยงตัวละครเข้ากับ Lore ประจำโลก หรือชุดคำสั่ง System Prompt อื่นๆ ในคลัง
      </p>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
        {availableAssets
          .filter((asset) => asset.id !== currentAssetId)
          .map((asset) => {
            const isLinked = linkedAssetIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onToggleLinkedAsset(asset.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  isLinked
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                }`}
              >
                <span>{asset.icon?.value || '📄'}</span>
                <span className="truncate max-w-[140px]">{asset.title}</span>
                {isLinked && <Check className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
              </button>
            );
          })}
      </div>
    </div>
  );
};
