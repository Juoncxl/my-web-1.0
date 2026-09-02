import React, { useEffect, useState } from 'react';
import { Asset, AssetCategory, AssetIcon, Folder, AssetVisibility, AssetStatus } from '../types';
import { AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AssetEditorStatusSection } from './asset-editor/AssetEditorStatusSection';
import { AssetEditorIdentitySection } from './asset-editor/AssetEditorIdentitySection';
import { AssetEditorOrganizationSection } from './asset-editor/AssetEditorOrganizationSection';
import { AssetEditorContentSection, AssetTemplateType } from './asset-editor/AssetEditorContentSection';
import { AssetEditorLinkedAssetsSection } from './asset-editor/AssetEditorLinkedAssetsSection';
import { AssetEditorMediaSection } from './asset-editor/AssetEditorMediaSection';
import { AssetEditorTagsSection } from './asset-editor/AssetEditorTagsSection';
import { AssetEditorActions } from './asset-editor/AssetEditorActions';
import { normalizeAssetVisibility } from '../lib/assetVisibility';

export { QUICK_APP_TAGS } from './asset-editor/AssetEditorTagsSection';

interface AssetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: Partial<Asset>) => Promise<{ success: boolean; error?: string } | boolean>;
  initialData?: Asset | null;
  folders?: Folder[];
  availableAssets?: Asset[];
  onOpenAIModalWithContext?: (type: string, context: string) => void;
}

