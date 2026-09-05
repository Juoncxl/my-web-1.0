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
  <form onSubmit={onSubmit} className="cv-settings-form cv-settings-security-form">
    <div className="cv-settings-form-body">
      {message && <div className={`cv-settings-message ${message.type === 'success' ? 'is-success' : 'is-error'}`}>{message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{message.text}</span></div>}
      <div className="cv-settings-section-intro"><div className="cv-settings-section-icon"><KeyRound className="w-4 h-4" /></div><div><h3>ความปลอดภัยของบัญชี</h3><p>อัปเดตรหัสผ่านเพื่อดูแลพื้นที่สร้างสรรค์ของคุณให้ปลอดภัย</p></div></div>
      {provider !== 'email' ? <div className="cv-settings-notice cv-settings-notice-warning"><p>บัญชีนี้เข้าสู่ระบบผ่านผู้ให้บริการภายนอก</p><span>กรุณาจัดการรหัสผ่านผ่านผู้ให้บริการบัญชีของคุณ</span></div> : <>
        <div className="cv-settings-field"><label htmlFor="settings-current-password">รหัสผ่านปัจจุบัน (Current Password)</label><input id="settings-current-password" type="password" value={currentPassword} onChange={(e) => onCurrentPasswordChange(e.target.value)} placeholder="••••••••" className="cv-settings-input" /></div>
        <div className="cv-settings-field"><label htmlFor="settings-new-password">รหัสผ่านใหม่ (New Password) <span className="cv-settings-required">* (อย่างน้อย 6 ตัวอักษร)</span></label><input id="settings-new-password" type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} placeholder="••••••••" className="cv-settings-input" required /></div>
        <div className="cv-settings-field"><label htmlFor="settings-confirm-password">ยืนยันรหัสผ่านใหม่ (Confirm New Password) <span className="cv-settings-required">*</span></label><input id="settings-confirm-password" type="password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} placeholder="••••••••" className="cv-settings-input" required /></div>
      </>}
    </div>
    {provider === 'email' && <footer className="cv-settings-action-bar"><button type="submit" disabled={isSaving} className="cv-settings-primary-button"><KeyRound className="w-4 h-4" /><span>{isSaving ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'อัปเดตรหัสผ่านใหม่'}</span></button></footer>}
  </form>
);
