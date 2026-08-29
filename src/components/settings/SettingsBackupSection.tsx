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
  <div className="p-6 space-y-5 text-xs">
    {message && <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>{message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{message.text}</span></div>}
    <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-2xl space-y-2"><div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold"><HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" /><span>ส่งออกข้อมูลคลังผลงานส่วนตัวของฉัน (JSON Backup)</span></div><p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">ดาวน์โหลดไฟล์ JSON สำรองข้อมูลผลงานทั้งหมดของคุณ ทั้งโปรไฟล์บอท, สคริปต์ Prompts, โค้ดตกแต่ง UI, โฟลเดอร์, และเวอร์ชันประวัติ เพื่อเก็บไว้อย่างปลอดภัยบนเครื่องของคุณ</p></div>
    <div className="space-y-3"><button type="button" onClick={onExport} disabled={isExporting} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-2xl font-bold shadow-md shadow-purple-200 dark:shadow-purple-950 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"><Download className="w-4 h-4" /><span>{isExporting ? 'กำลังรวบรวมข้อมูล...' : 'ส่งออกข้อมูลคลังผลงานส่วนตัวของฉัน (JSON Backup)'}</span></button></div>
    {(legacySummary.assets > 0 || legacySummary.folders > 0) && <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl space-y-3"><div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200"><Upload className="w-4 h-4" /><span>พบข้อมูล Guest เก่าในเบราว์เซอร์นี้</span></div><p className="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">พบ {legacySummary.assets} ผลงาน และ {legacySummary.folders} โฟลเดอร์ คุณเลือกนำเข้าเข้าบัญชีนี้ได้ โดยผลงานจะเริ่มเป็นฉบับร่างส่วนตัว และข้อมูลต้นฉบับในเครื่องจะไม่ถูกลบ</p><button type="button" onClick={onImportLegacy} disabled={isImportingLegacy} className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Upload className="w-4 h-4" /><span>{isImportingLegacy ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล Guest เก่า'}</span></button></div>}
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">💡 <strong>เคล็ดลับ:</strong> เก็บไฟล์ JSON ไว้ในพื้นที่ส่วนตัว เพราะอาจมีเนื้อหาและข้อมูลบัญชีของคุณ</div>
  </div>
);