export const AssetEditorModal: React.FC<AssetEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  folders = [],
  availableAssets = [],
  onOpenAIModalWithContext
}) => {
  const { currentUser } = useAuth();

  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState<AssetCategory>(initialData?.category || 'character');
  const [content, setContent] = useState(initialData?.content || '');
  const [uiCodeSnippet, setUiCodeSnippet] = useState(initialData?.uiCodeSnippet || '');
  const [visibility, setVisibility] = useState<AssetVisibility>(
    normalizeAssetVisibility({ visibility: initialData?.visibility, isPublic: initialData?.isPublic }).visibility
  );
  const [status, setStatus] = useState<AssetStatus>(initialData?.status || 'finished');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInputValue, setTagInputValue] = useState('');
  const [folderId, setFolderId] = useState<string | null>(initialData?.folderId || null);
  const [linkedAssetIds, setLinkedAssetIds] = useState<string[]>(initialData?.linkedAssetIds || []);
  const [iconType, setIconType] = useState<'emoji' | 'kaomoji' | 'image'>(initialData?.icon?.type || 'emoji');
  const [iconValue, setIconValue] = useState(initialData?.icon?.value || '🌸');
  const [iconStorageKey, setIconStorageKey] = useState<string | undefined>(initialData?.icon?.storageKey);
  const [iconMimeType, setIconMimeType] = useState<string | undefined>(initialData?.icon?.mimeType);
  const [previewImages, setPreviewImages] = useState<string[]>(
    initialData?.previewImages && initialData.previewImages.length > 0
      ? initialData.previewImages
      : (initialData?.previewImage ? [initialData.previewImage] : [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setCategory(initialData.category);
      setContent(initialData.content);
      setUiCodeSnippet(initialData.uiCodeSnippet || '');
      setVisibility(normalizeAssetVisibility({ visibility: initialData.visibility, isPublic: initialData.isPublic }).visibility);
      setStatus(initialData.status || 'finished');
      setTags(initialData.tags || []);
      setTagInputValue('');
      setIconType(initialData.icon?.type || 'emoji');
      setIconValue(initialData.icon?.value || '🌸');
      setIconStorageKey(initialData.icon?.storageKey);
      setIconMimeType(initialData.icon?.mimeType);
      setFolderId(initialData.folderId || null);
      setLinkedAssetIds(initialData.linkedAssetIds || []);

      const images = initialData.previewImages && initialData.previewImages.length > 0
        ? initialData.previewImages
        : (initialData.previewImage ? [initialData.previewImage] : []);
      setPreviewImages(images);
    } else {
      setTitle('');
      setCategory('character');
      setContent('');
      setUiCodeSnippet('');
      setVisibility('public');
      setStatus('finished');
      setTags([]);
      setTagInputValue('');
      setIconType('emoji');
      setIconValue('🌸');
      setIconStorageKey(undefined);
      setIconMimeType(undefined);
      setFolderId(null);
      setLinkedAssetIds([]);
      setPreviewImages([]);
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  const handleAddTag = () => {
    const clean = tagInputValue.trim().replace(/^#/, '');
    if (!clean) return;
    if (tags.length >= 10) {
      setErrorMsg('สามารถเพิ่มแท็กได้สูงสุด 10 แท็ก (กรุณาลบแท็กเดิมออกก่อนเพิ่มแท็กใหม่)');
      return;
    }
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInputValue('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleTagInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleAddTag();
    }
  };

  const handleToggleAppTag = (appTag: string) => {
    const clean = appTag.trim();
    if (tags.includes(clean)) {
      setTags(tags.filter((tag) => tag !== clean));
    } else {
      if (tags.length >= 10) {
        setErrorMsg('สามารถเพิ่มแท็กได้สูงสุด 10 แท็ก (กรุณาลบแท็กเดิมออกก่อนเพิ่มแท็กใหม่)');
        return;
      }
      setErrorMsg('');
      setTags([...tags, clean]);
    }
  };

  const toggleLinkedAsset = (assetId: string) => {
    setLinkedAssetIds((previousIds) =>
      previousIds.includes(assetId) ? previousIds.filter((id) => id !== assetId) : [...previousIds, assetId]
    );
  };

  const applyTemplate = (type: AssetTemplateType) => {
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMsg('กรุณากรอกชื่อเรื่องของผลงาน');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalTags = tags.map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean);
      const icon: AssetIcon = {
        type: iconType,
        value: iconValue,
        storageKey: iconType === 'image' ? iconStorageKey : undefined,
        mimeType: iconType === 'image' ? iconMimeType : undefined
      };
      const payload: Partial<Asset> = {
        title: title.trim(),
        icon,
        category,
        content: content.trim(),
        uiCodeSnippet: uiCodeSnippet.trim(),
        previewImage: previewImages[0] || '',
        previewImages,
        folderId: folderId || null,
        isPublic: visibility === 'public',
        visibility,
        status,
        linkedAssetIds,
        tags: finalTags,
        authorName: currentUser?.displayName || 'Anonymous Creator',
        authorAvatar: currentUser?.avatarUrl || ''
      };

      const result = await onSave(payload);
      const isSuccess = typeof result === 'boolean' ? result : result?.success;
      const saveError = typeof result === 'object' && result?.error
        ? result.error
        : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง';

      if (isSuccess) {
        onClose();
      } else {
        setErrorMsg(saveError);
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : undefined;
      setErrorMsg(message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-start justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-900 dark:text-rose-100 text-xs">
                    ⚠️ แจ้งเตือนข้อผิดพลาด (Database / Save Alert)
                  </h4>
                  <p className="text-[11.5px] leading-relaxed break-words font-mono text-rose-700 dark:text-rose-300">
                    {errorMsg}
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    💡 ข้อความและไฟล์ทั้งหมดที่คุณกรอกยังถูกเก็บไว้ในหน้านี้อย่างปลอดภัย คุณสามารถแก้ไขข้อมูลแล้วกดบันทึกใหม่ได้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="p-1 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors shrink-0"
                title="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <AssetEditorStatusSection
            visibility={visibility}
            status={status}
            onVisibilityChange={setVisibility}
            onStatusChange={setStatus}
          />
          <AssetEditorIdentitySection
            title={title}
            iconType={iconType}
            iconValue={iconValue}
            onTitleChange={setTitle}
            onIconChange={(icon) => {
              setIconType(icon.type);
              setIconValue(icon.value);
              setIconStorageKey(icon.storageKey);
              setIconMimeType(icon.mimeType);
            }}
            onError={setErrorMsg}
          />
          <AssetEditorOrganizationSection
            category={category}
            folderId={folderId}
            folders={folders}
            onCategoryChange={setCategory}
            onFolderChange={setFolderId}
          />
          <AssetEditorContentSection
            content={content}
            uiCodeSnippet={uiCodeSnippet}
            onContentChange={setContent}
            onUiCodeSnippetChange={setUiCodeSnippet}
            onApplyTemplate={applyTemplate}
            onOpenAIModalWithContext={onOpenAIModalWithContext}
          />
          <AssetEditorLinkedAssetsSection
            availableAssets={availableAssets}
            currentAssetId={initialData?.id}
            linkedAssetIds={linkedAssetIds}
            onToggleLinkedAsset={toggleLinkedAsset}
          />
          <AssetEditorMediaSection
            previewImages={previewImages}
            onPreviewImagesChange={setPreviewImages}
            onError={setErrorMsg}
          />
          <AssetEditorTagsSection
            tags={tags}
            tagInputValue={tagInputValue}
            onTagInputValueChange={setTagInputValue}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onTagInputKeyDown={handleTagInputKeyDown}
            onToggleAppTag={handleToggleAppTag}
          />
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>©</span>
            <span>ระบบจะบันทึกวันและเวลาที่สร้างผลงานอัตโนมัติ เพื่อเป็นหลักฐานยืนยันความคิดริเริ่มและลิขสิทธิ์ของคุณ</span>
          </div>
        </form>

        <AssetEditorActions
          isSubmitting={isSubmitting}
          isEditing={Boolean(initialData)}
          onClose={onClose}
          onSubmit={() => void handleSubmit({ preventDefault: () => undefined } as React.FormEvent)}
        />
      </div>
    </div>
  );
};
