import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatFriendlyErrorMessage } from '../lib/apiHelper';
import { AuthFeedback } from './auth/AuthFeedback';
import { AuthMode, AuthModeTabs } from './auth/AuthModeTabs';
import { LoginForm } from './auth/LoginForm';
import { SignupForm } from './auth/SignupForm';

const brandMarkUrl = new URL('../assets/brand/brand-mark.svg', import.meta.url).href;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithEmail, signUpWithEmail, authDefaultTab } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await loginWithEmail(email, password);
      if (result.success) {
        onClose();
      } else {
        setError(formatFriendlyErrorMessage(result.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน'));
      }
    } catch (error: unknown) {
      setError(formatFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      const result = await signUpWithEmail(email, password);
      if (result.success) {
        if (result.requiresEmailConfirmation) {
          setSuccessMsg(result.message || 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        } else {
          onClose();
        }
      } else {
        setError(formatFriendlyErrorMessage(result.error || 'การลงทะเบียนไม่สำเร็จ'));
      }
    } catch (error: unknown) {
      setError(formatFriendlyErrorMessage(error));
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
            <div className="cv-brand-mark w-10 h-10 rounded-2xl text-white flex items-center justify-center">
              <img src={brandMarkUrl} alt="" aria-hidden="true" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี CXL Studio'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login' ? 'กลับมาจัดการคลังผลงานของคุณ' : 'เก็บและจัดการผลงานของคุณไว้ในที่เดียว'}
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

        <AuthModeTabs mode={mode} onModeChange={handleModeChange} />

        {/* Form Body */}
        <div className="p-6 pt-4">
          <AuthFeedback type="error" message={error} />
          <AuthFeedback type="success" message={successMsg} />

          {mode === 'login' && (
            <LoginForm
              email={email}
              password={password}
              isLoading={isLoading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={handleLoginSubmit}
              onSwitchToSignup={() => handleModeChange('signup')}
            />
          )}

          {mode === 'signup' && (
            <SignupForm
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              isLoading={isLoading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleSignUpSubmit}
              onSwitchToLogin={() => handleModeChange('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
