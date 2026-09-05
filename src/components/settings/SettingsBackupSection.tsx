import React from 'react';
import { AlertCircle, Check, Download, HardDrive, Upload } from 'lucide-react';
import type { LegacySummary, SettingsMessage } from './SettingsTypes';

interface SettingsBackupSectionProps {
  message: SettingsMessage | null;
  isExporting: boolean;
  isImportingLegacy: boolean;
  legacySummary: LegacySummary;
  onExport: () => void;
  onImportLegacy: () => void;
}

export const SettingsBackupSection: React.FC<SettingsBackupSectionProps> = ({ message, isExporting, isImportingLegacy, legacySummary, onExport, onImportLegacy }) => (
  <div className="cv-settings-form cv-settings-backup-form">
    <div className="cv-settings-form-body">
      {message && <div className={`cv-settings-message ${message.type === 'success' ? 'is-success' : 'is-error'}`}>{message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{message.text}</span></div>}
      <section className="cv-settings-card cv-settings-backup-card"><div className="cv-settings-card-heading"><div><h3><HardDrive className="cv-settings-inline-icon" />ส่งออกข้อมูลคลังผลงานส่วนตัวของฉัน (JSON Backup)</h3><p>ดาวน์โหลดไฟล์ JSON สำรองข้อมูลผลงานทั้งหมดของคุณ ทั้งโปรไฟล์บอท, สคริปต์ Prompts, โค้ดตกแต่ง UI, โฟลเดอร์, และเวอร์ชันประวัติ เพื่อเก็บไว้อย่างปลอดภัยบนเครื่องของคุณ</p></div><span className="cv-settings-card-kicker">PRIVATE</span></div><button type="button" onClick={onExport} disabled={isExporting} className="cv-settings-primary-button cv-settings-backup-button"><Download className="w-4 h-4" /><span>{isExporting ? 'กำลังรวบรวมข้อมูล...' : 'ส่งออกข้อมูลคลังผลงานส่วนตัวของฉัน (JSON Backup)'}</span></button></section>
      {(legacySummary.assets > 0 || legacySummary.folders > 0) && <div className="cv-settings-notice cv-settings-notice-warning"><div className="cv-settings-notice-heading"><Upload className="w-4 h-4" /><p>พบข้อมูล Guest เก่าในเบราว์เซอร์นี้</p></div><span>พบ {legacySummary.assets} ผลงาน และ {legacySummary.folders} โฟลเดอร์ คุณเลือกนำเข้าเข้าบัญชีนี้ได้ โดยผลงานจะเริ่มเป็นฉบับร่างส่วนตัว และข้อมูลต้นฉบับในเครื่องจะไม่ถูกลบ</span><button type="button" onClick={onImportLegacy} disabled={isImportingLegacy} className="cv-settings-notice-button"><Upload className="w-4 h-4" /><span>{isImportingLegacy ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล Guest เก่า'}</span></button></div>}
      <div className="cv-settings-footnote"><strong>เคล็ดลับ:</strong> เก็บไฟล์ JSON ไว้ในพื้นที่ส่วนตัว เพราะอาจมีเนื้อหาและข้อมูลบัญชีของคุณ</div>
    </div>
  </div>
);
