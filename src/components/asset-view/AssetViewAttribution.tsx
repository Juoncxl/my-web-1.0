import React from 'react';
import { Asset } from '../../types';
import { Clock, History, ShieldCheck } from 'lucide-react';
import { formatShortDate, formatThaiDate } from '../../lib/dateUtils';

interface AssetViewAttributionProps {
  asset: Asset;
  showVersionHistory: boolean;
  onToggleVersionHistory: () => void;
}

export const AssetViewAttribution: React.FC<AssetViewAttributionProps> = ({
  asset,
  showVersionHistory,
  onToggleVersionHistory
}) => (
  <>
    <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <img
          src={asset.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
          alt={asset.authorName}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-300 dark:ring-purple-700"
        />
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {asset.authorName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-purple-500" />
            <span>สร้างเมื่อ: {formatThaiDate(asset.createdAt)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center">
        <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>#VAULT-{asset.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <button
          type="button"
          onClick={onToggleVersionHistory}
          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 text-[11px] font-medium flex items-center gap-1 transition-colors"
        >
          <History className="w-3.5 h-3.5 text-purple-500" />
          <span>ประวัติแก้ไข ({asset.versions?.length || 1})</span>
        </button>
      </div>
    </div>

    {showVersionHistory && (
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-purple-500" />
            <span>ประวัติเวอร์ชันและไทม์สแตมป์ (Version History)</span>
          </span>
          <span className="text-[10px] text-slate-400">บันทึกทุกครั้งที่มีการอัปเดต</span>
        </div>
        <div className="space-y-2">
          {asset.versions && asset.versions.length > 0 ? (
            asset.versions.map((version, index) => (
              <div key={index} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-600 dark:text-purple-400">v{version.version || (index + 1)}.0</span>
                  <span className="text-slate-600 dark:text-slate-400">{version.summary || 'บันทึกการแก้ไขเนื้อหา'}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatShortDate(version.updatedAt || asset.updatedAt)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-purple-600 dark:text-purple-400">v1.0 (ต้นฉบับ)</span>
                <span className="text-slate-600 dark:text-slate-400">สร้างเอกสารครั้งแรก</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {formatShortDate(asset.createdAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    )}
  </>
);
