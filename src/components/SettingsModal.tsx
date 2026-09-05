import React, { useEffect, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../lib/supabaseService';
import { deleteQaProfileImage, getQaProfileImage, getQaProfileImageUrl, restoreQaProfileImage, isQaObjectUrl, validateQaProfileImage } from '../lib/qaProfileImageStore';
import { SettingsBackupSection } from './settings/SettingsBackupSection';
import { SettingsProfileSection } from './settings/SettingsProfileSection';
import { SettingsSecuritySection } from './settings/SettingsSecuritySection';
import { SettingsTabs } from './settings/SettingsTabs';
import type { LegacySummary, SettingsMessage, SettingsTab } from './settings/SettingsTypes';

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const SettingsModal: React.FC = () => {
  const { currentUser, isSettingsOpen, setIsSettingsOpen, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarImageKey, setAvatarImageKey] = useState<string | null>(currentUser?.avatarImageKey || null);
  const temporaryAvatarPreview = useRef<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<SettingsMessage | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<SettingsMessage | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportingLegacy, setIsImportingLegacy] = useState(false);
  const [legacySummary, setLegacySummary] = useState<LegacySummary>({ assets: 0, folders: 0 });
  const [backupMsg, setBackupMsg] = useState<SettingsMessage | null>(null);

  const revokeTemporaryAvatarPreview = () => {
    const previous = temporaryAvatarPreview.current;
    if (previous && isQaObjectUrl(previous) && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previous);
    temporaryAvatarPreview.current = null;
  };

  useEffect(() => {
    if (isSettingsOpen && currentUser?.id) setLegacySummary(supabaseService.getLegacyGuestDataSummary(currentUser.id));
  }, [currentUser?.id, isSettingsOpen]);

  useEffect(() => {
    if (!currentUser || !isSettingsOpen) return;
    revokeTemporaryAvatarPreview();
    setDisplayName(currentUser.displayName || '');
    setBio(currentUser.bio || '');
    setAvatarUrl(currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    setAvatarImageKey(currentUser.avatarImageKey || null);
    setAvatarFile(null);
  }, [currentUser, isSettingsOpen]);

  useEffect(() => () => {
    revokeTemporaryAvatarPreview();
  }, []);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateQaProfileImage(file);
    if (validationError) { setProfileMsg({ type: 'error', text: validationError }); event.target.value = ''; return; }
    let previewUrl: string;
    try { previewUrl = URL.createObjectURL(file); }
    catch { setProfileMsg({ type: 'error', text: 'ไม่สามารถอ่านไฟล์รูปภาพได้' }); event.target.value = ''; return; }
    revokeTemporaryAvatarPreview();
    temporaryAvatarPreview.current = previewUrl;
    setAvatarFile(file);
    setAvatarImageKey(currentUser?.avatarImageKey || null);
    setAvatarUrl(previewUrl);
    event.target.value = '';
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setIsSavingProfile(true); setProfileMsg(null);
    if (!currentUser) { setIsSavingProfile(false); return; }
    const imageWrites: Array<{ previousBlob: Blob | null }> = [];
    const rollbackImage = async () => {
      await Promise.all(imageWrites.map(write => restoreQaProfileImage({ ownerId: currentUser.id, kind: 'avatar', blob: write.previousBlob }).catch(() => undefined)));
      let restoredUrl: string | null = null;
      try { restoredUrl = await getQaProfileImageUrl({ ownerId: currentUser.id, kind: 'avatar' }); } catch { /* keep the metadata URL fallback */ }
      const fallbackUrl = currentUser.avatarUrl && !isQaObjectUrl(currentUser.avatarUrl) ? currentUser.avatarUrl : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
      setAvatarUrl(restoredUrl || fallbackUrl);
      setAvatarImageKey(currentUser.avatarImageKey || null);
    };
    try {
      let nextAvatarUrl = avatarUrl;
      let nextAvatarImageKey = avatarImageKey;
      if (avatarFile) {
        const upload = await supabaseService.uploadProfileImage(currentUser.id, avatarFile, 'avatar');
        if (!upload.data) { setProfileMsg({ type: 'error', text: upload.error || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ' }); return; }
        nextAvatarUrl = upload.data;
        nextAvatarImageKey = upload.imageKey || null;
        if (upload.imageKey) imageWrites.push({ previousBlob: upload.previousBlob || null });
      } else if (nextAvatarImageKey === null && currentUser.avatarImageKey) {
        const previousBlob = await getQaProfileImage({ ownerId: currentUser.id, kind: 'avatar' });
        imageWrites.push({ previousBlob });
        await deleteQaProfileImage({ ownerId: currentUser.id, kind: 'avatar' });
      }
      const result = await updateProfile({ displayName: displayName.trim() || 'Creator 🌸', bio: bio.trim(), avatarUrl: nextAvatarUrl, avatarImageKey: nextAvatarImageKey });
      if (!result.success) await rollbackImage();
      if (result.success && avatarFile && temporaryAvatarPreview.current === nextAvatarUrl) temporaryAvatarPreview.current = null;
      setProfileMsg(result.success ? { type: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' } : { type: 'error', text: result.error || 'บันทึกโปรไฟล์ไม่สำเร็จ' });
    } catch (error: unknown) { await rollbackImage(); setProfileMsg({ type: 'error', text: errorMessage(error, 'เกิดข้อผิดพลาดในการบันทึก') }); }
    finally { setIsSavingProfile(false); }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordMsg(null);
    if (!newPassword || newPassword.length < 6) { setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' }); return; }
    setIsSavingPassword(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) { setPasswordMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
      else setPasswordMsg({ type: 'error', text: result.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
    } catch (error: unknown) { setPasswordMsg({ type: 'error', text: errorMessage(error, 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน') }); }
    finally { setIsSavingPassword(false); }
  };

  const handleExportFullVault = async () => {
    if (!currentUser?.id) { setBackupMsg({ type: 'error', text: 'กรุณาเข้าสู่ระบบเพื่อสำรองข้อมูลผลงานส่วนตัว' }); return; }
    setIsExporting(true); setBackupMsg(null);
    try {
      const [assetsRes, foldersRes] = await Promise.all([supabaseService.fetchAssets({ userId: currentUser.id, includeDeleted: true }), supabaseService.fetchFolders(currentUser.id)]);
      if (assetsRes.error || foldersRes.error) throw new Error(assetsRes.error || foldersRes.error || 'โหลดข้อมูลสำหรับสำรองไม่สำเร็จ');
      const userAssets = (assetsRes.data || []).filter((asset) => asset.userId === currentUser.id);
      const userFolders = (foldersRes.data || []).filter((folder) => folder.userId === currentUser.id);
      const backupData = { app: 'CXL Studio', version: '2.0.0', exportedAt: new Date().toISOString(), creator: { id: currentUser.id, name: currentUser.displayName, email: currentUser.email }, folders: userFolders, assets: userAssets };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr); downloadAnchor.setAttribute('download', `creator_vault_backup_${currentUser.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
      setBackupMsg({ type: 'success', text: `สำรองข้อมูลสำเร็จ! ดาวน์โหลด ${userAssets.length} ผลงาน และ ${userFolders.length} โฟลเดอร์ของ ${currentUser.displayName || 'คุณ'} เรียบร้อยแล้ว` });
    } catch (error: unknown) { setBackupMsg({ type: 'error', text: errorMessage(error, 'เกิดข้อผิดพลาดในการสำรองข้อมูล') }); }
    finally { setIsExporting(false); }
  };

  const handleImportLegacyGuestData = async () => {
    if (!currentUser) return;
    setIsImportingLegacy(true); setBackupMsg(null);
    try {
      const result = await supabaseService.importLegacyGuestData(currentUser);
      setLegacySummary({ assets: result.remainingAssets, folders: result.remainingFolders });
      if (result.importedAssets > 0 || result.importedFolders > 0) window.dispatchEvent(new Event('creator-vault-cloud-data-changed'));
      setBackupMsg(result.success ? { type: 'success', text: `นำเข้าข้อมูลเก่าสำเร็จ: ${result.importedAssets} ผลงาน และ ${result.importedFolders} โฟลเดอร์ (ผลงานถูกตั้งเป็นฉบับร่างส่วนตัว)` } : { type: 'error', text: result.error || `นำเข้าได้บางส่วน ยังเหลือ ${result.remainingAssets} ผลงาน และ ${result.remainingFolders} โฟลเดอร์` });
    } catch (error: unknown) { setBackupMsg({ type: 'error', text: errorMessage(error, 'นำเข้าข้อมูล Guest เก่าไม่สำเร็จ') }); }
    finally { setIsImportingLegacy(false); }
  };

  if (!isSettingsOpen) return null;
  return <div className="cv-settings-backdrop">
    <div className="cv-settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" data-settings-tab={activeTab}>
      <header className="cv-settings-chrome">
        <div className="cv-settings-heading"><div className="cv-settings-heading-copy"><div className="cv-settings-heading-icon"><Settings2 className="w-5 h-5" /></div><div><h2 id="settings-modal-title">ตั้งค่าบัญชี & การสำรองข้อมูล</h2><p>จัดการโปรไฟล์ ความปลอดภัย และการสำรองข้อมูล</p></div></div><button type="button" onClick={() => setIsSettingsOpen(false)} className="cv-settings-close" aria-label="ปิดหน้าตั้งค่า"><X className="w-4 h-4" /></button></div>
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </header>
      <div className="cv-settings-content">
        {activeTab === 'profile' && <SettingsProfileSection displayName={displayName} username={currentUser?.username} bio={bio} avatarUrl={avatarUrl} email={currentUser?.email || 'บัญชี OAuth'} message={profileMsg} isSaving={isSavingProfile} onDisplayNameChange={setDisplayName} onBioChange={setBio} onAvatarUpload={handleAvatarUpload} onSubmit={handleProfileSubmit} />}
        {activeTab === 'security' && <SettingsSecuritySection provider={currentUser?.provider} currentPassword={currentPassword} newPassword={newPassword} confirmPassword={confirmPassword} message={passwordMsg} isSaving={isSavingPassword} onCurrentPasswordChange={setCurrentPassword} onNewPasswordChange={setNewPassword} onConfirmPasswordChange={setConfirmPassword} onSubmit={handlePasswordSubmit} />}
        {activeTab === 'backup' && <SettingsBackupSection message={backupMsg} isExporting={isExporting} isImportingLegacy={isImportingLegacy} legacySummary={legacySummary} onExport={() => void handleExportFullVault()} onImportLegacy={() => void handleImportLegacyGuestData()} />}
      </div>
    </div>
  </div>;
};
