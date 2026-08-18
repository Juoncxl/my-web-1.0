import React, { useState } from 'react';
import { X, Mail, Lock, User, Sparkles, LogIn, UserCheck, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithEmail, loginAsGuest } = useAuth();

  const [tab, setTab] = useState<'email' | 'guest'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('นักเขียนนิรนาม 🌸');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const ok = await loginWithEmail(email, password, name);
      if (ok) {
        onClose();
      } else {
        setError('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
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
      setError(err.message || 'เข้าสู่ระบบ Guest ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-purple-50 bg-gradient-to-r from-purple-50/70 via-pink-50/50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center text-xl shadow-sm">
              🌸
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                เข้าสู่ระบบ Creator Vault
              </h2>
              <p className="text-xs text-slate-500">
                คลังผลงานสำหรับนักสร้างแชทบอท & นักเขียน
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'email'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                : 'bg-purple-50/70 text-slate-600 hover:bg-purple-100/70'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>อีเมล & รหัสผ่าน</span>
          </button>

          <button
            onClick={() => setTab('guest')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'guest'
                ? 'bg-pink-500 text-white shadow-sm shadow-pink-200'
                : 'bg-pink-50/70 text-slate-600 hover:bg-pink-100/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>เข้าใช้ทันที (Guest)</span>
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 pt-4">
          
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          {tab === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  ชื่อแสดงของคุณ (Display Name)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น: MochiWriterr 🌸"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-purple-100 rounded-xl text-xs focus:ring-2 focus:ring-purple-300 focus:bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  อีเมล (Email) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-purple-100 rounded-xl text-xs focus:ring-2 focus:ring-purple-300 focus:bg-white text-slate-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  รหัสผ่าน (Password) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-purple-100 rounded-xl text-xs focus:ring-2 focus:ring-purple-300 focus:bg-white text-slate-800"
                  required
                />
              </div>

              <p className="text-[11px] text-slate-400">
                💡 หากยังไม่มีบัญชี ระบบจะสร้างบัญชีใหม่ให้อัตโนมัติด้วยอีเมลและรหัสผ่านที่คุณระบุ
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 mt-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ / ลงทะเบียน'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleGuestSubmit} className="space-y-4">
              
              <div className="p-4 bg-pink-50/60 rounded-2xl border border-pink-100 text-xs text-pink-900 leading-relaxed">
                🌸 <strong>โหมด Guest (Anonymous)</strong> ช่วยให้คุณสามารถทดลองสร้างผลงาน บันทึก Prompt และทดสอบระบบได้ทันทีโดยไม่ต้องสมัครสมาชิก
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  ตั้งชื่อชั่วคราวสำหรับผลงาน
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="เช่น: นักเขียนนิรนาม 🌸"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-purple-100 rounded-xl text-xs focus:ring-2 focus:ring-purple-300 focus:bg-white text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-200 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>เริ่มใช้งานในโหมด Guest ทันที</span>
              </button>
            </form>
          )}

        </div>

      </div>

    </div>
  );
};
