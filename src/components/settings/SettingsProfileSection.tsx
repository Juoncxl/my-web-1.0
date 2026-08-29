import React from 'react';
import { AlertCircle, Camera, Check } from 'lucide-react';
import type { SettingsMessage } from './SettingsTypes';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
];

interface SettingsProfileSectionProps {
  displayName: string;
  bio: string;
  avatarUrl: string;
  email: string;
  message: SettingsMessage | null;
  isSaving: boolean;
  onDisplayNameChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const SettingsProfileSection: React.FC<SettingsProfileSectionProps> = ({
  displayName, bio, avatarUrl, email, message, isSaving,
  onDisplayNameChange, onBioChange, onAvatarChange, onAvatarUpload, onSubmit
}) => (
  <form onSubmit={onSubmit} className="p-6 space-y-4">
    {message && (
      <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>
        {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
        <span>{message.text}</span>
      </div>
    )}
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">รูปโปรไฟล์ผู้สร้าง (Avatar)</label>
      <div className="flex items-center gap-4">
        <div className="relative"><img src={avatarUrl} alt="Avatar Preview" className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-300 dark:ring-purple-700 shadow-md" /></div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {PRESET_AVATARS.map((url, idx) => (
              <button key={idx} type="button" onClick={() => onAvatarChange(url)} className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${avatarUrl === url ? 'border-purple-600 ring-2 ring-purple-300' : 'border-transparent'}`}>
                <img src={url} alt="preset" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
            <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /><span>อัปโหลดรูปจากเครื่อง</span>
            <input type="file" accept="image/*" onChange={onAvatarUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
    <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อผู้แสดงผลงาน (Display Name) <span className="text-rose-500">*</span></label><input type="text" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)} placeholder="เช่น: 🌸 พลอยใส นักสร้างบอท" className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100" required /></div>
    <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">อีเมลที่เชื่อมต่อ (Email / Auth UID)</label><input type="text" value={email} disabled className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed" /></div>
    <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">คำแนะนำตัว (Bio)</label><textarea rows={2} value={bio} onChange={(e) => onBioChange(e.target.value)} placeholder="แนะนำตัวสั้นๆ สไตล์งานเขียน หรือบอทที่คุณสร้าง..." className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100 resize-none" /></div>
    <button type="submit" disabled={isSaving} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><Check className="w-4 h-4" /><span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลงโปรไฟล์'}</span></button>
  </form>
);
