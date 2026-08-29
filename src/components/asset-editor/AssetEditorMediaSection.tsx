import React, { useRef } from 'react';
import { Images, Plus, Trash, Upload } from 'lucide-react';

interface AssetEditorMediaSectionProps {
  previewImages: string[];
  onPreviewImagesChange: React.Dispatch<React.SetStateAction<string[]>>;
  onError: (message: string) => void;
}

export const AssetEditorMediaSection: React.FC<AssetEditorMediaSectionProps> = ({
  previewImages,
  onPreviewImagesChange,
  onError
}) => {
  const previewImageInputRef = useRef<HTMLInputElement>(null);

  const handlePreviewImagesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (previewImages.length + files.length > 6) {
      onError('สามารถเพิ่มรูปภาพได้สูงสุด 6 รูปต่อหนึ่งผลงาน');
      return;
    }

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        onError('ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB ต่อรูป');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onPreviewImagesChange((previousImages) => [...previousImages, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    onPreviewImagesChange((previousImages) => previousImages.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Images className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>แกลเลอรี่รูปภาพตัวอย่าง / ภาพตัวละคร / UI Preview ({previewImages.length}/6 รูป)</span>
        </span>
        <span className="text-[11px] text-slate-400 font-normal">รองรับไฟล์ PNG, JPG, GIF</span>
      </label>

      <input
        type="file"
        ref={previewImageInputRef}
        onChange={handlePreviewImagesUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {previewImages.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {previewImages.map((image, index) => (
              <div key={index} className="relative rounded-2xl overflow-hidden border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-slate-950 h-32 flex items-center justify-center group">
                <img
                  src={image}
                  alt={`Preview ${index + 1}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-1.5 left-2 text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md">
                  #{index + 1} {index === 0 ? '(ภาพหลัก)' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 transition-colors opacity-90 group-hover:opacity-100"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {previewImages.length < 6 && (
              <div
                onClick={() => previewImageInputRef.current?.click()}
                className="border-2 border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 bg-purple-50/40 dark:bg-slate-800/40 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center"
              >
                <Plus className="w-5 h-5 text-purple-500 mb-1" />
                <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                  เพิ่มรูปภาพ
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => previewImageInputRef.current?.click()}
          className="border-2 border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 bg-purple-50/40 dark:bg-slate-800/40 hover:bg-purple-50/80 rounded-2xl p-6 text-center cursor-pointer transition-colors"
        >
          <Upload className="w-6 h-6 text-purple-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">
            คลิกเพื่อเลือกรูปภาพจากเครื่อง (เลือกได้หลายรูป)
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ช่วยให้ผู้ใช้คนอื่นมองเห็นหน้าตาตัวละครหรือ UI ได้หลายมุมมอง
          </p>
        </div>
      )}
    </div>
  );
};
