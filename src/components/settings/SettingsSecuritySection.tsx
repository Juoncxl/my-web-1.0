import React from 'react';
import { AlertCircle, Check, KeyRound } from 'lucide-react';
import type { SettingsMessage } from './SettingsTypes';

interface SettingsSecuritySectionProps {
  provider?: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  message: SettingsMessage | null;
  isSaving: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const SettingsSecuritySection: React.FC<SettingsSecuritySectionProps> = ({ provider, currentPassword, newPassword, confirmPassword, message, isSaving, onCurrentPasswordChange, onNewPasswordChange, onConfirmPasswordChange, onSubmit }) => (
  <form onSubmit={onSubmit} className="p-6 space-y-4">
    {message && <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>{message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{message.text}</span></div>}
    {provider !== 'email' ? <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-2"><p className="font-bold">บัญชีนี้เข้าสู่ระบบผ่านผู้ให้บริการภายนอก</p><p>กรุณาจัดการรหัสผ่านผ่านผู้ให้บริการบัญชีของคุณ</p></div> : <>
      <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">รหัสผ่านปัจจุบัน (Current Password)</label><input type="password" value={currentPassword} onChange={(e) => onCurrentPasswordChange(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100" /></div>
      <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">รหัสผ่านใหม่ (New Password) <span className="text-rose-500">* (อย่างน้อย 6 ตัวอักษร)</span></label><input type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100" required /></div>
      <div className="space-y-1"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">ยืนยันรหัสผ่านใหม่ (Confirm New Password) <span className="text-rose-500">*</span></label><input type="password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-slate-100" required /></div>
      <button type="submit" disabled={isSaving} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><KeyRound className="w-4 h-4" /><span>{isSaving ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'อัปเดตรหัสผ่านใหม่'}</span></button>
    </>}
  </form>
);
