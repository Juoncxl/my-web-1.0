import React, { useState } from 'react';
import { X, Flag, AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { REPORT_REASONS } from '../lib/constants';
import { supabaseService } from '../lib/supabaseService';
import { useAuth } from '../context/AuthContext';
import { Asset } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, asset }) => {
  const { currentUser } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASONS[0].id);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  const closeAndReset = () => {
    setSubmitError(null);
    setIsSubmitted(false);
    setDetails('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setSubmitError('กรุณาเข้าสู่ระบบก่อนส่งรายงาน');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await supabaseService.submitReport({
        assetId: asset.id,
        reporterId: currentUser.id,
        reporterName: currentUser.displayName,
        reason: selectedReason,
        details: details.trim()
      });
      if (!result.success) {
        setSubmitError(result.error || 'ส่งรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setIsSubmitted(true);
      setTimeout(() => {
        closeAndReset();
      }, 1600);
    } catch (err) {
      console.error('Report error:', err);
      setSubmitError('ส่งรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-rose-50 dark:border-slate-800 bg-rose-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                รายงานผลงานนี้ (Report Content)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {asset.title}
              </p>
            </div>
          </div>

          <button
            onClick={closeAndReset}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {isSubmitted ? (
          <div className="p-8 text-center space-y-3 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-in zoom-in">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              ส่งรายงานเรียบร้อยแล้ว
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              รายงานถูกจัดเก็บอย่างเป็นส่วนตัวแล้ว และผู้ใช้งานทั่วไปไม่สามารถเปิดอ่านข้อมูลรายงานได้
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                รายงานจะถูกจัดเก็บแบบส่วนตัวสำหรับระบบผู้ดูแลที่จะเชื่อมต่อในภายหลัง ข้อมูลผู้รายงานจะไม่แสดงต่อสาธารณะ
              </p>
            </div>

            {submitError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-2 text-amber-800 dark:text-amber-300" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                สาเหตุในการรายงาน <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map(r => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      selectedReason === r.id
                        ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.id}
                      checked={selectedReason === r.id}
                      onChange={() => setSelectedReason(r.id)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-medium">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="ระบุข้อมูลเพิ่มเติม เช่น ลิงก์ต้นฉบับ หรือจุดที่ต้องการให้ตรวจสอบ..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-rose-400 text-slate-800 dark:text-slate-100 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeAndReset}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md shadow-rose-200 dark:shadow-rose-950/40 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'กำลังส่ง...' : 'ยืนยันรายงาน'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
