import React from 'react';

interface AssetViewGalleryProps {
  images: string[];
  activeImageIdx: number;
  onSelectImage: (index: number) => void;
}

export const AssetViewGallery: React.FC<AssetViewGalleryProps> = ({
  images,
  activeImageIdx,
  onSelectImage
}) => {
  if (images.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          รูปภาพประกอบ / แกลเลอรี่ ({images.length} รูป)
        </span>
        <span className="text-[11px] text-slate-400">คลิกที่รูปขนาดย่อเพื่อดูภาพขยาย</span>
      </div>
      <div className="relative w-full max-h-[380px] rounded-2xl overflow-hidden bg-slate-950 border border-purple-100 dark:border-slate-800 flex items-center justify-center">
        <img
          src={images[activeImageIdx] || images[0]}
          alt="Gallery large preview"
          className="max-h-[380px] w-auto object-contain rounded-2xl"
          referrerPolicy="no-referrer"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => onSelectImage(index)}
              className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                activeImageIdx === index
                  ? 'border-purple-600 scale-105 shadow-md ring-2 ring-purple-200 dark:ring-purple-900'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={image} alt={`thumb ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
