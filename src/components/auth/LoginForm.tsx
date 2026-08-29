import React from 'react';
import { Lock, LogIn, Mail } from 'lucide-react';

interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSwitchToSignup: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitchToSignup
}) => (
  <form onSubmit={onSubmit} className="space-y-3.5">
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        อีเมล (Email)
      </label>
      <div className="relative">
        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="name@example.com"
          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          required
        />
      </div>
    </div>

    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        รหัสผ่าน (Password)
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="••••••••"
          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          required
        />
      </div>
    </div>

    <button
      type="submit"
      disabled={isLoading}
      className="w-full py-2.5 mt-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
    >
      <LogIn className="w-4 h-4" />
      <span>{isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ (Log In)'}</span>
    </button>

    <div className="text-center pt-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ยังไม่มีบัญชีสมาชิกใช่ไหม?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
        >
          สมัครสมาชิกที่นี่
        </button>
      </p>
    </div>
  </form>
);
