import React from 'react';
import { AssetCategory, Folder } from '../../types';
import { CATEGORIES } from '../../lib/constants';
import { Folder as FolderIcon } from 'lucide-react';

interface AssetEditorOrganizationSectionProps {
  category: AssetCategory;
  folderId: string | null;
  folders: Folder[];
  onCategoryChange: (category: AssetCategory) => void;
  onFolderChange: (folderId: string | null) => void;
}

export const AssetEditorOrganizationSection: React.FC<AssetEditorOrganizationSectionProps> = ({
  category,
  folderId,
  folders,
  onCategoryChange,
  onFolderChange
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        หมวดหมู่หลัก (Category)
      </label>
      <select
        value={category}
        onChange={(event) => onCategoryChange(event.target.value as AssetCategory)}
        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
      >
        {Object.values(CATEGORIES).map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.emoji} {cat.name} ({cat.nameEn})
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
        <FolderIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>โฟลเดอร์จัดเก็บในคลัง (Folder)</span>
      </label>
      <select
        value={folderId || ''}
        onChange={(event) => onFolderChange(event.target.value || null)}
        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
      >
        <option value="">📁 ไม่ระบุโฟลเดอร์ (หน้าแรกคลัง)</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.icon?.startsWith('http') || folder.icon?.startsWith('data:image') ? '📁' : (folder.icon || '📁')} {folder.name}
          </option>
        ))}
      </select>
    </div>
  </div>
);
