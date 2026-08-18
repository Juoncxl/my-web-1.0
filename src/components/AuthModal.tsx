import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Sparkles, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatFriendlyErrorMessage } from '../lib/apiHelper';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    loginWithEmail, 
    signUpWithEmail, 
    loginAsGuest, 
    authDefaultTab 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [guestName, setGuestName] = useState('นักเขียนนิรนาม 🌸');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync mode with authDefaultTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(authDefaultTab || 'login');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, authDefaultTab]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await loginWithEmail(email, password);
      if (res && res.success) {
        onClose();
      } else {
        setError(formatFriendlyErrorMessage(res?.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน'));
      }
    } catch (err: any) {
      setError(formatFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await signUpWithEmail(email, password);
      if (res && res.success) {
        onClose();
      } else {
        setError(formatFriendlyErrorMessage(res?.error || 'การลงทะเบียนไม่สำเร็จ'));
      }
    } catch (err: any) {
      setError(formatFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginAsGuest(guestName.trim() || 'นักเขียนนิรนาม 🌸 (Guest)');
      onClose();
    } catch (err: any) {
      setError(formatFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 transition-colors">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-purple-50 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 via-pink-50/50 to-white dark:from-slate-800/80 dark:via-purple-950/30 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center text-xl shadow-md shadow-purple-500/20">
              🌸
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {mode === 'login' ? 'เข้าสู่ระบบ Creator Vault' : mode === 'signup' ? 'สมัครสมาชิกผู้สร้าง' : 'โหมดทดลองใช้งาน (Guest)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login' ? 'เชื่อมต่อและซิงค์ผลงานของคุณบนทุกอุปกรณ์' : mode === 'signup' ? 'บันทึก Character, Lore & Code ลง Supabase ถาวร' : 'ทดลองสร้างผลงานได้ 2 ชิ้นโดยไม่ต้องสมัคร'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-1.5 bg-slate-50/60 dark:bg-slate-900/60 p-2 m-4 mb-0 rounded-2xl border border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'signup'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>สมัครสมาชิก</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('guest'); setError(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'guest'
                ? 'bg-pink-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guest</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-4">
          
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-600 dark:text-emerald-300 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Mode 1: Log In (Email & Password) */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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
                    onClick={() => { setMode('signup'); setError(''); }}
                    className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    สมัครสมาชิกที่นี่
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Mode 2: Sign Up (Email & Password) */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  อีเมล (Email) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    onClick={() => { setMode('login'); setError(''); }}
                    className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    เข้าสู่ระบบที่นี่
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Mode 3: Guest */}
          {mode === 'guest' && (
            <form onSubmit={handleGuestSubmit} className="space-y-4">
              <div className="p-4 bg-pink-50/80 dark:bg-pink-950/40 rounded-2xl border border-pink-100 dark:border-pink-900/60 text-xs text-pink-900 dark:text-pink-200 leading-relaxed">
                🌸 <strong>โหมด Guest (Anonymous)</strong> ช่วยให้คุณสามารถทดลองสร้าง Character Card, บันทึก Prompt และทดลองใช้ AI Assistant ได้ทันที (จำกัดผลงาน 2 ชิ้นในเซสชันชั่วคราว)
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ตั้งชื่อชั่วคราวสำหรับผลงาน
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="เช่น: นักเขียนนิรนาม 🌸"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-200 dark:shadow-pink-950/50 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>เริ่มใช้งานในโหมด Guest ทันที</span>
              </button>
            </form>
          )}

        </div>

      </div>

    </div>
  );
};
