import React, { useEffect, useMemo, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { User } from '../types';
import { getCanonicalProfilePath } from '../lib/profileIdentity';

export interface CreatorProfilePreviewAnchor {
  top: number;
  left: number;
  bottom: number;
}

interface CreatorProfilePreviewProps {
  profile: User | null;
  anchor: CreatorProfilePreviewAnchor | null;
  onClose: () => void;
}

function getInitial(displayName: string): string {
  return Array.from(displayName.trim()).slice(0, 2).join('').toUpperCase() || 'CX';
}

export const CreatorProfilePreview: React.FC<CreatorProfilePreviewProps> = ({ profile, anchor, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const desktopPosition = useMemo(() => {
    if (!anchor || typeof window === 'undefined') return undefined;
    return {
      '--cv-creator-preview-top': `${Math.min(anchor.bottom + 10, window.innerHeight - 246)}px`,
      '--cv-creator-preview-left': `${Math.max(12, Math.min(anchor.left, window.innerWidth - 332))}px`
    } as React.CSSProperties;
  }, [anchor]);

  useEffect(() => {
    if (!profile) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, profile]);

  if (!profile) return null;

  const openFullProfile = () => {
    window.location.assign(getCanonicalProfilePath(profile));
  };

  return <div className="cv-creator-profile-preview-layer" role="presentation">
    <button type="button" className="cv-creator-profile-preview-backdrop" onClick={onClose} aria-label="ปิดโปรไฟล์ย่อ" />
    <section className="cv-creator-profile-preview" style={desktopPosition} role="dialog" aria-modal="true" aria-labelledby="cv-creator-profile-preview-title">
      <button ref={closeButtonRef} type="button" className="cv-creator-profile-preview-close" onClick={onClose} aria-label="ปิดโปรไฟล์ย่อ"><X className="h-4 w-4" /></button>
      <div className="cv-creator-profile-preview-identity">
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt={`รูปโปรไฟล์ของ ${profile.displayName}`} referrerPolicy="no-referrer" />
          : <span aria-hidden="true">{getInitial(profile.displayName)}</span>}
        <div>
          <strong id="cv-creator-profile-preview-title">{profile.displayName}</strong>
          <small>{profile.username ? `@${profile.username}` : 'Creator'}</small>
        </div>
      </div>
      <p>{profile.bio?.trim() || 'Creator คนนี้ยังไม่ได้เพิ่มคำแนะนำตัว'}</p>
      <button type="button" className="cv-creator-profile-preview-open" onClick={openFullProfile}>ดูโปรไฟล์เต็ม <ExternalLink className="h-3.5 w-3.5" /></button>
    </section>
  </div>;
};
