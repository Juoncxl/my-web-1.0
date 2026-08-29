import React from 'react';
import { Camera, Upload } from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80'
];

interface ProfileAvatarPickerProps {
  avatarUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarChange: (avatarUrl: string) => void;
}

export const ProfileAvatarPicker: React.FC<ProfileAvatarPickerProps> = ({
  avatarUrl,
  fileInputRef,
  onAvatarChange
}) => {
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onAvatarChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <img
          src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
          alt="Avatar"
          className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-100 dark:ring-purple-900 shadow-md"
        />
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Quick Avatar Presets */}
      <div className="pt-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block text-center mb-1">หรือเลือกภาพสำเร็จรูป:</span>
        <div className="flex items-center gap-1.5 justify-center">
          {PRESET_AVATARS.map((avatar, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onAvatarChange(avatar)}
              className={`w-7 h-7 rounded-full overflow-hidden transition-transform ${
                avatarUrl === avatar ? 'ring-2 ring-purple-600 dark:ring-purple-400 scale-110' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <img src={avatar} alt="preset" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
