import React from 'react';
import { AssetCollectionView } from '../components/AssetCollectionView';

interface DiscoverPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
  onCreateAsset: () => void;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ collectionProps, onCreateAsset }) => (
  <>
    <div className="cv-feed-intro mb-5 sm:mb-7">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-purple-600 dark:text-purple-300 uppercase">
          <span className="cv-sparkle-dot" aria-hidden="true">✦</span>
          <span>Discover your next spark</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
          สำรวจไอเดียที่อยากเก็บไว้
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          ตัวละคร พรอมป์ บทเปิดแชต และ UI จากครีเอเตอร์ใน CXL Studio — เลือกดูให้เจอสิ่งที่ใช่ แล้วบันทึกไว้ในคลังของคุณ
        </p>
      </div>

      <button
        onClick={onCreateAsset}
        className="cv-primary-button shrink-0"
      >
        <span className="text-base leading-none">＋</span>
        <span>สร้างผลงาน</span>
      </button>
    </div>

    <AssetCollectionView {...collectionProps} />
  </>
);
