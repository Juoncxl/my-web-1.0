import React from 'react';
import { AlertCircle, Camera, Check, Lock } from 'lucide-react';
import type { SettingsMessage } from './SettingsTypes';

interface SettingsProfileSectionProps {
  displayName: string;
  username?: string;
  bio: string;
  avatarUrl: string;
  email: string;
  message: SettingsMessage | null;
  isSaving: boolean;
  onDisplayNameChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const SettingsProfileSection: React.FC<SettingsProfileSectionProps> = ({
  displayName, username, bio, avatarUrl, email, message, isSaving,
  onDisplayNameChange, onBioChange, onAvatarUpload, onSubmit
}) => (
  <form onSubmit={onSubmit} className="cv-settings-form cv-settings-profile-form">
    <div className="cv-settings-form-body">
      {message && (
        <div className={`cv-settings-message ${message.type === 'success' ? 'is-success' : 'is-error'}`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}
      <section className="cv-settings-section cv-settings-avatar-section">
        <div className="cv-settings-section-heading"><div><h3>รูปโปรไฟล์</h3><p>รูปนี้จะใช้แสดงแทนตัวคุณบน CXL Studio</p></div></div>
        <div className="cv-settings-avatar-panel">
          <div className="cv-settings-avatar-preview"><img src={avatarUrl} alt="รูปโปรไฟล์ปัจจุบัน" /></div>
          <div className="cv-settings-avatar-identity">
            <div className="cv-settings-avatar-name"><strong>{displayName || 'Creator'}</strong><span>CREATOR</span></div>
            {username && <p>@{username}</p>}
            <label className="cv-settings-upload-button">
              <Camera className="w-4 h-4" /><span>เปลี่ยนรูปโปรไฟล์</span>
              <input type="file" accept="image/*" onChange={onAvatarUpload} className="hidden" />
            </label>
          </div>
        </div>
      </section>
      <section className="cv-settings-section cv-settings-details-section">
        <div className="cv-settings-section-heading"><div><h3>ข้อมูลโปรไฟล์</h3><p>ข้อมูลนี้จะแสดงบนหน้า Creator Profile ของคุณ</p></div></div>
        <div className="cv-settings-field">
          <div className="cv-settings-field-heading"><label htmlFor="settings-display-name">ชื่อผู้แสดงผลงาน (Display Name) <span className="cv-settings-required">*</span></label><span className="cv-settings-field-count" aria-label={`${displayName.length} ตัวอักษร`}>{displayName.length} ตัว</span></div>
          <input id="settings-display-name" type="text" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)} placeholder="เช่น: 🌸 พลอยใส นักสร้างบอท" className="cv-settings-input" required />
        </div>
        <div className="cv-settings-field">
          <label htmlFor="settings-email">อีเมลที่เชื่อมต่อ (Email / Auth UID)</label>
          <div className="cv-settings-input-shell"><input id="settings-email" type="text" value={email} disabled className="cv-settings-input" /><Lock className="cv-settings-input-status" aria-label="ข้อมูลจากบัญชี ใช้สำหรับการเข้าสู่ระบบ" /></div>
        </div>
        <div className="cv-settings-field">
          <div className="cv-settings-field-heading"><label htmlFor="settings-bio">คำแนะนำตัว (Bio)</label><span className="cv-settings-field-help">ข้อความกระชับ อ่านง่าย</span></div>
          <textarea id="settings-bio" rows={3} value={bio} onChange={(e) => onBioChange(e.target.value)} placeholder="แนะนำตัวสั้นๆ สไตล์งานเขียน หรือบอทที่คุณสร้าง..." className="cv-settings-input cv-settings-textarea" />
        </div>
      </section>
    </div>
    <footer className="cv-settings-action-bar"><button type="submit" disabled={isSaving} className="cv-settings-primary-button"><Check className="w-4 h-4" /><span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span></button></footer>
  </form>
);
