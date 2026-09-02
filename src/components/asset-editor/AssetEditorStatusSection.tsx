import React from 'react';
import { AssetStatus, AssetVisibility } from '../../types';
import { STATUS_PRESETS } from '../../lib/constants';
import { Activity, Globe } from 'lucide-react';

interface AssetEditorStatusSectionProps {
  visibility: AssetVisibility;
  status: AssetStatus;
  onVisibilityChange: (visibility: AssetVisibility) => void;
  onStatusChange: (status: AssetStatus) => void;
}

export const AssetEditorStatusSection: React.FC<AssetEditorStatusSectionProps> = ({
  visibility,
  status,
  onVisibilityChange,
  onStatusChange
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-purple-50/40 dark:bg-slate-800/40 rounded-2xl border border-purple-100 dark:border-slate-800">
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>ระดับการมองเห็น (Visibility)</span>
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {(['public', 'private'] as AssetVisibility[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onVisibilityChange(value)}
            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
              visibility === value
                ? 'border-purple-600 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-xs'
                : 'border-transparent bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="text-sm">
              {value === 'public' ? '🌐' : '🔒'}
            </span>
            <span className="text-[11px]">
              {value === 'public' ? 'สาธารณะ' : 'ส่วนตัว'}
            </span>
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>สถานะงาน (Workflow Status)</span>
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {(['idea', 'draft', 'in_progress', 'finished', 'archived'] as AssetStatus[]).map((value) => {
          const meta = STATUS_PRESETS[value];
          const isSelected = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(value)}
              className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                isSelected
                  ? `${meta.bg} ${meta.text} ${meta.border} shadow-xs scale-102`
                  : 'border-transparent bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title={`${meta.emoji} ${meta.name}`}
            >
              <span className="text-xs">{meta.emoji}</span>
              <span className="truncate max-w-[55px] text-[10.5px] font-bold">{meta.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
