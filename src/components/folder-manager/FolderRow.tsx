import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import type { Folder } from '../../types';
import { FOLDER_COLOR_PRESETS } from '../../lib/constants';

interface FolderRowProps {
  folder: Folder;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

export const FolderRow: React.FC<FolderRowProps> = ({ folder, onEdit, onDelete }) => {
  const colorMeta = FOLDER_COLOR_PRESETS.find(color => color.id === folder.color) || FOLDER_COLOR_PRESETS[0];
  const isImage = Boolean(folder.icon && (folder.icon.startsWith('data:image') || folder.icon.startsWith('http')));

  return (
    <div className="cv-folder-row" style={{ '--cv-folder-accent': colorMeta.swatch } as React.CSSProperties}>
      <div className="cv-folder-row-main">
        {isImage ? <img src={folder.icon} alt="" className="cv-folder-row-icon" referrerPolicy="no-referrer" /> : <span className="cv-folder-row-icon" aria-hidden="true">{folder.icon || '📁'}</span>}
        <div className="cv-folder-row-copy">
          <p>{folder.name}</p>
          <span>{folder.assetsCount || 0} ผลงาน</span>
        </div>
      </div>
      <div className="cv-folder-row-actions">
        <button type="button" onClick={() => onEdit(folder)} title="แก้ไขโฟลเดอร์" aria-label={`แก้ไขโฟลเดอร์ ${folder.name}`}><Edit3 className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onDelete(folder)} title="ลบโฟลเดอร์" aria-label={`ลบโฟลเดอร์ ${folder.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
};
