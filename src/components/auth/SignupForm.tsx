import React from 'react';
import { Lock, Mail, UserPlus } from 'lucide-react';

interface SignupFormProps {
  email: string;
  password: string;
  confirmPassword: string;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSwitchToLogin: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  email,
  password,
  confirmPassword,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchToLogin
}) => (
  <form onSubmit={onSubmit} className="space-y-3.5">
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        อีเมล (Email) <span className="text-rose-500">*</span>
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
        รหัสผ่าน (Password) <span className="text-rose-500">* (อย่างน้อย 6 ตัวอักษร)</span>
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

    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        ยืนยันรหัสผ่าน (Confirm Password) <span className="text-rose-500">*</span>
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="••••••••"
          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          required
        />
      </div>
    </div>

    <button
      type="submit"
      disabled={isLoading}
      className="w-full py-2.5 mt-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950/50 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
    >
      <UserPlus className="w-4 h-4" />
      <span>{isLoading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก & ใช้งาน (Sign Up)'}</span>
    </button>

    <div className="text-center pt-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        มีบัญชีอยู่แล้วใช่ไหม?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
        >
          เข้าสู่ระบบที่นี่
        </button>
      </p>
    </div>
  </form>
);
