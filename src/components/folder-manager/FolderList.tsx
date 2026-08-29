import React from 'react';
import type { Folder } from '../../types';
import { FolderRow } from './FolderRow';

interface FolderListProps { folders: Folder[]; onEdit: (folder: Folder) => void; onDelete: (folder: Folder) => void; }
export const FolderList: React.FC<FolderListProps> = ({ folders, onEdit, onDelete }) => <div className="space-y-2.5"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between"><span>โฟลเดอร์ทั้งหมดของคุณ ({folders.length}):</span></h3>{folders.length === 0 ? <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">ยังไม่มีโฟลเดอร์ สร้างโฟลเดอร์แรกของคุณพร้อมใส่รูปหรือภาพ GIF ด้านบนได้เลย 🌸</div> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{folders.map((folder) => <FolderRow key={folder.id} folder={folder} onEdit={onEdit} onDelete={onDelete} />)}</div>}</div>;
