import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Image as ImageIcon, Link2, Trash2, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ProfileSocialLink, User as ProfileUser } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { ProfileAvatarPicker } from './profile/ProfileAvatarPicker';
import { ProfileFields } from './profile/ProfileFields';
import { getProfileUsernameValidationError, normalizeProfileUsername } from '../lib/profileIdentity';
import { deleteQaProfileImage, getQaProfileImage, getQaProfileImageUrl, restoreQaProfileImage, isQaObjectUrl, validateQaProfileImage } from '../lib/qaProfileImageStore';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (user: ProfileUser) => void;
}

const SOCIAL_LINK_DEFS = [
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'x', label: 'X' },
  { platform: 'website', label: 'Website' },
  { platform: 'contact', label: 'Contact' }
] as const;

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
}

function buildSocialLinkRows(links: ProfileSocialLink[] | undefined): ProfileSocialLink[] {
  const existing = links || [];
  const known = SOCIAL_LINK_DEFS.map(definition => {
    const match = existing.find(link => link.platform === definition.platform);
    return match || { platform: definition.platform, label: definition.label, url: '', visible: true };
  });
  const custom = existing.filter(link => !SOCIAL_LINK_DEFS.some(definition => definition.platform === link.platform));
  return [...known, ...custom];
}

function validateSocialLinks(links: ProfileSocialLink[]): string | null {
  for (const link of links) {
    const value = link.url.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'mailto:') return `ลิงก์ ${link.label || 'โปรไฟล์'} ต้องเป็น HTTPS หรือ mailto`;
    } catch {
      return `ลิงก์ ${link.label || 'โปรไฟล์'} ไม่ถูกต้อง`;
    }
  }
  return null;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { currentUser, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<ProfileSocialLink[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarRemovalRequested, setAvatarRemovalRequested] = useState(false);
  const [coverRemovalRequested, setCoverRemovalRequested] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const temporaryPreviewUrls = useRef<{ avatar: string | null; cover: string | null }>({ avatar: null, cover: null });

  const revokeTemporaryPreview = (kind: 'avatar' | 'cover') => {
    const previous = temporaryPreviewUrls.current[kind];
    if (previous && isQaObjectUrl(previous) && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previous);
    temporaryPreviewUrls.current[kind] = null;
  };

  const setTemporaryPreview = (kind: 'avatar' | 'cover', url: string) => {
    revokeTemporaryPreview(kind);
    temporaryPreviewUrls.current[kind] = url;
    if (kind === 'avatar') setAvatarUrl(url);
    else setCoverUrl(url);
  };

  // Once metadata has been saved, the QA image store owns this object URL.
  // Do not revoke it when the modal closes or when AuthContext publishes the
  // freshly saved User; the Header/Profile may still be rendering it.
  const commitTemporaryPreview = (kind: 'avatar' | 'cover', url: string) => {
    if (temporaryPreviewUrls.current[kind] === url) temporaryPreviewUrls.current[kind] = null;
  };

  useEffect(() => () => {
    revokeTemporaryPreview('avatar');
    revokeTemporaryPreview('cover');
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setDisplayName(currentUser.displayName || '');
    setUsername(currentUser.username || '');
    setBio(currentUser.bio || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setCoverUrl(currentUser.coverUrl || '');
    setSocialLinks(buildSocialLinkRows(currentUser.socialLinks));
    revokeTemporaryPreview('avatar');
    revokeTemporaryPreview('cover');
    setAvatarFile(null);
    setCoverFile(null);
    setAvatarRemovalRequested(false);
    setCoverRemovalRequested(false);
    setErrorMsg('');
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateQaProfileImage(file);
    if (validationError) {
      setErrorMsg(validationError);
      event.target.value = '';
      return;
    }
    let previewUrl: string;
    try {
      previewUrl = URL.createObjectURL(file);
    } catch {
      setErrorMsg('ไม่สามารถอ่านไฟล์ภาพปกได้');
      event.target.value = '';
      return;
    }
    setCoverFile(file);
    setCoverRemovalRequested(false);
    setTemporaryPreview('cover', previewUrl);
    setErrorMsg('');
  };

  const updateSocialLink = (index: number, patch: Partial<ProfileSocialLink>) => {
    setSocialLinks(previous => previous.map((link, linkIndex) => linkIndex === index ? { ...link, ...patch } : link));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;
    const cleanUsername = normalizeProfileUsername(username) || '';
    const usernameError = getProfileUsernameValidationError(username);
    if (usernameError) {
      setErrorMsg(usernameError);
      return;
    }
    const socialError = validateSocialLinks(socialLinks);
    if (socialError) {
      setErrorMsg(socialError);
      return;
    }

    const imageWrites: Array<{ kind: 'avatar' | 'cover'; previousBlob: Blob | null }> = [];
    const rollbackImages = async () => {
      await Promise.all(imageWrites.map(async write => {
        try {
          await restoreQaProfileImage({ ownerId: currentUser.id, kind: write.kind, blob: write.previousBlob });
        } catch {
          // Keep reporting the metadata failure; a later hydration can still
          // recover the last successfully persisted image when available.
        }
      }));
      await Promise.all(imageWrites.map(async write => {
        let restoredUrl: string | null = null;
        try { restoredUrl = await getQaProfileImageUrl({ ownerId: currentUser.id, kind: write.kind }); } catch { /* use the canonical URL fallback below */ }
        if (write.kind === 'avatar') {
          revokeTemporaryPreview('avatar');
          setAvatarUrl(restoredUrl || (currentUser.avatarUrl && !isQaObjectUrl(currentUser.avatarUrl) ? currentUser.avatarUrl : ''));
        } else {
          revokeTemporaryPreview('cover');
          setCoverUrl(restoredUrl || (currentUser.coverUrl && !isQaObjectUrl(currentUser.coverUrl) ? currentUser.coverUrl : ''));
        }
      }));
    };

    setIsSaving(true);
    setErrorMsg('');
    try {
      let nextAvatarUrl = avatarUrl;
      let nextCoverUrl = coverUrl;
      let nextAvatarImageKey: string | null = currentUser.avatarImageKey || null;
      let nextCoverImageKey: string | null = currentUser.coverImageKey || null;
      if (avatarRemovalRequested) nextAvatarImageKey = null;
      if (coverRemovalRequested) nextCoverImageKey = null;

      if (avatarFile) {
        const upload = await supabaseService.uploadProfileImage(currentUser.id, avatarFile, 'avatar');
        if (!upload.data) {
          setErrorMsg(upload.error || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ');
          return;
        }
        nextAvatarUrl = upload.data;
        nextAvatarImageKey = upload.imageKey || null;
        if (upload.imageKey) imageWrites.push({ kind: 'avatar', previousBlob: upload.previousBlob || null });
      }
      if (coverFile) {
        const upload = await supabaseService.uploadProfileImage(currentUser.id, coverFile, 'cover');
        if (!upload.data) {
          await rollbackImages();
          setErrorMsg(upload.error || 'อัปโหลดภาพปกไม่สำเร็จ');
          return;
        }
        nextCoverUrl = upload.data;
        nextCoverImageKey = upload.imageKey || null;
        if (upload.imageKey) imageWrites.push({ kind: 'cover', previousBlob: upload.previousBlob || null });
      }
      for (const [kind, imageKey] of [['avatar', nextAvatarImageKey], ['cover', nextCoverImageKey]] as const) {
        const previousKey = kind === 'avatar' ? currentUser.avatarImageKey : currentUser.coverImageKey;
        if (!imageKey && previousKey) {
          const previousBlob = await getQaProfileImage({ ownerId: currentUser.id, kind });
          imageWrites.push({ kind, previousBlob });
          await deleteQaProfileImage({ ownerId: currentUser.id, kind });
        }
      }

      const result = await updateProfile({
        displayName: displayName.trim() || 'Creator',
        username: cleanUsername,
        bio: bio.trim(),
        avatarUrl: nextAvatarUrl,
        coverUrl: nextCoverUrl,
        avatarImageKey: nextAvatarImageKey,
        coverImageKey: nextCoverImageKey,
        socialLinks: socialLinks.map((link, index) => ({
          ...link,
          label: link.label.trim(),
          url: link.url.trim(),
          sortOrder: index
        }))
      });
      if (!result.success) {
        await rollbackImages();
        setErrorMsg(result.error || 'บันทึกโปรไฟล์ไม่สำเร็จ');
        return;
      }
      if (!result.user) {
        await rollbackImages();
        setErrorMsg('บันทึกโปรไฟล์สำเร็จแต่ไม่สามารถอ่านข้อมูลที่อัปเดตได้ กรุณาลองใหม่');
        return;
      }
      if (avatarFile) commitTemporaryPreview('avatar', nextAvatarUrl);
      if (coverFile) commitTemporaryPreview('cover', nextCoverUrl);
      onSaved?.(result.user);
      onClose();
    } catch (error: unknown) {
      // Restore any newly written QA blobs if metadata persistence fails.
      // The previous Profile and its canonical identity remain untouched.
      await rollbackImages();
      setErrorMsg(getErrorMessage(error) || 'บันทึกโปรไฟล์ไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="cv-modal-backdrop fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200" role="presentation">
      <div className="cv-modal-panel cv-profile-edit-modal relative flex max-h-[92vh] w-full max-w-2xl flex-col animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <div className="cv-modal-heading flex items-center justify-between p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="cv-modal-icon"><User className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 id="profile-edit-title" className="text-sm font-bold text-slate-800 dark:text-white">แก้ไขข้อมูลโปรไฟล์</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">ข้อมูลตัวตนที่แสดงบนโปรไฟล์</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="cv-modal-close" aria-label="ปิดหน้าต่างแก้ไขโปรไฟล์"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <div className="cv-profile-media-editor grid gap-5 md:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="cv-profile-media-heading" aria-hidden="true"><strong>Profile Media</strong><span>รูปโปรไฟล์และภาพปก</span></div>
            <ProfileAvatarPicker
              avatarUrl={avatarUrl}
              fileInputRef={fileInputRef}
              fallbackLabel={displayName || 'C'}
              onAvatarChange={url => { setAvatarRemovalRequested(false); setTemporaryPreview('avatar', url); }}
              onAvatarFileChange={setAvatarFile}
              onAvatarRemove={() => { revokeTemporaryPreview('avatar'); setAvatarUrl(''); setAvatarFile(null); setAvatarRemovalRequested(true); }}
              hasStoredImage={Boolean(currentUser?.avatarImageKey)}
              onValidationError={setErrorMsg}
            />
            <div className="cv-profile-cover-controls space-y-3">
              <div className="cv-profile-cover-editor">
                {coverUrl ? <img src={coverUrl} alt="ตัวอย่างภาพปก" referrerPolicy="no-referrer" /> : <span>ภาพปกโปรไฟล์</span>}
              </div>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleCoverUpload} className="hidden" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => coverInputRef.current?.click()} className="cv-profile-media-button"><ImageIcon className="h-3.5 w-3.5" />อัปโหลดภาพปก</button>
                {(coverUrl || currentUser.coverImageKey) && <button type="button" onClick={() => { revokeTemporaryPreview('cover'); setCoverUrl(''); setCoverFile(null); setCoverRemovalRequested(true); }} className="cv-profile-media-button is-danger"><Trash2 className="h-3.5 w-3.5" />ลบภาพปก</button>}
              </div>
              <p className="text-[10px] text-slate-400">JPG, PNG, WEBP หรือ GIF · ขนาดไม่เกิน 5MB</p>
            </div>
          </div>

          <div className="cv-profile-details-fields grid gap-4 md:grid-cols-2">
            <ProfileFields
              displayName={displayName}
              bio={bio}
              onDisplayNameChange={setDisplayName}
              onBioChange={setBio}
            />
            <div className="space-y-1">
              <label htmlFor="profile-username" className="block text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ใช้ (Username)</label>
              <input id="profile-username" type="text" value={username} onChange={event => setUsername(event.target.value)} placeholder="เช่น creator_name" autoCapitalize="none" className="w-full rounded-xl border border-purple-100 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              <p className="text-[10px] text-slate-400">ใช้เป็นลิงก์โปรไฟล์ เช่น /@ชื่อผู้ใช้</p>
            </div>
          </div>

          <fieldset className="cv-profile-social-editor">
            <legend><Link2 className="h-3.5 w-3.5" />ลิงก์โซเชียลของ Creator</legend>
            <p className="cv-profile-social-help">ลิงก์เหล่านี้แยกจาก Links Widget และเลือกแสดงต่อผู้เยี่ยมชมได้ทีละรายการ</p>
            <div className="space-y-2">
              {socialLinks.map((link, index) => (
                <div key={`${link.platform}-${index}`} className="cv-profile-social-row">
                  <label className="sr-only" htmlFor={`social-label-${index}`}>ชื่อช่องทาง</label>
                  <input id={`social-label-${index}`} value={link.label} onChange={event => updateSocialLink(index, { label: event.target.value })} placeholder="ชื่อช่องทาง" aria-label="ชื่อช่องทาง" />
                  <label className="cv-profile-social-url-field relative min-w-0 flex-1">
                    <Link2 className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <span className="sr-only">URL</span>
                    <input value={link.url} onChange={event => updateSocialLink(index, { url: event.target.value })} placeholder="https://..." aria-label={`ลิงก์ ${link.label || 'ช่องทาง'}`} className="cv-profile-social-url-input w-full pl-8" />
                  </label>
                  <label className="cv-profile-social-visible"><input type="checkbox" checked={link.visible} onChange={event => updateSocialLink(index, { visible: event.target.checked })} />แสดง</label>
                </div>
              ))}
            </div>
          </fieldset>

          {errorMsg && <div className="cv-profile-form-error" role="alert"><AlertCircle className="h-4 w-4 shrink-0" /><span>{errorMsg}</span></div>}

          <div className="cv-modal-footer -mx-4 -mb-4 flex items-center justify-end gap-2 border-t px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">ยกเลิก</button>
            <button type="submit" disabled={isSaving} className="cv-create-button inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-3.5 w-3.5" />{isSaving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
