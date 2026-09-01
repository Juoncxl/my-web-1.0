import React from 'react';
import { Camera, Upload, UserRound } from 'lucide-react';
import { validateQaProfileImage } from '../../lib/qaProfileImageStore';

interface ProfileAvatarPickerProps {
  avatarUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarChange: (avatarUrl: string) => void;
  onAvatarFileChange?: (file: File | null) => void;
  onAvatarRemove?: () => void;
  hasStoredImage?: boolean;
  onValidationError?: (message: string) => void;
  fallbackLabel?: string;
}

export const ProfileAvatarPicker: React.FC<ProfileAvatarPickerProps> = ({
  avatarUrl,
  fileInputRef,
  onAvatarChange,
  onAvatarFileChange,
  onAvatarRemove,
  hasStoredImage = false,
  onValidationError,
  fallbackLabel = 'C'
}) => {
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateQaProfileImage(file);
    if (validationError) {
      onValidationError?.(validationError);
      event.target.value = '';
      return;
    }

    let previewUrl: string;
    try {
      previewUrl = URL.createObjectURL(file);
    } catch {
      onValidationError?.('ไม่สามารถอ่านไฟล์รูปภาพได้');
      event.target.value = '';
      return;
    }
    onAvatarChange(previewUrl);
    onAvatarFileChange?.(file);
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
      {(avatarUrl || hasStoredImage) && onAvatarRemove && (
        <button
          type="button"
          onClick={onAvatarRemove}
          className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
        >
          ลบรูปโปรไฟล์
        </button>
      )}
    </div>
  );
};
