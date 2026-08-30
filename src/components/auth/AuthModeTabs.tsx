import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';

export type AuthMode = 'login' | 'signup';

interface AuthModeTabsProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

export const AuthModeTabs: React.FC<AuthModeTabsProps> = ({ mode, onModeChange }) => (
  <div className="px-6 pt-4 grid grid-cols-2 gap-1.5 bg-slate-50/60 dark:bg-slate-900/60 p-2 m-4 mb-0 rounded-2xl border border-slate-100 dark:border-slate-800">
    <button
      type="button"
      onClick={() => onModeChange('login')}
      className={`cv-auth-tab py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'login' ? 'is-active' : ''}`}
    >
      <LogIn className="w-3.5 h-3.5" />
      <span>เข้าสู่ระบบ</span>
    </button>

    <button
      type="button"
      onClick={() => onModeChange('signup')}
      className={`cv-auth-tab py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'signup' ? 'is-active' : ''}`}
    >
      <UserPlus className="w-3.5 h-3.5" />
      <span>สมัครสมาชิก</span>
    </button>
  </div>
);
