import React from 'react';
import { HardDrive, Lock, User } from 'lucide-react';
import type { SettingsTab } from './SettingsTypes';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onTabChange }) => (
  <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50 gap-2 pt-2 overflow-x-auto no-scrollbar">
    <button
      onClick={() => onTabChange('profile')}
      className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
        activeTab === 'profile'
          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <User className="w-3.5 h-3.5" />
      <span>โปรไฟล์</span>
    </button>
    <button
      onClick={() => onTabChange('security')}
      className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
        activeTab === 'security'
          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <Lock className="w-3.5 h-3.5" />
      <span>รหัสผ่าน</span>
    </button>
    <button
      onClick={() => onTabChange('backup')}
      className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
        activeTab === 'backup'
          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <HardDrive className="w-3.5 h-3.5" />
      <span>สำรองข้อมูล (Backup)</span>
    </button>
  </div>
);
