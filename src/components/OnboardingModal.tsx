import React, { useState, useRef } from 'react';
import { Sparkles, Camera, Check, ArrowRight, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
];

export const OnboardingModal: React.FC = () => {
  const { currentUser, updateProfile, isOnboardingOpen, setIsOnboardingOpen } = useAuth();
  
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || PRESET_AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOnboardingOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || 'Creator 🌸',
        bio: bio.trim(),
        avatarUrl
      });
      setIsOnboardingOpen(false);
    } catch (err) {
      console.error('Onboarding profile save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Banner */}
        <div className="p-6 pb-5 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-800 text-white text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ยินดีต้อนรับสู่ CXL Studio</span>
          </div>
          <h2 className="text-xl font-bold">ตั้งค่าโปรไฟล์ผู้สร้าง (Profile Setup)</h2>
          <p className="text-xs text-purple-100 mt-1 max-w-sm mx-auto">
            สร้างตัวตนครีเอเตอร์ของคุณ เพื่อแสดงบนการ์ดผลงานและคลังบอท
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-3xl object-cover ring-4 ring-purple-100 dark:ring-purple-900 shadow-md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-900/40 text-white rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-xs font-bold"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span>เปลี่ยนรูป</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                หรือเลือกรูปแนะนำ:
              </span>
              <div className="flex gap-1.5">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-7 h-7 rounded-xl overflow-hidden border-2 transition-all ${
                      avatarUrl === url
                        ? 'border-purple-600 scale-110 shadow-sm ring-2 ring-purple-300 dark:ring-purple-700'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="Preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              ชื่อแสดงของคุณ (Display Name / Creator Handle) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น: MochiWriterr 🌸 หรือ CyberCreator"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              คำแนะนำตัวสั้นๆ (Bio / Creator Description)
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="เช่น: นักเขียนนิยายแฟนตาซี & คนสร้างบอท Roleplay น่ารักๆ ชอบดื่มชาพีช 🍑"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-purple-200 dark:shadow-purple-950/50 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isSaving ? 'กำลังบันทึกโปรไฟล์...' : 'เริ่มสร้างผลงานใน CXL Studio'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
