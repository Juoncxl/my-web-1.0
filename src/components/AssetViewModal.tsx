import React, { useState } from 'react';
import { Asset, AssetStatus, AssetVisibility } from '../types';
import { CATEGORIES, STATUS_PRESETS } from '../lib/constants';
import { formatThaiDate, formatShortDate } from '../lib/dateUtils';
import { 
  X, 
  Copy, 
  Check, 
  Code, 
  Download, 
  Edit3, 
  Trash2, 
  Lock, 
  Globe, 
  Share2, 
  Sparkles,
  ShieldCheck,
  Bookmark as BookmarkIcon,
  GitFork,
  Flag,
  History,
  Link2,
  FileText,
  Clock,
  RotateCcw,
  AlertTriangle,
  FileEdit
} from 'lucide-react';
import { SandboxedCodePreview } from './SandboxedCodePreview';
import confetti from 'canvas-confetti';

interface AssetViewModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (assetId: string) => void;
  onPermanentDelete?: (assetId: string) => void;
  onRestore?: (assetId: string) => void;
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onSelectLinkedAsset?: (assetId: string) => void;
  allAssets?: Asset[];
  isOwner?: boolean;
  isBookmarked?: boolean;
  isTrashMode?: boolean;
}

export const AssetViewModal: React.FC<AssetViewModalProps> = ({
  asset,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPermanentDelete,
  onRestore,
  onBookmark,
  onFork,
  onReport,
  onSelectLinkedAsset,
  allAssets = [],
  isOwner = false,
  isBookmarked = false,
  isTrashMode = false
}) => {
  const [copiedType, setCopiedType] = useState<'content' | 'code' | 'json' | 'md' | null>(null);
  const [uiTab, setUiTab] = useState<'preview' | 'code' | 'split'>('split');
  const [shareToast, setShareToast] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  if (!isOpen || !asset) return null;

  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;
  const statusMeta = STATUS_PRESETS[asset.status || 'finished'] || STATUS_PRESETS.finished;

  const galleryImages = asset.previewImages && asset.previewImages.length > 0
    ? asset.previewImages
    : (asset.previewImage ? [asset.previewImage] : []);

  // Linked assets data lookup
  const linkedAssets = (asset.linkedAssetIds || [])
    .map(id => allAssets.find(a => a.id === id))
    .filter((a): a is Asset => Boolean(a));

  const copyToClipboard = (text: string, type: 'content' | 'code' | 'json' | 'md') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);

    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#8B5CF6', '#EC4899', '#3B82F6']
    });

    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(asset, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${asset.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_vault.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    const mdContent = `# ${asset.title}
**หมวดหมู่:** ${categoryMeta.name} (${categoryMeta.nameEn})
**ผู้สร้าง:** ${asset.authorName}
**วันที่สร้าง:** ${asset.createdAt}
**ลิขสิทธิ์ / Proof Hash:** #VAULT-${asset.id.slice(0, 8).toUpperCase()}

---

## เนื้อหาหลัก
${asset.content}

${asset.uiCodeSnippet ? `\n---\n\n## โค้ด UI Snippet\n\`\`\`html\n${asset.uiCodeSnippet}\n\`\`\`` : ''}
`;
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${asset.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-100/70 dark:border-slate-800 bg-gradient-to-r from-purple-50/50 via-white to-pink-50/50 dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          
          <div className="flex items-center gap-3 min-w-0">
            
            {/* Custom Icon Display */}
            <div className="shrink-0">
              {asset.icon.type === 'image' ? (
                <img
                  src={asset.icon.value}
                  alt="icon"
                  className="w-11 h-11 rounded-2xl object-cover ring-2 ring-purple-200 dark:ring-purple-800"
                />
              ) : asset.icon.type === 'kaomoji' ? (
                <span className="px-3 py-1.5 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 text-sm font-mono font-bold border border-purple-200 dark:border-purple-800">
                  {asset.icon.value}
                </span>
              ) : (
                <span className="text-3xl filter drop-shadow-xs">
                  {asset.icon.value || '✨'}
                </span>
              )}
            </div>

            {/* Title & Badges */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Category Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor}`}>
                  {categoryMeta.emoji} {categoryMeta.name}
                </span>
                
                {/* Status Badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusMeta.bg} ${statusMeta.text} border ${statusMeta.border} flex items-center gap-1`}>
                  <span>{statusMeta.emoji}</span>
                  <span>{statusMeta.name}</span>
                </span>

                {/* Visibility Badge */}
                {asset.visibility === 'public' || asset.isPublic ? (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 font-semibold">
                    <Globe className="w-3 h-3 text-indigo-500" />
                    <span>สาธารณะ</span>
                  </span>
                ) : asset.visibility === 'draft' ? (
                  <span className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-semibold">
                    <FileEdit className="w-3 h-3 text-slate-500" />
                    <span>แบบร่าง (Draft)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900 font-semibold">
                    <Lock className="w-3 h-3 text-rose-500" />
                    <span>ส่วนตัว (Private Lock)</span>
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
                {asset.title}
              </h2>
            </div>

          </div>

          {/* Close & Header Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bookmark button */}
            {onBookmark && (
              <button
                onClick={() => onBookmark(asset.id)}
                title={isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์กเก็บไว้ (Bookmark)'}
                className={`p-2 rounded-full border transition-all ${
                  isBookmarked
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* Fork Button */}
            {!isOwner && onFork && (
              <button
                onClick={() => onFork(asset)}
                title="โคลนผลงานเข้าสู่คลังของคุณ (Fork/Duplicate)"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors border border-slate-200 dark:border-slate-700"
              >
                <GitFork className="w-4 h-4" />
              </button>
            )}

            {/* Share button */}
            <button
              onClick={handleShare}
              title="แชร์ลิงก์"
              className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors relative"
            >
              <Share2 className="w-4 h-4" />
              {shareToast && (
                <span className="absolute -bottom-7 right-0 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap shadow-md">
                  คัดลอกลิงก์แล้ว!
                </span>
              )}
            </button>

            {/* Report Button for non-owners */}
            {!isOwner && onReport && (
              <button
                onClick={() => onReport(asset)}
                title="รายงานเนื้อหานี้ (Report)"
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Creator & Copyright Proof Banner */}
          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={asset.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={asset.authorName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-300 dark:ring-purple-700"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {asset.authorName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-purple-500" />
                  <span>สร้างเมื่อ: {formatThaiDate(asset.createdAt)}</span>
                </p>
              </div>
            </div>

            {/* Proof of Copyright Certificate Box */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>#VAULT-{asset.id.slice(0, 8).toUpperCase()}</span>
              </div>
              
              {/* Version History Trigger */}
              <button
                type="button"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 text-[11px] font-medium flex items-center gap-1 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-purple-500" />
                <span>ประวัติแก้ไข ({asset.versions?.length || 1})</span>
              </button>
            </div>
          </div>

          {/* Version History Drawer (if opened) */}
          {showVersionHistory && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-500" />
                  <span>ประวัติเวอร์ชันและไทม์สแตมป์ (Version History)</span>
                </span>
                <span className="text-[10px] text-slate-400">บันทึกทุกครั้งที่มีการอัปเดต</span>
              </div>
              
              <div className="space-y-2">
                {asset.versions && asset.versions.length > 0 ? (
                  asset.versions.map((ver, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-600 dark:text-purple-400">v{ver.version || (idx + 1)}.0</span>
                        <span className="text-slate-600 dark:text-slate-400">{ver.summary || 'บันทึกการแก้ไขเนื้อหา'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatShortDate(ver.updatedAt || asset.updatedAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-600 dark:text-purple-400">v1.0 (ต้นฉบับ)</span>
                      <span className="text-slate-600 dark:text-slate-400">สร้างเอกสารครั้งแรก</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatShortDate(asset.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Multiple Preview Images Gallery (if available) */}
          {galleryImages.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  รูปภาพประกอบ / แกลเลอรี่ ({galleryImages.length} รูป)
                </span>
                <span className="text-[11px] text-slate-400">คลิกที่รูปขนาดย่อเพื่อดูภาพขยาย</span>
              </div>

              {/* Main Expanded Image */}
              <div className="relative w-full max-h-[380px] rounded-2xl overflow-hidden bg-slate-950 border border-purple-100 dark:border-slate-800 flex items-center justify-center">
                <img
                  src={galleryImages[activeImageIdx] || galleryImages[0]}
                  alt="Gallery large preview"
                  className="max-h-[380px] w-auto object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Thumbnails Row (if more than 1 image) */}
              {galleryImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                        activeImageIdx === idx
                          ? 'border-purple-600 scale-105 shadow-md ring-2 ring-purple-200 dark:ring-purple-900'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`thumb ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Content / Prompts Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>เนื้อหา / ข้อมูลตัวละคร / Prompt Directives</span>
              </h3>

              <button
                onClick={() => copyToClipboard(asset.content, 'content')}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                  copiedType === 'content'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-slate-700 hover:bg-purple-100'
                }`}
              >
                {copiedType === 'content' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกเนื้อหา</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-text selection:bg-purple-200 dark:selection:bg-purple-900">
              {asset.content}
            </div>
          </div>

          {/* Linked Resources Section (if any) */}
          {linkedAssets.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>ผลงานที่เชื่อมโยงกัน (Linked Related Resources)</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {linkedAssets.map(linked => (
                  <div
                    key={linked.id}
                    onClick={() => onSelectLinkedAsset && onSelectLinkedAsset(linked.id)}
                    className="p-3 rounded-2xl border border-purple-100 dark:border-slate-800 bg-purple-50/40 dark:bg-slate-800/40 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl">{linked.icon?.value || '📄'}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {linked.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          @{linked.authorName} • {linked.category}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                      ดูข้อมูล →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UI Code Snippet & Sandboxed Output */}
          {asset.uiCodeSnippet && (
            <div className="space-y-3 pt-2">
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>โค้ดตกแต่ง UI & การแสดงผล (HTML/CSS)</span>
                </h3>

                {/* View Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setUiTab('split')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'split' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    พรีวิวคู่
                  </button>
                  <button
                    onClick={() => setUiTab('preview')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'preview' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    พรีวิวอย่างเดียว
                  </button>
                  <button
                    onClick={() => setUiTab('code')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'code' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Raw Code
                  </button>
                </div>
              </div>

              {/* Code / Preview Container */}
              <div className={`grid gap-4 ${uiTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Live Preview Box */}
                {(uiTab === 'preview' || uiTab === 'split') && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      ✦ Safe Sandboxed Preview
                    </div>
                    <div className="p-2 rounded-2xl bg-gradient-to-br from-slate-100 to-purple-50/50 dark:from-slate-900 dark:to-slate-850 border border-purple-200 dark:border-slate-800 min-h-[220px] flex items-center justify-center overflow-hidden">
                      <SandboxedCodePreview
                        code={asset.uiCodeSnippet || ''}
                        minHeight="200px"
                      />
                    </div>
                  </div>
                )}

                {/* Raw Code Box */}
                {(uiTab === 'code' || uiTab === 'split') && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <span>HTML / CSS Source</span>
                      <button
                        onClick={() => copyToClipboard(asset.uiCodeSnippet!, 'code')}
                        className="text-purple-600 dark:text-purple-400 hover:underline lowercase font-medium flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedType === 'code' ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>
                    <pre className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 text-purple-200 text-xs font-mono overflow-x-auto max-h-[260px] border border-slate-800">
                      <code>{asset.uiCodeSnippet}</code>
                    </pre>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              <span className="text-xs text-slate-400 font-medium">แท็ก:</span>
              {asset.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-slate-700 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-6 border-t border-purple-100/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          
          {/* Export options */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-purple-100 dark:border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>ส่งออก Markdown (.md)</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-purple-100 dark:border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>ส่งออก JSON</span>
            </button>
          </div>

          {/* Action buttons based on ownership or trash mode */}
          <div className="flex items-center gap-2">
            {isTrashMode ? (
              <>
                {onRestore && (
                  <button
                    onClick={() => {
                      onRestore(asset.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>กู้คืนผลงาน</span>
                  </button>
                )}
                {onPermanentDelete && (
                  <button
                    onClick={() => {
                      if (window.confirm('คุณต้องการลบผลงานนี้ถาวรใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                        onPermanentDelete(asset.id);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบถาวร</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        if (onEdit) onEdit(asset);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold border border-purple-200 dark:border-slate-700 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไขผลงาน</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('ต้องการย้ายผลงานนี้ไปยังถังขยะ (Trash) ใช่หรือไม่?')) {
                          if (onDelete) onDelete(asset.id);
                          onClose();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ย้ายลงถังขยะ</span>
                    </button>
                  </>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
