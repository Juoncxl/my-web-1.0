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

const brandMarkUrl = new URL('../assets/brand/brand-mark.svg', import.meta.url).href;
const brandMarkLightUrl = new URL('../assets/brand/brand-mark-light.svg', import.meta.url).href;

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeView: 'feed' | 'vault';
  onViewChange: (v: 'feed' | 'vault') => void;
  onOpenCreateModal: () => void;
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
  onOpenAuthModal,
  onOpenSignUpModal,
  onOpenProfileModal,
  onOpenSettingsModal
}) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
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

  const hasAvatar = Boolean(isAuthenticated && currentUser?.avatarUrl);
  const displayName = isAuthenticated ? (currentUser?.displayName || 'Creator') : 'ผู้เยี่ยมชม';
  const userSubtitle = isAuthenticated ? (currentUser?.email || 'บัญชีที่เชื่อมต่อ') : 'สำรวจผลงานสาธารณะได้';

  return (
    <header className="cv-shell-header sticky top-0 z-30 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => onViewChange('feed')}
              className="flex items-center gap-1.5 sm:gap-2 text-left group transition-transform active:scale-95 cursor-pointer"
              aria-label="CXL Studio — หน้าแรก"
            >
              <div className="cv-brand-mark w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
                <img src={brandMarkLightUrl} alt="" aria-hidden="true" className="w-7 h-7 sm:w-8 sm:h-8 object-contain dark:hidden" />
                <img src={brandMarkUrl} alt="" aria-hidden="true" className="hidden w-7 h-7 sm:w-8 sm:h-8 object-contain dark:block" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span className="cv-brand-wordmark" aria-label="CXL Studio">
                    <span className="cv-brand-wordmark-cxl">CXL</span>
                    <span className="cv-brand-wordmark-studio">Studio</span>
                  </span>
                  <span className="cv-brand-badge hidden sm:inline-flex text-[9px] font-semibold tracking-wide px-1 py-0.5 rounded-full">
                    CREATOR VAULT
                  </span>
                </div>
                <p className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0">
                  คลังไอเดียสำหรับนักเขียนและครีเอเตอร์
                </p>
              </div>
            </button>
          </div>

          {/* Center Search Bar */}
          <div className="flex-1 min-w-0 max-w-md mx-2">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-600 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ค้นหาตัวละคร, Prompt, UI Code, Lore..."
                className="cv-shell-input w-full pl-10 pr-4 py-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300/60 focus:border-purple-300 transition-all placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
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
            <div className="cv-view-switcher hidden md:flex items-center p-1 rounded-full">
              <button
                onClick={() => onViewChange('feed')}
                className={`cv-view-tab flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'feed'
                    ? 'is-active text-purple-700 dark:text-purple-200 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-purple-500" />
                <span>ฟีดสาธารณะ</span>
              </button>
              <button
                onClick={() => isAuthenticated ? onViewChange('vault') : onOpenAuthModal()}
                className={`cv-view-tab flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'vault'
                    ? 'is-active text-purple-700 dark:text-purple-200 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
                <span>คลังของฉัน</span>
              </button>
            </div>

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
              className="cv-shell-button p-2 rounded-full text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all hover:scale-105 cursor-pointer"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Create Asset Button */}
            <button
              onClick={onOpenCreateModal}
              className="cv-create-button flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">สร้างผลงาน</span>
            </button>

            {/* User Profile Avatar with Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="cv-guest-trigger flex items-center gap-1.5 p-1 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-300/50 cursor-pointer"
                aria-label={isAuthenticated ? `เมนูบัญชีของ ${displayName}` : 'เมนูผู้เยี่ยมชม'}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                {hasAvatar ? (
                  <img
                    src={currentUser?.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-200/60 dark:ring-purple-800/60"
                  />
                ) : (
                  <span className="cv-guest-avatar cv-guest-avatar-trigger" aria-hidden="true">
                    <UserIcon className="w-4 h-4" />
                  </span>
                )}
                <span className="hidden sm:inline max-w-28 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isAuthenticated ? displayName : 'ผู้เยี่ยมชม'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-0.5" />
              </button>

              {dropdownOpen && (
                <div className="cv-shell-menu absolute right-0 mt-2 w-64 rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150" role="menu">
                  
                  {/* User Profile Header in Dropdown */}
                  <div className="px-3 py-2.5 border-b border-purple-50 dark:border-purple-950 mb-1">
                    <div className="flex items-center gap-2.5">
                      {hasAvatar ? (
                        <img
                          src={currentUser?.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-100 dark:ring-purple-900"
                        />
                      ) : (
                        <span className="cv-guest-avatar cv-guest-avatar-menu" aria-hidden="true">
                          <UserIcon className="w-5 h-5" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {userSubtitle}
                        </p>
                        {!isAuthenticated && (
                          <p className="mt-1 text-[10px] leading-relaxed text-purple-600/80 dark:text-blue-200/75">
                            เข้าสู่ระบบเพื่อบันทึกและจัดการคลังของคุณ
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu Navigation Items */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        if (isAuthenticated) onViewChange('vault');
                        else onOpenAuthModal();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-purple-500" />
                      <span>คลังผลงานของฉัน</span>
                    </button>

                    <button
                      onClick={() => {
                        onViewChange('feed');
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left md:hidden cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-indigo-500" />
                      <span>ฟีดสาธารณะ</span>
                    </button>

                    {isAuthenticated && (
                      <>
                        <button
                          onClick={() => {
                            if (onOpenSettingsModal) onOpenSettingsModal();
                            else onOpenProfileModal();
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-purple-500" />
                          <span>ตั้งค่าบัญชีและรหัสผ่าน</span>
                        </button>

                        <button
                          onClick={() => {
                            onOpenProfileModal();
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-slate-400" />
                          <span>แก้ไขโปรไฟล์</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Auth Actions */}
                  <div className="border-t border-purple-50 dark:border-purple-950 my-1 pt-1 space-y-0.5">
                    {!isAuthenticated ? (
                      <>
                        <button
                          onClick={() => {
                            onOpenAuthModal();
                            setDropdownOpen(false);
                          }}
                          className="cv-menu-primary-action cv-auth-menu-primary w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-200 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>เข้าสู่ระบบ</span>
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenSignUpModal) onOpenSignUpModal();
                            else onOpenAuthModal();
                            setDropdownOpen(false);
                          }}
                          className="cv-menu-secondary-action cv-auth-menu-secondary w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-300 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>สมัครสมาชิก</span>
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
