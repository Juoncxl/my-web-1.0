import React from 'react';

interface ProfileFieldsProps {
  displayName: string;
  bio: string;
  onDisplayNameChange: (value: string) => void;
  onBioChange: (value: string) => void;
}

export const ProfileFields: React.FC<ProfileFieldsProps> = ({
  displayName,
  bio,
  onDisplayNameChange,
  onBioChange
}) => (
  <>
    {/* Display Name */}
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        ชื่อแสดง (Display Name) <span className="text-rose-500">*</span>
      </label>
      <input
        type="text"
        value={displayName}
        onChange={(event) => onDisplayNameChange(event.target.value)}
        placeholder="เช่น: MochiWriterr 🌸"
        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 text-slate-800 dark:text-slate-100 font-medium"
        required
      />
    </div>

    {/* Bio */}
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        ประวัติแนะนำตัว (Bio)
      </label>
      <textarea
        value={bio}
        onChange={(event) => onBioChange(event.target.value)}
        rows={3}
        placeholder="บอกเล่าสไตล์การแต่งนิยาย หรือแนวบอทที่คุณชื่นชอบ..."
        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 text-slate-700 dark:text-slate-300"
      />
    </div>
  </>
);
