import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderInput, Pencil, Unlink, X } from 'lucide-react';
import type { Asset, Folder, User } from '../types';
import { AssetCard } from './AssetCard';
import { acquireViewportScrollLock } from '../lib/viewportScrollLock';

interface FolderDetailModalProps {
  isOpen: boolean;
  folder: Folder | null;
  assets: Asset[];
  isOwner: boolean;
  creatorProfile?: User | null;
  onClose: () => void;
  onOpenWork: (asset: Asset) => void;
  onEditWork?: (asset: Asset) => void;
  onMoveWork?: (asset: Asset) => void;
  onRemoveWork?: (assetId: string) => Promise<boolean>;
}

/** Owner-only Folder presentation until Folder gains an explicit visibility field. */
export const FolderDetailModal: React.FC<FolderDetailModalProps> = ({
  isOpen,
  folder,
  assets,
  isOwner,
  creatorProfile,
  onClose,
  onOpenWork,
  onEditWork,
  onMoveWork,
  onRemoveWork
}) => {
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const folderAssets = useMemo(
    () => folder ? assets.filter(asset => asset.folderId === folder.id && !asset.deletedAt) : [],
    [assets, folder]
  );

  useEffect(() => {
    if (!isOpen || !folder || !isOwner || typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = acquireViewportScrollLock(document);
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      releaseScrollLock();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [Boolean(folder), isOpen, isOwner]);

  if (!isOpen || !folder || !isOwner || typeof document === 'undefined') return null;

  const removeFromFolder = async (assetId: string) => {
    if (!onRemoveWork) return;
    setRemovingAssetId(assetId);
    try {
      await onRemoveWork(assetId);
    } finally {
      setRemovingAssetId(null);
    }
  };

  return createPortal(<div className="cv-modal-backdrop csp-folder-detail-backdrop" role="presentation" data-folder-detail-backdrop onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="cv-modal-panel csp-folder-detail-modal" role="dialog" aria-modal="true" aria-labelledby="csp-folder-detail-title" data-folder-id={folder.id}>
      <header className="csp-folder-detail-header">
        <div className="csp-folder-detail-identity">
          <span className="csp-folder-detail-icon">{folder.icon || '📁'}</span>
          <div>
            <p className="csp-eyebrow">FOLDER DETAIL</p>
            <h2 id="csp-folder-detail-title">{folder.name}</h2>
            <p>{folderAssets.length} ผลงาน · อัปเดต {new Date(folder.updatedAt).toLocaleDateString('th-TH')}</p>
          </div>
        </div>
        <button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิดรายละเอียดโฟลเดอร์"><X className="h-4 w-4" /></button>
      </header>

      <div className="csp-folder-detail-body">
        {folderAssets.length ? <div className="csp-folder-detail-grid">
          {folderAssets.map(asset => <div className="csp-folder-detail-work" key={asset.id} data-folder-work-id={asset.id}>
            <AssetCard asset={asset} onClick={onOpenWork} onEdit={onEditWork} isOwner creatorProfile={creatorProfile} />
            <div className="csp-folder-detail-work-actions">
              {onEditWork && <button type="button" onClick={() => onEditWork(asset)}><Pencil className="h-3.5 w-3.5" />แก้ไข</button>}
              {onMoveWork && <button type="button" onClick={() => onMoveWork(asset)}><FolderInput className="h-3.5 w-3.5" />ย้ายไปโฟลเดอร์</button>}
              {onRemoveWork && <button type="button" className="is-danger" disabled={removingAssetId === asset.id} onClick={() => void removeFromFolder(asset.id)} title="นำออกจากโฟลเดอร์โดยไม่ลบผลงาน"><Unlink className="h-3.5 w-3.5" />{removingAssetId === asset.id ? 'กำลังนำออก…' : 'นำออกจากโฟลเดอร์'}</button>}
            </div>
          </div>)}
        </div> : <div className="csp-empty"><h3>โฟลเดอร์นี้ยังไม่มีผลงาน</h3><p>ใช้ “ย้ายไปโฟลเดอร์” จาก Work Detail หรือเลือก Folder ใน Create/Edit Work</p></div>}
      </div>
    </section>
  </div>, document.body);
};
