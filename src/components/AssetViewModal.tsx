import React, { useState } from 'react';
import { Asset } from '../types';
import { CATEGORIES } from '../lib/constants';
import { formatThaiDate } from '../lib/dateUtils';
import { 
  X, 
  Copy, 
  Check, 
  Code, 
  Eye, 
  Download, 
  Edit3, 
  Trash2, 
  Lock, 
  Globe, 
  Share2, 
  Calendar, 
  User, 
  Sparkles,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { SandboxedCodePreview } from './SandboxedCodePreview';
import confetti from 'canvas-confetti';

interface AssetViewModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (assetId: string) => void;
  isOwner?: boolean;
}

export const AssetViewModal: React.FC<AssetViewModalProps> = ({
  asset,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  isOwner = false
}) => {
  const [copiedType, setCopiedType] = useState<'content' | 'code' | 'json' | null>(null);
  const [uiTab, setUiTab] = useState<'preview' | 'code' | 'split'>('split');
  const [shareToast, setShareToast] = useState(false);

  if (!isOpen || !asset) return null;

  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;

  const copyToClipboard = (text: string, type: 'content' | 'code' | 'json') => {
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-100/70 bg-gradient-to-r from-purple-50/50 via-white to-pink-50/50">
          
          <div className="flex items-center gap-3 min-w-0">
            
            {/* Custom Icon Display */}
            <div className="shrink-0">
              {asset.icon.type === 'image' ? (
                <img
                  src={asset.icon.value}
                  alt="icon"
                  className="w-11 h-11 rounded-2xl object-cover ring-2 ring-purple-200"
                />
              ) : asset.icon.type === 'kaomoji' ? (
                <span className="px-3 py-1.5 rounded-2xl bg-purple-100 text-purple-800 text-sm font-mono font-bold border border-purple-200">
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
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor}`}>
                  {categoryMeta.emoji} {categoryMeta.name}
                </span>
                
                {asset.isPublic ? (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">
                    <Globe className="w-3 h-3 text-indigo-500" />
                    <span>สาธารณะ (Public)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold">
                    <Lock className="w-3 h-3 text-rose-500" />
                    <span>ส่วนตัว (Private Lock)</span>
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate">
                {asset.title}
              </h2>
            </div>

          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              title="แชร์ลิงก์"
              className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors relative"
            >
              <Share2 className="w-4 h-4" />
              {shareToast && (
                <span className="absolute -bottom-7 right-0 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap shadow-md">
                  คัดลอกลิงก์แล้ว!
                </span>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Proof of Copyright & Author Banner */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50/80 to-pink-50/80 rounded-2xl border border-purple-100/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Author */}
            <div className="flex items-center gap-2.5">
              <img
                src={asset.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={asset.authorName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white"
              />
              <div>
                <p className="font-semibold text-slate-800">{asset.authorName}</p>
                <p className="text-[11px] text-slate-500">เจ้าของลิขสิทธิ์และผลงาน (Original Creator)</p>
              </div>
            </div>

            {/* Created Timestamp Proof */}
            <div className="flex items-center gap-1.5 text-purple-900 bg-white/80 px-3 py-1.5 rounded-xl border border-purple-100 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-mono text-[11px]">
                บันทึกเมื่อ: <strong>{formatThaiDate(asset.createdAt)}</strong>
              </span>
            </div>

          </div>

          {/* Preview Image if present */}
          {asset.previewImage && (
            <div className="rounded-2xl overflow-hidden border border-purple-100 max-h-72 bg-purple-50/50 flex items-center justify-center">
              <img
                src={asset.previewImage}
                alt={asset.title}
                className="max-h-72 w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Big Prominent Copy Button Bar (Crucial Feature) */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 p-4 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3 shadow-md shadow-purple-200">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>คัดลอกไปใช้งานได้ทันที (1-Click Copy to Clipboard)</span>
              </h4>
              <p className="text-xs text-purple-100 font-normal">
                ไม่ต้องลากคลุมดำ กดปุ่มเพื่อนำ Prompt หรือโค้ดไปวางในบอทได้เลย
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(asset.content, 'content')}
                className="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
              >
                {copiedType === 'content' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">คัดลอกเนื้อหาแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกคำสั่ง / Prompt</span>
                  </>
                )}
              </button>

              {asset.uiCodeSnippet && (
                <button
                  onClick={() => copyToClipboard(asset.uiCodeSnippet!, 'code')}
                  className="px-4 py-2 bg-purple-900/40 hover:bg-purple-900/60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-white/20 transition-transform active:scale-95"
                >
                  {copiedType === 'code' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>คัดลอกโค้ดแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-4 h-4" />
                      <span>คัดลอก HTML/CSS</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Main Content View (Notes / Prompt / Lore) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>📝 รายละเอียดเนื้อหา / โน้ต (Content & Notes)</span>
              </h3>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-purple-100/80 text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-purple-200">
              {asset.content}
            </div>
          </div>

          {/* UI Code Snippet with Live Preview (For ui_code category or when code snippet exists) */}
          {asset.uiCodeSnippet && (
            <div className="space-y-3 pt-2">
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-indigo-600" />
                  <span>UI Code Snippet & Live Preview (แสดงผลจริง)</span>
                </h3>

                {/* Tab Switcher */}
                <div className="flex items-center bg-purple-50 p-1 rounded-xl border border-purple-100">
                  <button
                    onClick={() => setUiTab('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'preview' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    <span>Live Preview</span>
                  </button>
                  <button
                    onClick={() => setUiTab('split')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'split' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <span>แยกสองฝั่ง (Split)</span>
                  </button>
                  <button
                    onClick={() => setUiTab('code')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      uiTab === 'code' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5 inline mr-1" />
                    <span>Raw Code</span>
                  </button>
                </div>
              </div>

              {/* Code / Preview Container */}
              <div className={`grid gap-4 ${uiTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Live Preview Box */}
                {(uiTab === 'preview' || uiTab === 'split') && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      ✦ หน้าจอแสดงผลจริง (Safe Sandboxed Output)
                    </div>
                    <div className="p-2 rounded-2xl bg-gradient-to-br from-slate-100 to-purple-50/50 border border-purple-200 min-h-[220px] flex items-center justify-center overflow-hidden">
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
                        className="text-purple-600 hover:text-purple-800 lowercase font-medium flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>copy code</span>
                      </button>
                    </div>
                    <pre className="p-4 rounded-2xl bg-slate-900 text-purple-200 text-xs font-mono overflow-x-auto max-h-[260px] border border-slate-800">
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
                  className="px-2.5 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-100 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-6 border-t border-purple-100/80 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          
          {/* Export JSON button */}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white hover:bg-purple-50 border border-purple-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>ส่งออกเป็น JSON (Export Card)</span>
          </button>

          {/* Owner Actions (Edit & Delete per RLS) */}
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <button
                  onClick={() => {
                    if (onEdit) onEdit(asset);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold border border-purple-200 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขผลงาน</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผลงานนี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                      if (onDelete) onDelete(asset.id);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบ</span>
                </button>
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
