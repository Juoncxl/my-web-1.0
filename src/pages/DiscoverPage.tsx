import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { AssetCollectionView } from '../components/AssetCollectionView';

interface DiscoverPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
  onOpenAIModal: () => void;
  onCreateAsset: () => void;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ collectionProps, onOpenAIModal, onCreateAsset }) => (
  <>
    <div className="mb-6 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 dark:from-purple-900 dark:via-indigo-900 dark:to-pink-900 text-white shadow-md shadow-purple-200 dark:shadow-purple-950/40 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="space-y-1 text-center sm:text-left z-10">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <span className="text-xl">🌸</span>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            ฟีดสาธารณะ (Creator Hub & Knowledge Base)
          </h1>
        </div>
        <p className="text-xs text-purple-100 dark:text-purple-200 max-w-xl font-normal leading-relaxed">
          รวมไอเดียโปรไฟล์ตัวละครแชทบอท, บทพูด First Message, Master System Prompts, และโค้ด UI พาสเทล จากนักสร้างทั่วไทย
        </p>
      </div>

      <div className="flex items-center gap-2 z-10 shrink-0">
        <button
          onClick={onOpenAIModal}
          className="px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>AI ช่วยแต่งบท</span>
        </button>

        <button
          onClick={onCreateAsset}
          className="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>แชร์ผลงาน</span>
        </button>
      </div>

      <div className="absolute right-0 top-0 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />
    </div>

    <AssetCollectionView {...collectionProps} />
  </>
);
