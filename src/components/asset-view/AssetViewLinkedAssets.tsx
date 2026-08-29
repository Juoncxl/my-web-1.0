import React from 'react';
import { Asset } from '../../types';
import { Link2 } from 'lucide-react';

interface AssetViewLinkedAssetsProps {
  linkedAssets: Asset[];
  onSelectLinkedAsset?: (assetId: string) => void;
}

export const AssetViewLinkedAssets: React.FC<AssetViewLinkedAssetsProps> = ({
  linkedAssets,
  onSelectLinkedAsset
}) => {
  if (linkedAssets.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>ผลงานที่เชื่อมโยงกัน (Linked Related Resources)</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {linkedAssets.map((linked) => (
          <div
            key={linked.id}
            onClick={() => onSelectLinkedAsset && onSelectLinkedAsset(linked.id)}
            className="p-3 rounded-2xl border border-purple-100 dark:border-slate-800 bg-purple-50/40 dark:bg-slate-800/40 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">{linked.icon?.value || '📄'}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {linked.title}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  @{linked.authorName} • {linked.category}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
              ดูข้อมูล →
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
