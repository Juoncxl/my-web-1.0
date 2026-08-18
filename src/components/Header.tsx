import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Sparkles, 
  User as UserIcon, 
  Lock, 
  Globe, 
  LogOut, 
  LogIn, 
  Settings, 
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeView: 'feed' | 'vault';
  onViewChange: (v: 'feed' | 'vault') => void;
  onOpenCreateModal: () => void;
  onOpenAIModal: () => void;
  onOpenAuthModal: () => void;
  onOpenSignUpModal?: () => void;
  onOpenProfileModal: () => void;
  onOpenSettingsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeView,
  onViewChange,
  onOpenCreateModal,
  onOpenAIModal,
  onOpenAuthModal,
  onOpenSignUpModal,
  onOpenProfileModal,
  onOpenSettingsModal
}) => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userAvatar = currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  const displayName = currentUser?.displayName || (currentUser?.isGuest ? 'นักเขียนนิรนาม 🌸 (Guest)' : 'Creator');
  const userEmail = currentUser?.email || (currentUser?.isGuest ? 'โหมดทดลองใช้งาน (Guest)' : '');

  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-purple-100/70 dark:border-purple-950/70 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => onViewChange('feed')}
              className="flex items-center gap-2 text-left group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-400 to-amber-300 flex items-center justify-center text-white shadow-sm shadow-purple-200 dark:shadow-purple-950 group-hover:shadow-md transition-shadow">
                <span className="text-xl">🌸</span>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-600 dark:from-purple-300 dark:via-pink-300 dark:to-indigo-300 bg-clip-text text-transparent">
                    Creator Vault
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                    THAI HUB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5">
                  คลังความรู้ & แอสเซทคนสร้างบอท
                </p>
              </div>
            </button>
          </div>

          {/* Center Search Bar */}
          <div className="flex-1 max-w-md mx-2">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-600 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ค้นหาตัวละคร, คำสั่ง Prompt, UI Code, Lore..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white/90 dark:bg-slate-800/90 border border-purple-100/90 dark:border-purple-900/60 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300/60 focus:border-purple-300 transition-all placeholder:text-slate-400 text-slate-700 dark:text-slate-200 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* View Switcher: Public Feed vs My Vault */}
            <div className="hidden md:flex items-center bg-purple-50/80 dark:bg-slate-800/80 p-1 rounded-full border border-purple-100 dark:border-purple-900/60">
              <button
                onClick={() => onViewChange('feed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'feed'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-purple-500" />
                <span>ฟีดสาธารณะ</span>
              </button>
              <button
                onClick={() => onViewChange('vault')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'vault'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-pink-500" />
                <span>คลังของฉัน</span>
              </button>
            </div>

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
              className="p-2 rounded-full bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all hover:scale-105 shadow-xs cursor-pointer"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* AI Assistant Button */}
            <button
              onClick={onOpenAIModal}
              title="AI ผู้ช่วยสร้าง Prompt / Lore / UI Code"
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-50 to-pink-50 dark:from-amber-950/40 dark:to-pink-950/40 hover:from-amber-100 hover:to-pink-100 dark:hover:from-amber-900/60 dark:hover:to-pink-900/60 text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/70 rounded-full text-xs font-medium transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="hidden lg:inline">AI ผู้ช่วย</span>
            </button>

            {/* Create Asset Button */}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-full text-xs font-medium transition-all shadow-sm shadow-purple-200 dark:shadow-purple-950 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">สร้างผลงาน</span>
            </button>

            {/* User Profile Avatar with Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900 rounded-full hover:border-purple-300 transition-all focus:outline-none focus:ring-2 focus:ring-purple-300/50 cursor-pointer"
              >
                <img
                  src={userAvatar}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-200/60 dark:ring-purple-800/60"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-0.5" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-purple-100 dark:border-purple-900/70 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* User Profile Header in Dropdown */}
                  <div className="px-3 py-2.5 border-b border-purple-50 dark:border-purple-950 mb-1">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={userAvatar}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-100 dark:ring-purple-900"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {userEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Navigation Items */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        onViewChange('vault');
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-purple-500" />
                      <span>คลังผลงานของฉัน (My Vault)</span>
                    </button>

                    <button
                      onClick={() => {
                        onViewChange('feed');
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left md:hidden cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-indigo-500" />
                      <span>ฟีดสาธารณะ (Public Feed)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onOpenSettingsModal) onOpenSettingsModal();
                        else onOpenProfileModal();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-purple-500" />
                      <span>ตั้งค่าบัญชี & รหัสผ่าน (Settings)</span>
                    </button>

                    <button
                      onClick={() => {
                        onOpenProfileModal();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>แก้ไขโปรไฟล์ (Edit Profile)</span>
                    </button>
                  </div>

                  {/* Auth Actions */}
                  <div className="border-t border-purple-50 dark:border-purple-950 my-1 pt-1 space-y-0.5">
                    {currentUser?.isGuest || !currentUser ? (
                      <>
                        <button
                          onClick={() => {
                            onOpenAuthModal();
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>เข้าสู่ระบบ (Log In)</span>
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenSignUpModal) onOpenSignUpModal();
                            else onOpenAuthModal();
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>สมัครสมาชิกใหม่ (Sign Up)</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>ออกจากระบบ</span>
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
