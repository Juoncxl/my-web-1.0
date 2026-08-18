import React from 'react';
import { X, Sparkles, ShieldAlert, UserPlus, LogIn, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

interface GuestLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const GuestLimitModal: React.FC<GuestLimitModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-pink-200 dark:border-purple-900/60 overflow-hidden text-center p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cute Floating Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-400 via-purple-500 to-indigo-500 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-pink-200 dark:shadow-purple-950/50 mb-4 animate-bounce-short">
          🌸
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 mb-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>โหมด Guest สร้างครบ 2 ชิ้นแล้ว</span>
        </div>

        <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white mt-1">
          สมัครสมาชิกหรือเข้าสู่ระบบเพื่อสร้างต่อได้ไม่จำกัด! ✨
        </h3>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          ผู้ใช้งานแบบ Guest ได้รับสิทธิ์ทดลองสร้างผลงาน 2 ชิ้น เพื่อป้องกัน Spam เพียงเข้าสู่ระบบหรือลงทะเบียนฟรี คุณจะได้รับสิทธิประโยชน์มากมายทันที:
        </p>

        {/* Perks Checklist */}
        <div className="mt-4 p-3.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>สร้าง Character, Prompt, และ UI Code ได้<strong>ไม่จำกัด</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>สร้าง <strong>Custom Folders</strong> จัดหมวดหมู่ใน Dashboard ส่วนตัว</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>อัปโหลดรูปภาพ Gallery Preview ได้ถึง <strong>5 รูปต่อผลงาน</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>บันทึกและซิงก์ข้อมูลบนคลาวด์ปลอดภัยด้วย Supabase RLS</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenAuth();
            }}
            className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-purple-200 dark:shadow-purple-950 transition-transform active:scale-98 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>เข้าสู่ระบบ / สมัครสมาชิกฟรี</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold text-xs transition-colors"
          >
            ไว้คราวหลัง
          </button>
        </div>

      </div>

    </div>
  );
};
