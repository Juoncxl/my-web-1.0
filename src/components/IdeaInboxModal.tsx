import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cxlDataService } from '../data/cxlDataService';
import { IdeaList } from './IdeaList';

interface IdeaInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The Owner's global idea inbox. Loads the Owner's Works once per opening for "ย้ายไปงาน…". */
export const IdeaInboxModal: React.FC<IdeaInboxModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [works, setWorks] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    let cancelled = false;
    cxlDataService.works.fetch({ userId: currentUser.id })
      .then(result => {
        if (cancelled) return;
        setWorks((result.data || []).filter(work => !work.deletedAt).map(work => ({ id: work.id, title: work.publicCollaboration?.name || work.title || 'ไม่มีชื่อ' })));
      })
      .catch(() => { /* the list still works without Work names */ });
    return () => { cancelled = true; };
  }, [currentUser?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;
  // Rendered into <body>: the Header that opens it is sticky and blurred, which would clip a fixed overlay.
  return createPortal(<div className="cv-idea-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="cv-idea-modal" role="dialog" aria-modal="true" aria-labelledby="cv-idea-modal-title" onClick={event => event.stopPropagation()}>
      <header><div><h2 id="cv-idea-modal-title">💡 กล่องไอเดีย</h2><p>เห็นเฉพาะคุณ · ทุกไอเดียมีวันเวลาที่จดติดไว้ แก้ข้อความแล้วข้อความเดิมยังเก็บไว้ในประวัติ</p></div><button type="button" onClick={onClose} aria-label="ปิดกล่องไอเดีย"><X aria-hidden="true" /></button></header>
      <div className="cv-idea-modal-body"><IdeaList works={works} /></div>
    </section>
  </div>, document.body);
};
