import React from 'react';
import { HardDrive, Lock, User } from 'lucide-react';
import type { SettingsTab } from './SettingsTypes';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onTabChange }) => (
  <div className="cv-settings-tabs" role="tablist" aria-label="หมวดการตั้งค่า">
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === 'profile'}
      onClick={() => onTabChange('profile')}
      className={`cv-settings-tab${activeTab === 'profile' ? ' is-active' : ''}`}
    >
      <User className="w-4 h-4" />
      <span>โปรไฟล์</span>
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === 'security'}
      onClick={() => onTabChange('security')}
      className={`cv-settings-tab${activeTab === 'security' ? ' is-active' : ''}`}
    >
      <Lock className="w-4 h-4" />
      <span>รหัสผ่าน</span>
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === 'backup'}
      onClick={() => onTabChange('backup')}
      className={`cv-settings-tab${activeTab === 'backup' ? ' is-active' : ''}`}
    >
      <HardDrive className="w-4 h-4" />
      <span>สำรองข้อมูล <small>(Backup)</small></span>
    </button>
  </div>
);
