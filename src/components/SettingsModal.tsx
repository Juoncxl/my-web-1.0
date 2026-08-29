import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../lib/supabaseService';
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

  useEffect(() => {
    if (isSettingsOpen && currentUser?.id) setLegacySummary(supabaseService.getLegacyGuestDataSummary(currentUser.id));
  }, [currentUser?.id, isSettingsOpen]);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setAvatarUrl(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setIsSavingProfile(true); setProfileMsg(null);
    try {
      const result = await updateProfile({ displayName: displayName.trim() || 'Creator 🌸', bio: bio.trim(), avatarUrl });
      setProfileMsg(result.success ? { type: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' } : { type: 'error', text: result.error || 'บันทึกโปรไฟล์ไม่สำเร็จ' });
    } catch (error: unknown) { setProfileMsg({ type: 'error', text: errorMessage(error, 'เกิดข้อผิดพลาดในการบันทึก') }); }
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
      const backupData = { app: 'Creator Vault', version: '2.0.0', exportedAt: new Date().toISOString(), creator: { id: currentUser.id, name: currentUser.displayName, email: currentUser.email }, folders: userFolders, assets: userAssets };
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
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
      <div className="p-6 pb-4 border-b border-purple-50 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 via-pink-50/50 to-white dark:from-slate-800/80 dark:via-purple-950/30 dark:to-slate-900 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-purple-600 dark:bg-purple-700 text-white flex items-center justify-center text-lg shadow-md shadow-purple-500/20">⚙️</div><div><h2 className="text-base font-bold text-slate-800 dark:text-slate-100">ตั้งค่าบัญชี & การสำรองข้อมูล (Settings)</h2><p className="text-xs text-slate-500 dark:text-slate-400">จัดการโปรไฟล์, ความปลอดภัย และสำรองข้อมูลคลังผลงาน</p></div></div><button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-4 h-4" /></button></div>
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' && <SettingsProfileSection displayName={displayName} bio={bio} avatarUrl={avatarUrl} email={currentUser?.email || 'บัญชี OAuth'} message={profileMsg} isSaving={isSavingProfile} onDisplayNameChange={setDisplayName} onBioChange={setBio} onAvatarChange={setAvatarUrl} onAvatarUpload={handleAvatarUpload} onSubmit={handleProfileSubmit} />}
        {activeTab === 'security' && <SettingsSecuritySection provider={currentUser?.provider} currentPassword={currentPassword} newPassword={newPassword} confirmPassword={confirmPassword} message={passwordMsg} isSaving={isSavingPassword} onCurrentPasswordChange={setCurrentPassword} onNewPasswordChange={setNewPassword} onConfirmPasswordChange={setConfirmPassword} onSubmit={handlePasswordSubmit} />}
        {activeTab === 'backup' && <SettingsBackupSection message={backupMsg} isExporting={isExporting} isImportingLegacy={isImportingLegacy} legacySummary={legacySummary} onExport={() => void handleExportFullVault()} onImportLegacy={() => void handleImportLegacyGuestData()} />}
      </div>
    </div>
  </div>;
};
