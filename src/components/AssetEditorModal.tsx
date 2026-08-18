import React, { useState, useRef, useEffect } from 'react';
import { Asset, AssetCategory, AssetIcon, Folder } from '../types';
import { CATEGORIES, KAOMOJI_COLLECTIONS, POPULAR_EMOJIS } from '../lib/constants';
import { 
  X, 
  Upload, 
  Sparkles, 
  Lock, 
  Globe, 
  Code, 
  Image as ImageIcon, 
  Smile, 
  FileText, 
  Check,
  AlertCircle,
  Eye,
  Trash,
  Folder as FolderIcon,
  Plus,
  Images
} from 'lucide-react';
import { SandboxedCodePreview } from './SandboxedCodePreview';
import { useAuth } from '../context/AuthContext';

interface AssetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: Partial<Asset>) => Promise<boolean>;
  initialData?: Asset | null;
  folders?: Folder[];
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
  const [isPublic, setIsPublic] = useState(initialData?.isPublic !== undefined ? initialData.isPublic : true);
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(', ') || '');
  const [folderId, setFolderId] = useState<string | null>(initialData?.folderId || null);
  
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
      setIsPublic(initialData.isPublic);
      setTagsInput(initialData.tags?.join(', ') || '');
      setIconType(initialData.icon?.type || 'emoji');
      setIconValue(initialData.icon?.value || '🌸');
      setFolderId(initialData.folderId || null);
      
      const imgs = initialData.previewImages && initialData.previewImages.length > 0
        ? initialData.previewImages
        : (initialData.previewImage ? [initialData.previewImage] : []);
      setPreviewImages(imgs);
    } else {
      setTitle('');
      setCategory('character');
      setContent('');
      setUiCodeSnippet('');
      setIsPublic(true);
      setTagsInput('');
      setIconType('emoji');
      setIconValue('🌸');
      setFolderId(null);
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

  // Handle local image/GIF upload for Custom Icon
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
        isPublic,
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
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
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
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Visibility Toggle Switch (Public vs Private) */}
          <div className="p-4 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/40 to-pink-50/40 dark:from-purple-950/30 dark:to-pink-950/30 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-full">
                    <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>สาธารณะ (Public Feed)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/70 px-2.5 py-0.5 rounded-full">
                    <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>ส่วนตัว (Private - ซ่อนจากผู้อื่น)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isPublic
                  ? 'แสดงในฟีดหน้าแรก ให้ทุกคนได้อ่านและค้นพบผลงาน'
                  : 'มองเห็นได้เฉพาะคุณใน "คลังของฉัน" เท่านั้น (ความลับ/ไอเดียร่าง)'}
              </p>
            </div>

            {/* Switch Control */}
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPublic ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isPublic ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ✦ แม่แบบเริ่มต้นด่วน (Quick Presets):
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyTemplate('bot_char')}
                className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl border border-purple-200 dark:border-purple-800 transition-colors flex items-center gap-1.5"
              >
                <span>🤖</span>
                <span>บอทตัวละคร Roleplay</span>
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('system_prompt')}
                className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-xl border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>System Directive Prompt</span>
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('ui_bubble')}
                className="px-3 py-1.5 bg-pink-50 dark:bg-pink-950/60 hover:bg-pink-100 dark:hover:bg-pink-900/60 text-pink-700 dark:text-pink-300 text-xs font-semibold rounded-xl border border-pink-200 dark:border-pink-800 transition-colors flex items-center gap-1.5"
              >
                <span>🌸</span>
                <span>UI Bubble HTML/CSS</span>
              </button>
            </div>
          </div>

          {/* Title & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ชื่อผลงาน / หัวข้อแอสเซท <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น: คุโระ ชินจิ (แวมไพร์มาเฟีย) หรือ Custom Kawaii UI"
                required
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850"
              />
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                หมวดหมู่หลัก (Category)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
              >
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key} className="dark:bg-slate-800">
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Custom Folder Assignment (Optional) */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FolderIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>โฟลเดอร์จัดเก็บในคลัง (Custom Folder)</span>
              </label>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
              >
                <option value="">(ไม่ระบุโฟลเดอร์ / เก็บที่หน้ารวม)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id} className="dark:bg-slate-800">
                    {f.icon || '📁'} {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Icon Chooser (Emoji, Kaomoji, Upload) */}
          <div className="space-y-2 p-4 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🎨 ไอคอนประจำผลงาน (Custom Icon)</span>
              </label>
              
              {/* Type Switcher */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-purple-100 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setIconType('emoji')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    iconType === 'emoji' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'text-slate-500'
                  }`}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  onClick={() => setIconType('kaomoji')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    iconType === 'kaomoji' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'text-slate-500'
                  }`}
                >
                  Kaomoji
                </button>
                <button
                  type="button"
                  onClick={() => setIconType('image')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    iconType === 'image' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'text-slate-500'
                  }`}
                >
                  อัปโหลดรูป
                </button>
              </div>
            </div>

            {/* Icon Picker Body */}
            <div className="pt-2">
              {iconType === 'emoji' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-2 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800">
                      {iconValue || '🌸'}
                    </span>
                    <input
                      type="text"
                      value={iconValue}
                      onChange={(e) => setIconValue(e.target.value)}
                      placeholder="พิมพ์หรือวาง Emoji"
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {POPULAR_EMOJIS.map((em, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setIconValue(em)}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900 text-base flex items-center justify-center border border-purple-100 dark:border-slate-700 transition-transform active:scale-95"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {iconType === 'kaomoji' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800 font-mono text-sm text-purple-800 dark:text-purple-200 font-bold">
                      {iconValue || '(づ｡◕‿‿◕｡)づ'}
                    </span>
                    <input
                      type="text"
                      value={iconValue}
                      onChange={(e) => setIconValue(e.target.value)}
                      placeholder="พิมพ์ Kaomoji ตามต้องการ"
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {KAOMOJI_COLLECTIONS.map((groupObj, gIdx) => (
                      <div key={gIdx} className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                          {groupObj.group}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {groupObj.items.map((kaoStr, kIdx) => (
                            <button
                              key={kIdx}
                              type="button"
                              onClick={() => setIconValue(kaoStr)}
                              className={`px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900 text-xs font-mono text-purple-800 dark:text-purple-200 border transition-all active:scale-95 ${
                                iconValue === kaoStr
                                  ? 'border-purple-500 ring-2 ring-purple-300 dark:ring-purple-700'
                                  : 'border-purple-100 dark:border-slate-700'
                              }`}
                            >
                              {kaoStr}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {iconType === 'image' && (
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={iconImageInputRef}
                    onChange={handleIconImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  {iconValue && iconValue.startsWith('data:') ? (
                    <img
                      src={iconValue}
                      alt="Icon preview"
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-purple-300 dark:ring-purple-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-300">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => iconImageInputRef.current?.click()}
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold border border-purple-200 dark:border-slate-700 flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกรูปภาพ / GIF จากเครื่อง</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content (Notes, Prompt, Character Lore) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>เนื้อหาหลัก / โน้ต / Character Definition / Prompt</span>
              </label>

              {onOpenAIModalWithContext && (
                <button
                  type="button"
                  onClick={() => onOpenAIModalWithContext(category, content)}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1"
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