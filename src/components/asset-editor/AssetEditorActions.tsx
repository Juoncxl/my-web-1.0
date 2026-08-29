import React from 'react';
import { Check } from 'lucide-react';

interface AssetEditorActionsProps {
  isSubmitting: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const AssetEditorActions: React.FC<AssetEditorActionsProps> = ({
  isSubmitting,
  isEditing,
  onClose,
  onSubmit
}) => (
  <div className="p-4 sm:p-6 border-t border-purple-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={onClose}
      className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
    >
      ยกเลิก
    </button>

    <button
      type="button"
      onClick={onSubmit}
      disabled={isSubmitting}
      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950 active:scale-95 disabled:opacity-50 flex items-center gap-2"
    >
      {isSubmitting ? (
        <span>กำลังบันทึก...</span>
      ) : (
        <>
          <Check className="w-4 h-4" />
          <span>{isEditing ? 'บันทึกการแก้ไข' : 'สร้างผลงานทันที'}</span>
        </>
      )}
    </button>
  </div>
);
