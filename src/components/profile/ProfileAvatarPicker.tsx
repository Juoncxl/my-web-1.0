import React from 'react';
import { Camera, Upload, UserRound } from 'lucide-react';

interface ProfileAvatarPickerProps {
  avatarUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarChange: (avatarUrl: string) => void;
  onAvatarFileChange?: (file: File) => void;
  onValidationError?: (message: string) => void;
  fallbackLabel?: string;
}

export const ProfileAvatarPicker: React.FC<ProfileAvatarPickerProps> = ({
  avatarUrl,
  fileInputRef,
  onAvatarChange,
  onAvatarFileChange,
  onValidationError,
  fallbackLabel = 'C'
}) => {
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      onValidationError?.('รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF');
      event.target.value = '';
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      onValidationError?.('ขนาดไฟล์ต้องไม่เกิน 5MB');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onAvatarChange(reader.result);
    };
    reader.onerror = () => onValidationError?.('ไม่สามารถอ่านไฟล์รูปภาพได้');
    onAvatarFileChange?.(file);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        {avatarUrl ? <img src={avatarUrl} alt="ตัวอย่างรูปโปรไฟล์" className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-100 dark:ring-purple-900 shadow-md" referrerPolicy="no-referrer" /> : (
          <span className="w-20 h-20 rounded-full ring-4 ring-purple-100 dark:ring-purple-900 shadow-md bg-gradient-to-br from-purple-500 to-cyan-500 text-white flex items-center justify-center text-2xl font-black" aria-label="ยังไม่มีรูปโปรไฟล์">
            {fallbackLabel.slice(0, 1).toUpperCase() || <UserRound className="w-7 h-7" />}
          </span>
        )}
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
          <Camera className="w-6 h-6 text-white" />
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarUpload}
        accept="image/*"
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 px-3 py-1 rounded-full transition-colors flex items-center gap-1 border border-purple-100 dark:border-purple-900"
      >
        <Upload className="w-3 h-3" />
        <span>อัปโหลดรูปจากเครื่อง</span>
      </button>
    </div>
  );
};
