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
  <form onSubmit={onSubmit} className="cv-settings-form">
    {message && (
      <div className={`cv-settings-message ${message.type === 'success' ? 'is-success' : 'is-error'}`}>
        {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
        <span>{message.text}</span>
      </div>
    )}
    <section className="cv-settings-card cv-settings-avatar-card">
      <div className="cv-settings-card-heading"><div><h3>รูปโปรไฟล์ผู้สร้าง (Avatar)</h3><p>เลือกภาพที่เป็นตัวแทนของพื้นที่สร้างสรรค์ของคุณ</p></div><span className="cv-settings-card-kicker">PROFILE</span></div>
      <div className="cv-settings-avatar-row">
        <div className="cv-settings-avatar-preview"><img src={avatarUrl} alt="Avatar Preview" /></div>
        <div className="cv-settings-avatar-tools">
          <div className="cv-settings-preset-list" aria-label="เลือกรูปโปรไฟล์สำเร็จรูป">
            {PRESET_AVATARS.map((url, idx) => (
              <button key={idx} type="button" onClick={() => onAvatarChange(url)} className={`cv-settings-preset${avatarUrl === url ? ' is-selected' : ''}`} aria-label={`เลือกรูปโปรไฟล์ตัวเลือกที่ ${idx + 1}`}>
                <img src={url} alt="" />
              </button>
            ))}
          </div>
          <label className="cv-settings-upload-button">
            <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /><span>อัปโหลดรูปจากเครื่อง</span>
            <input type="file" accept="image/*" onChange={onAvatarUpload} className="hidden" />
          </label>
        </div>
      </div>
    </section>
    <div className="cv-settings-field"><label htmlFor="settings-display-name">ชื่อผู้แสดงผลงาน (Display Name) <span className="cv-settings-required">*</span></label><input id="settings-display-name" type="text" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)} placeholder="เช่น: 🌸 พลอยใส นักสร้างบอท" className="cv-settings-input" required /></div>
    <div className="cv-settings-field"><label htmlFor="settings-email">อีเมลที่เชื่อมต่อ (Email / Auth UID)</label><input id="settings-email" type="text" value={email} disabled className="cv-settings-input" /></div>
    <div className="cv-settings-field"><label htmlFor="settings-bio">คำแนะนำตัว (Bio)</label><textarea id="settings-bio" rows={2} value={bio} onChange={(e) => onBioChange(e.target.value)} placeholder="แนะนำตัวสั้นๆ สไตล์งานเขียน หรือบอทที่คุณสร้าง..." className="cv-settings-input cv-settings-textarea" /></div>
    <button type="submit" disabled={isSaving} className="cv-settings-primary-button"><Check className="w-4 h-4" /><span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลงโปรไฟล์'}</span></button>
  </form>
);
