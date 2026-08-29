import React from 'react';

interface AssetViewTagsProps {
  tags?: string[];
}

export const AssetViewTags: React.FC<AssetViewTagsProps> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-2">
      <span className="text-xs text-slate-400 font-medium">แท็ก:</span>
      {tags.map((tag, index) => (
        <span
          key={index}
          className="px-2.5 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-slate-700 font-medium"
        >
          #{tag}
        </span>
      ))}
    </div>
  );
};
