import React, { useState, useRef, useEffect } from 'react';
import { Asset, AssetCategory, AssetIcon, Folder, AssetVisibility, AssetStatus } from '../types';
import { CATEGORIES, KAOMOJI_COLLECTIONS, POPULAR_EMOJIS, STATUS_PRESETS, VISIBILITY_PRESETS } from '../lib/constants';
import { 
  X, 
  Upload, 
  Sparkles, 
  Lock, 
  Globe, 
  Code, 
  Smile, 
  FileText, 
  Check,
  AlertCircle,
  Eye,
  Trash,
  Folder as FolderIcon,
  Plus,
  Images,
  Link2,
  FileEdit,
  Activity
} from 'lucide-react';
import { SandboxedCodePreview } from './SandboxedCodePreview';
import { useAuth } from '../context/AuthContext';

interface AssetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: Partial<Asset>) => Promise<boolean>;
  initialData?: Asset | null;
  folders?: Folder[];
  availableAssets?: Asset[];
  currentGuestAssetCount?: number;
  onOpenGuestLimitModal?: () => void;
  onOpenAIModalWithContext?: (type: string, context: string) => void;
}

export const AssetEditorModal: React.FC<AssetEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  folders = [],
  availableAssets = [],
  currentGuestAssetCount = 0,
  onOpenGuestLimitModal,
  onOpenAIModalWithContext
}) => {
  const { currentUser } = useAuth();

  // Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState<AssetCategory>(initialData?.category || 'character');
  const [content, setContent] = useState(initialData?.content || '');
  const [uiCodeSnippet, setUiCodeSnippet] = useState(initialData?.uiCodeSnippet || '');
  
  // Visibility & Status Workflow
  const [visibility, setVisibility] = useState<AssetVisibility>(
    initialData?.visibility || (initialData?.isPublic === false ? 'private' : 'public')
  );
  const [status, setStatus] = useState<AssetStatus>(initialData?.status || 'finished');

  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(', ') || '');
  const [folderId, setFolderId] = useState<string | null>(initialData?.folderId || null);
  const [linkedAssetIds, setLinkedAssetIds] = useState<string[]>(initialData?.linkedAssetIds || []);
  
  // Icon State
  const [iconType, setIconType] = useState<'emoji' | 'kaomoji' | 'image'>(initialData?.icon?.type || 'emoji');
  const [iconValue, setIconValue] = useState(initialData?.icon?.value || '🌸');
  
  // Preview Images (Gallery)
  const [previewImages, setPreviewImages] = useState<string[]>(
    initialData?.previewImages && initialData.previewImages.length > 0
      ? initialData.previewImages
      : (initialData?.previewImage ? [initialData.previewImage] : [])
  );
  
  // UI Code preview test
  const [showCodePreview, setShowCodePreview] = useState(false);

  // Saving state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const previewImageInputRef = useRef<HTMLInputElement>(null);
  const iconImageInputRef = useRef<HTMLInputElement>(null);

  // Update when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setCategory(initialData.category);
      setContent(initialData.content);
      setUiCodeSnippet(initialData.uiCodeSnippet || '');
      setVisibility(initialData.visibility || (initialData.isPublic ? 'public' : 'private'));
      setStatus(initialData.status || 'finished');
      setTagsInput(initialData.tags?.join(', ') || '');
      setIconType(initialData.icon?.type || 'emoji');
      setIconValue(initialData.icon?.value || '🌸');
      setFolderId(initialData.folderId || null);
      setLinkedAssetIds(initialData.linkedAssetIds || []);
      
      const imgs = initialData.previewImages && initialData.previewImages.length > 0
        ? initialData.previewImages
        : (initialData.previewImage ? [initialData.previewImage] : []);
      setPreviewImages(imgs);
    } else {
      setTitle('');
      setCategory('character');
      setContent('');
      setUiCodeSnippet('');
      setVisibility('public');
      setStatus('finished');
      setTagsInput('');
      setIconType('emoji');
      setIconValue('🌸');
      setFolderId(null);
      setLinkedAssetIds([]);
      setPreviewImages([]);
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Handle local image upload for Preview Images Gallery (multiple support)
  const handlePreviewImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (previewImages.length + files.length > 6) {
      setErrorMsg('สามารถเพิ่มรูปภาพได้สูงสุด 6 รูปต่อหนึ่งผลงาน');
      return;
    }

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg('ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB ต่อรูป');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreviewImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setPreviewImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle local image upload for Custom Icon
  const handleIconImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('ขนาดรูปไอคอนต้องไม่เกิน 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setIconType('image');
      setIconValue(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Toggle linked resource
  const toggleLinkedAsset = (assetId: string) => {
    setLinkedAssetIds(prev => 
      prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
    );
  };

  // Quick Preset Templates for Writers & Bot Creators
  const applyTemplate = (type: string) => {
    if (type === 'bot_char') {
      setContent(`# [Character Profile: {{char}}]
- ชื่อ/ฉายา: 
- เพศ/อายุ: 
- บทบาท: 
- บุคลิกภาพ: 
- สไตล์การพูดและสรรพนาม: 
- ความชอบ/สิ่งที่ไม่ชอบ: 

## First Message (ทักทายแรก):
*{{char}} หันมามองคุณพร้อมรอยยิ้มบางๆ*
"สวัสดี... ยินดีที่ได้พบกันนะ"`);
      setCategory('character');
    } else if (type === 'system_prompt') {
      setContent(`[System Instruction: Roleplay Directives]
1. Never break character. Always stay fully immersed as {{char}}.
2. Use descriptive actions in asterisks *...* to depict physical nuance, tone, and environment.
3. Keep dialogue in Thai language natural, emotional, and responsive to {{user}}'s input.`);
      setCategory('prompts');
    } else if (type === 'ui_bubble') {
      setCategory('ui_code');
      setUiCodeSnippet(`<div class="kawaii-bubble">
  <span class="bubble-tag">🌸 BOT</span>
  <p class="bubble-msg">สวัสดีค่ะ ยินดีที่ได้คุยกันนะคะ!</p>
</div>

<style>
.kawaii-bubble {
  background: linear-gradient(135deg, #FFF1F2 0%, #EDE9FE 100%);
  border: 1.5px solid #FBCFE8;
  border-radius: 24px 24px 24px 6px;
  padding: 16px 20px;
  max-width: 320px;
  box-shadow: 0 8px 20px -4px rgba(244, 114, 182, 0.25);
  font-family: sans-serif;
}
.bubble-tag {
  font-size: 10px;
  font-weight: 800;
  color: #EC4899;
}
.bubble-msg {
  margin: 6px 0 0 0;
  font-size: 14px;
  color: #4B5563;
}
</style>`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check Guest limit (Anti-spam)
    if (!initialData && currentUser?.isAnonymous && currentGuestAssetCount >= 2) {
      if (onOpenGuestLimitModal) {
        onClose();
        onOpenGuestLimitModal();
        return;
      }
    }

    if (!title.trim()) {
      setErrorMsg('กรุณากรอกชื่อเรื่องของผลงาน');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const icon: AssetIcon = {
        type: iconType,
        value: iconValue
      };

      const payload: Partial<Asset> = {
        title: title.trim(),
        icon,
        category,
        content: content.trim(),
        uiCodeSnippet: uiCodeSnippet.trim(),
        previewImage: previewImages[0] || '',
        previewImages: previewImages,
        folderId: folderId || null,
        isPublic: visibility === 'public',
        visibility,
        status,
        linkedAssetIds,
        tags,
        authorName: currentUser?.displayName || 'Anonymous Creator',
        authorAvatar: currentUser?.avatarUrl || ''
      };

      const ok = await onSave(payload);
      if (ok) {
        onClose();
      } else {
        setErrorMsg('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-100 dark:border-slate-800 bg-gradient-to-r from-purple-50/60 via-pink-50/40 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg shadow-sm shadow-purple-200 dark:shadow-purple-950">
              {initialData ? '✏️' : '✨'}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                {initialData ? 'แก้ไขผลงานในคลัง' : 'สร้างผลงาน / แอสเซทใหม่'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                สำหรับเก็บบันทึกโปรไฟล์บอท, บทพูด, คำสั่ง Prompt และโค้ด UI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Visibility & Status Bar (Gen Z Minimalist Badge Group) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-purple-50/40 dark:bg-slate-800/40 rounded-2xl border border-purple-100 dark:border-slate-800">
            
            {/* 1. Visibility Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>ระดับการมองเห็น (Visibility)</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['public', 'private', 'draft'] as AssetVisibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      visibility === v
                        ? 'border-purple-600 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-transparent bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="text-sm">
                      {v === 'public' ? '🌐' : v === 'private' ? '🔒' : '📝'}
                    </span>
                    <span className="text-[11px]">
                      {v === 'public' ? 'สาธารณะ' : v === 'private' ? 'ส่วนตัว' : 'แบบร่าง'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Status Workflow Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>สถานะงาน (Workflow Status)</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                {(['idea', 'draft', 'in_progress', 'finished', 'archived'] as AssetStatus[]).map((s) => {
                  const meta = STATUS_PRESETS[s];
                  const isSelected = status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                        isSelected
                          ? `${meta.bg} ${meta.text} ${meta.border} shadow-xs scale-102`
                          : 'border-transparent bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                      title={meta.name}
                    >
                      <span className="text-xs">{meta.emoji}</span>
                      <span className="truncate max-w-[55px]">{meta.nameEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Title & Icon Header */}
          <div className="flex gap-3 items-start">
            
            {/* Custom Icon Box */}
            <div className="space-y-1 shrink-0">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ไอคอน
              </label>
              <div className="relative group">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800 flex items-center justify-center text-2xl overflow-hidden shadow-inner">
                  {iconType === 'image' ? (
                    <img src={iconValue} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <span>{iconValue}</span>
                  )}
                </div>

                <div className="absolute -bottom-1 -right-1 flex gap-1">
                  <input
                    type="file"
                    ref={iconImageInputRef}
                    onChange={handleIconImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => iconImageInputRef.current?.click()}
                    title="อัปโหลดรูปภาพไอคอน"
                    className="p-1 bg-purple-600 text-white rounded-full shadow-md hover:bg-purple-700 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Title Input */}
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ชื่อผลงาน / ชื่อตัวละคร / หัวข้อ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น: 🌸 พลอยใส (Ploysai) — บอทเพื่อนสนิทสายฮีลใจ"
                className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 transition-all"
                required
              />

              {/* Icon Presets Quick Selection */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400">อีโมจิด่วน:</span>
                {POPULAR_EMOJIS.slice(0, 10).map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setIconType('emoji');
                      setIconValue(emoji);
                    }}
                    className="w-6 h-6 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950 text-xs transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category & Folder Organization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                หมวดหมู่หลัก (Category)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
              >
                {Object.values(CATEGORIES).map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name} ({cat.nameEn})
                  </option>
                ))}
              </select>
            </div>

            {/* Folder Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FolderIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>โฟลเดอร์จัดเก็บในคลัง (Folder)</span>
              </label>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
              >
                <option value="">📁 ไม่ระบุโฟลเดอร์ (หน้าแรกคลัง)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.icon || '📁'} {f.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Quick Writing Templates */}
          <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>เทมเพลตเริ่มต้นด่วน (Starter Presets)</span>
              </span>
              <span className="text-[10px] text-slate-400">กดเพื่อแทรกโครงสร้าง</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyTemplate('bot_char')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
              >
                🎭 ตัวละครแชทบอท & First Message
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('system_prompt')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
              >
                📝 System Prompts Directives
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('ui_bubble')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
              >
                💻 กล่องแชทพาสเทล CSS
              </button>
            </div>
          </div>

          {/* Main Content (Markdown/Prompt/Script) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>เนื้อหาหลัก / สคริปต์ / Prompt (รองรับ Markdown)</span>
              </label>

              {onOpenAIModalWithContext && (
                <button
                  type="button"
                  onClick={() => onOpenAIModalWithContext('refine', content)}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>ใช้ AI ช่วยเกลาเนื้อหา</span>
                </button>
              )}
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="พิมพ์ข้อความรายละเอียด, First message, System Prompt, หรือบันทึกต่างๆ..."
              rows={8}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 leading-relaxed"
            />
          </div>

          {/* Optional UI Code Snippet (HTML/CSS) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>โค้ดตกแต่ง UI เพิ่มเติม (HTML / CSS - Optional)</span>
              </label>

              {uiCodeSnippet.trim() && (
                <button
                  type="button"
                  onClick={() => setShowCodePreview(!showCodePreview)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showCodePreview ? 'ซ่อนพรีวิว' : 'ทดสอบพรีวิวโค้ด'}</span>
                </button>
              )}
            </div>

            <textarea
              value={uiCodeSnippet}
              onChange={(e) => setUiCodeSnippet(e.target.value)}
              placeholder="เช่น: <div class='card'>...</div> <style>.card {...}</style>"
              rows={4}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-mono text-indigo-900 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-800"
            />

            {showCodePreview && uiCodeSnippet.trim() && (
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-900/60 mt-2 overflow-hidden">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">ผลลัพธ์พรีวิว UI:</div>
                <div className="p-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <SandboxedCodePreview
                    code={uiCodeSnippet}
                    minHeight="140px"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Linked Resources Selector */}
          {availableAssets.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>ผลงานที่เชื่อมโยงกัน (Linked Related Resources)</span>
              </label>
              <p className="text-[11px] text-slate-400">
                เลือกเชื่อมโยงตัวละครเข้ากับ Lore ประจำโลก หรือชุดคำสั่ง System Prompt อื่นๆ ในคลัง
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                {availableAssets
                  .filter(a => a.id !== initialData?.id)
                  .map(a => {
                    const isLinked = linkedAssetIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleLinkedAsset(a.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isLinked
                            ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                        }`}
                      >
                        <span>{a.icon?.value || '📄'}</span>
                        <span className="truncate max-w-[140px]">{a.title}</span>
                        {isLinked && <Check className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Multiple Preview Images (Gallery) Upload from Device */}
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

            {/* Display list of uploaded images */}
            {previewImages.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {previewImages.map((img, idx) => (
                    <div key={idx} className="relative rounded-2xl overflow-hidden border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-slate-950 h-32 flex items-center justify-center group">
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md">
                        #{idx + 1} {idx === 0 ? '(ภาพหลัก)' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 transition-colors opacity-90 group-hover:opacity-100"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add more button if less than 6 */}
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

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              แท็กค้นหา (คั่นด้วยจุลภาค)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="เช่น: Roleplay, Tsundere, SillyTavern, Cyberpunk"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850"
            />
          </div>

          {/* Proof of Copyright Note */}
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>©</span>
            <span>ระบบจะบันทึกวันและเวลาที่สร้างผลงานอัตโนมัติ เพื่อเป็นหลักฐานยืนยันความคิดริเริ่มและลิขสิทธิ์ของคุณ</span>
          </div>

        </form>

        {/* Modal Footer */}
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 dark:shadow-purple-950 active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{initialData ? 'บันทึกการแก้ไข' : 'สร้างผลงานทันที'}</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
