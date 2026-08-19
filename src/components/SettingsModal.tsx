import React, { useState, useRef } from 'react';
import { 
  X, 
  User, 
  Lock, 
  Database, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Camera, 
  KeyRound, 
  Sparkles, 
  Download, 
  Upload, 
  FileJson, 
  Copy, 
  Code2, 
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_SQL_SCHEMA } from '../lib/constants';
import { supabaseService } from '../lib/supabaseService';
import confetti from 'canvas-confetti';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
];

export const SettingsModal: React.FC = () => {
  const { currentUser, isSettingsOpen, setIsSettingsOpen, updateProfile, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'backup' | 'sql'>('profile');

  // Profile Form State
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || PRESET_AVATARS[0]);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Backup State
  const [isExporting, setIsExporting] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  if (!isSettingsOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      const ok = await updateProfile({
        displayName: displayName.trim() || 'Creator 🌸',
        bio: bio.trim(),
        avatarUrl
      });
      if (ok) {
        setProfileMsg({ type: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' });
      } else {
        setProfileMsg({ type: 'error', text: 'บันทึกโปรไฟล์ไม่สำเร็จ' });
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการบันทึก' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' });
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: res.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Feature 7: Export & Backup Full Vault (1-click JSON backup)
  const handleExportFullVault = async () => {
    setIsExporting(true);
    setBackupMsg(null);

    try {
      const assetsRes = await supabaseService.fetchAssets({ userId: currentUser?.id, includeDeleted: true });
      const foldersRes = await supabaseService.fetchFolders(currentUser?.id || '');
      const userAssets = assetsRes.data || [];
      const userFolders = foldersRes.data || [];

      const backupData = {
        app: 'Creator Vault',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        creator: {
          id: currentUser?.id,
          name: currentUser?.displayName,
          email: currentUser?.email
        },
        folders: userFolders,
        assets: userAssets
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `creator_vault_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.6 }
      });

      setBackupMsg({ type: 'success', text: `สำรองข้อมูลสำเร็จ! ดาวน์โหลด ${userAssets.length} ผลงาน และ ${userFolders.length} โฟลเดอร์เรียบร้อยแล้ว` });
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการสำรองข้อมูล' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-purple-50 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 via-pink-50/50 to-white dark:from-slate-800/80 dark:via-purple-950/30 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 dark:bg-purple-700 text-white flex items-center justify-center text-lg shadow-md shadow-purple-500/20">
              ⚙️
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                ตั้งค่าบัญชี & การสำรองข้อมูล (Settings)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                จัดการโปรไฟล์, ความปลอดภัย, สำรองข้อมูล และสคริปต์ Supabase
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50 gap-2 pt-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>โปรไฟล์</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>รหัสผ่าน</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>สำรองข้อมูล (Backup)</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL Schema</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              {profileMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {profileMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              {/* Avatar Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  รูปโปรไฟล์ผู้สร้าง (Avatar)
                </label>
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={avatarUrl}
                      alt="Avatar Preview"
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-300 dark:ring-purple-700 shadow-md"
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {PRESET_AVATARS.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatarUrl(url)}
                          className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                            avatarUrl === url ? 'border-purple-600 ring-2 ring-purple-300' : 'border-transparent'
                          }`}
                        >
                          <img src={url} alt="preset" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>

                    <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                      <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>อัปโหลดรูปจากเครื่อง</span>
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ชื่อผู้แสดงผลงาน (Display Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น: 🌸 พลอยใส นักสร้างบอท"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Email (Readonly) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  อีเมลที่เชื่อมต่อ (Email / Auth UID)
                </label>
                <input
                  type="text"
                  value={currentUser?.email || `Guest Session (${currentUser?.id})`}
                  disabled
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  คำแนะนำตัว (Bio)
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="แนะนำตัวสั้นๆ สไตล์งานเขียน หรือบอทที่คุณสร้าง..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingProfile ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลงโปรไฟล์'}</span>
              </button>
            </form>
          )}

          {/* Tab 2: Security & Password */}
          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {passwordMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              {currentUser?.isGuest ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <p className="font-bold">⚠️ คุณกำลังอยู่ในโหมด Guest</p>
                  <p>กรุณาสมัครสมาชิกหรือเข้าสู่ระบบด้วยอีเมลเพื่อใช้งานฟังก์ชันความปลอดภัยและการเปลี่ยนรหัสผ่าน</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      รหัสผ่านปัจจุบัน (Current Password)
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      รหัสผ่านใหม่ (New Password) <span className="text-rose-500">* (อย่างน้อย 6 ตัวอักษร)</span>
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      ยืนยันรหัสผ่านใหม่ (Confirm New Password) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isSavingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'อัปเดตรหัสผ่านใหม่'}</span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* Tab 3: Backup & Export (Feature 7) */}
          {activeTab === 'backup' && (
            <div className="p-6 space-y-5 text-xs">
              {backupMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                    backupMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {backupMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{backupMsg.text}</span>
                </div>
              )}

              <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold">
                  <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>สำรองข้อมูลคลังผลงานทั้งระบบ (1-Click Full Backup)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  ดาวน์โหลดไฟล์ JSON สำรองข้อมูลผลงานทั้งหมดของคุณ ทั้งโปรไฟล์บอท, สคริปต์ Prompts, โค้ดตกแต่ง UI, โฟลเดอร์, และเวอร์ชันประวัติ เพื่อเก็บไว้อย่างปลอดภัยบนเครื่องของคุณ
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleExportFullVault}
                  disabled={isExporting}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-2xl font-bold shadow-md shadow-purple-200 dark:shadow-purple-950 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'กำลังรวบรวมข้อมูล...' : 'ส่งออกไฟล์สำรองข้อมูล (.JSON Backup)'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                💡 <strong>เคล็ดลับ:</strong> คุณสามารถนำไฟล์ JSON นี้ไปเปิดดูหรือนำเข้าได้ทุกเมื่อ ปลอดภัย 100%
              </div>
            </div>
          )}

          {/* Tab 4: SQL Migration Schema */}
          {activeTab === 'sql' && (
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">
                    Supabase PostgreSQL SQL Schema & RLS
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    สคริปต์สำหรับรันใน Supabase SQL Editor เพื่อสร้างตารางและการจัดการสิทธิ์
                  </p>
                </div>

                <button
                  onClick={handleCopySqlSchema}
                  className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded-xl font-bold border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1.5 transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'คัดลอกแล้ว!' : 'คัดลอก SQL'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-purple-200 rounded-2xl overflow-x-auto max-h-72 font-mono text-[10.5px] border border-slate-800 leading-relaxed">
                <code>{SUPABASE_SQL_SCHEMA}</code>
              </pre>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
