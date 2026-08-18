import React, { useState } from 'react';
import { X, ShieldCheck, Database, Copy, Check, Lock, Globe, Key, ExternalLink } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../lib/constants';
import { saveCustomSupabaseConfig } from '../lib/supabaseClient';

interface SupabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseInfoModal: React.FC<SupabaseInfoModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('creator_vault_supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('creator_vault_supabase_key') || '');
  const [savedMsg, setSavedMsg] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const result = saveCustomSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    if (result.success) {
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } else {
      setErrorMsg(result.error || 'การตั้งค่าไม่ถูกต้อง');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-emerald-100 dark:border-emerald-950 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-emerald-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-sm shadow-emerald-200 dark:shadow-emerald-950">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Supabase Architecture & Row Level Security (RLS)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                สถาปัตยกรรมฐานข้อมูลและความปลอดภัยตามมาตรฐาน Supabase RLS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          
          {/* Security Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Public Feed (SELECT Policy)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                ผู้ใช้ทุกคนสามารถอ่านและค้นหาผลงานที่เป็น <strong>Public (is_public = true)</strong> ได้อย่างอิสระ
              </p>
            </div>

            <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/40 rounded-2xl border border-rose-100 dark:border-rose-900/50 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-300">
                <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Strict Private Lock (RLS)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                ผลงานที่เป็น <strong>Private (is_public = false)</strong> จะถูกจำกัดสิทธิ์ให้อ่านและแก้ไขได้เฉพาะเจ้าของ (auth.uid = user_id) เท่านั้น
              </p>
            </div>

          </div>

          {/* Connect Custom Supabase Form */}
          <form onSubmit={handleSaveConfig} className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>เชื่อมต่อ Supabase Project ของคุณ (Optional):</span>
              </span>
              {savedMsg && <span className="text-emerald-600 dark:text-emerald-400 font-bold">บันทึกเรียบร้อย!</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
              />
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="anon key"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                ⚠️ {errorMsg}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors"
              >
                บันทึกการเชื่อมต่อ
              </button>
            </div>
          </form>

          {/* SQL Schema Definition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                📄 Supabase SQL Migration Script (ตาราง Assets, Folders, Profiles และ RLS Rules):
              </span>
              <button
                onClick={handleCopySchema}
                className="px-3 py-1 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl font-semibold flex items-center gap-1 border border-purple-100 dark:border-purple-900"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอก SQL แล้ว!' : 'คัดลอก SQL'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-emerald-300 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-56 border border-slate-800 leading-relaxed">
              <code>{SUPABASE_SQL_SCHEMA}</code>
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
};
