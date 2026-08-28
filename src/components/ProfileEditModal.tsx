import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, User, Camera, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80'
];

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    try {
      const result = await updateProfile({
        displayName: displayName.trim() || 'Creator',
        bio: bio.trim(),
        avatarUrl
      });
      if (result.success) {
        onClose();
      } else {
        setErrorMsg(result.error || 'บันทึกโปรไฟล์ไม่สำเร็จ');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'บันทึกโปรไฟล์ไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-100 dark:border-slate-800 bg-gradient-to-r from-purple-50 via-pink-50 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-white">
              แก้ไขโปรไฟล์ผู้สร้าง (Edit Profile)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-100 dark:ring-purple-900 shadow-md"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 px-3 py-1 rounded-full transition-colors flex items-center gap-1 border border-purple-100 dark:border-purple-900"
            >
              <Upload className="w-3 h-3" />
              <span>อัปโหลดรูปจากเครื่อง</span>
            </button>

            {/* Quick Avatar Presets */}
            <div className="pt-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block text-center mb-1">หรือเลือกภาพสำเร็จรูป:</span>
              <div className="flex items-center gap-1.5 justify-center">
                {PRESET_AVATARS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(av)}
                    className={`w-7 h-7 rounded-full overflow-hidden transition-transform ${
                      avatarUrl === av ? 'ring-2 ring-purple-600 dark:ring-purple-400 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={av} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              ชื่อแสดง (Display Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น: MochiWriterr 🌸"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 text-slate-800 dark:text-slate-100 font-medium"
              required
            />
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              ประวัติแนะนำตัว (Bio)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="บอกเล่าสไตล์การแต่งนิยาย หรือแนวบอทที่คุณชื่นชอบ..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 text-slate-700 dark:text-slate-300"
            />
          </div>

          {/* Footer */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-3 border-t border-purple-50 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-purple-200 dark:shadow-purple-950 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};
