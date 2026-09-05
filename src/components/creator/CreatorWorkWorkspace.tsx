import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Asset, AssetCategory, AssetIcon, AssetStatus, AssetVisibility, Folder, User, WorkContentBlock, WorkContentBlockType } from '../../types';
import { normalizeAssetVisibility } from '../../lib/assetVisibility';
import { SandboxedCodePreview } from '../SandboxedCodePreview';
import { CreatorContentCanvas, CreatorFocusEditor, type CreatorUiCodeView } from './CreatorContentCanvas';
import { CreatorMediaCollection } from './CreatorMediaCollection';
import { CreatorCollabPanel } from './CreatorCollabPanel';
import { CreatorReviewPreview } from './CreatorReviewPreview';
import { createCreatorContentBlocks, getCreatorReviewMissingNotices, type CreatorReviewMode } from './creatorReviewModel';
import { cloneCreatorCollaborationDraft, createBlankCollaborationDraft, createCollabDraftFromPublicContentBlocks, createCollabDraftFromPublicSnapshot, isPublicCollabContentBlock, type CreatorCollaborationDraft } from './creatorCollabModel';
import { serializeCreatorWorkDraft } from './creatorWorkSerializer';
import {
  addMediaItem,
  createBlankMediaDraft,
  createMediaDraftFromLegacy,
  createMediaItem,
  CREATOR_MEDIA_MAX_ITEMS,
  getCoverMedia,
  isSupportedCreatorGlobalMediaFile,
  mediaDraftToPreviewImages,
  removeMediaItem,
  replaceMediaItem,
  reorderMediaItem,
  setMediaItemDimensions,
  setCoverMedia,
  type CreatorMediaDraft
} from './creatorMediaModel';
import {
  CREATOR_CONTENT_TYPE_META,
  createBlankContentCanvasDraft,
  createContentCanvasDraftFromLegacy,
  cloneContentCanvasDraft,
  getContentEditorValue,
  normalizeCreatorContentTypes as normalizeCanvasContentTypes,
  updateContentEditorValue,
  type CreatorContentCanvasDraft,
  type CreatorContentCounterMode,
  type CreatorContentEditorId,
  type CreatorContentType
} from './creatorContentModel';

type WorkSection = 'details' | 'content' | 'media' | 'collab' | 'settings' | 'review';
export type WorkBlockType = WorkContentBlockType;
type WorkIconKind = 'emoji' | 'image' | 'gif';
type WorkBlock = WorkContentBlock;
type FocusEditorTarget = { id: CreatorContentEditorId; title: string };

export type { CreatorContentType } from './creatorContentModel';
export type CreatorWorkMode = 'standard' | 'collab';
export type CreatorAudienceRating = 'general' | '13_plus' | '16_plus' | '18_plus';
export type CreatorPublicationStatus = 'draft' | 'published';
export type CreatorWorkStatus = 'not_started' | 'in_progress' | 'waiting_data' | 'in_review' | 'needs_fix' | 'blocked' | 'paused' | 'finished';

export const CREATOR_CONTENT_TYPES = CREATOR_CONTENT_TYPE_META;

export const CREATOR_PLATFORM_OPTIONS = ['Doki Chat', 'Khui AI', 'Rubii', 'Puean AI', 'LoveyDovey', 'By me chocolate', 'Joylada', 'Character.AI', 'SillyTavern', 'อื่น ๆ'];
export const CREATOR_AUDIENCE_OPTIONS: Array<{ value: CreatorAudienceRating; label: string }> = [
  { value: 'general', label: '🟢 ทั่วไป' },
  { value: '13_plus', label: '🟡 13+' },
  { value: '16_plus', label: '🟠 16+' },
  { value: '18_plus', label: '🔞 18+' }
];
export const CREATOR_WORK_STATUS_OPTIONS: Array<{ value: CreatorWorkStatus; label: string }> = [
  { value: 'not_started', label: '⚪ ยังไม่เริ่ม' },
  { value: 'in_progress', label: '🟡 กำลังทำ' },
  { value: 'waiting_data', label: '🟠 รอข้อมูล' },
  { value: 'in_review', label: '🔵 รอตรวจ' },
  { value: 'needs_fix', label: '🟣 รอแก้ไข' },
  { value: 'blocked', label: '🔴 ติดปัญหา' },
  { value: 'paused', label: '⏸️ พักไว้' },
  { value: 'finished', label: '🟢 เสร็จแล้ว' }
];
export const CREATOR_CONTENT_WARNING_OPTIONS = ['ความรุนแรง', 'เลือด', 'เนื้อหาทางเพศ', 'ภาษารุนแรง', 'สยองขวัญ', 'สารเสพติด', 'ความสัมพันธ์เป็นพิษ', 'การทำร้ายตนเอง', 'อื่น ๆ'];
export const CREATOR_GENRE_OPTIONS = ['โรแมนซ์', 'รักใส ๆ / ฟีลกู๊ด', 'มหาวิทยาลัย', 'วัยเรียน', 'มาเฟีย / อาชญากรรม', 'ดราม่า', 'คอมเมดี้', 'แฟนตาซี', 'เหนือธรรมชาติ', 'โอเมก้าเวิร์ส', 'สยองขวัญ', 'สืบสวน / ระทึกขวัญ', 'แอ็กชัน', 'ไซไฟ', 'พีเรียด / ย้อนยุค', 'ชีวิตประจำวัน', 'โลกสมมติ / สร้างโลก'];
export const CREATOR_EMOJI_OPTIONS = ['✨', '🌙', '💜', '🔥', '🎭', '📖', '🎨', '💻', '🐉', '🐺', '🌊', '✦'];

export interface CreatorWorkDraft {
  title: string;
  category: AssetCategory;
  contentTypes: CreatorContentType[];
  workMode: CreatorWorkMode;
  /** Composer-only axes; the existing Asset payload remains unchanged. */
  publicationStatus: CreatorPublicationStatus;
  workStatus: CreatorWorkStatus;
  description: string;
  visibility: AssetVisibility;
  status: AssetStatus;
  folderId: string | null;
  icon: AssetIcon;
  content: string;
  contentBlocks: WorkContentBlock[];
  uiCodeSnippet: string;
  previewImages: string[];
  coverImage: string;
  mediaDraft: CreatorMediaDraft;
  tags: string[];
  appPlatforms: string[];
  audienceRating: CreatorAudienceRating;
  contentWarnings: string[];
  genres: string[];
  contentCanvas: CreatorContentCanvasDraft;
  collaboration: CreatorCollaborationDraft;
  collaborationAssetId: string | null;
}

export function createBlankCreatorWorkDraft(): CreatorWorkDraft {
  return {
    title: '', category: 'prompts', contentTypes: [], workMode: 'standard', publicationStatus: 'draft', workStatus: 'not_started', description: '', visibility: 'private', status: 'idea', folderId: null,
    icon: { type: 'emoji', value: '✦' }, content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: [], coverImage: '', mediaDraft: createBlankMediaDraft(), tags: [], appPlatforms: [], audienceRating: 'general', contentWarnings: [], genres: [], contentCanvas: createBlankContentCanvasDraft(), collaboration: createBlankCollaborationDraft(), collaborationAssetId: null
  };
}

export function buildWorkDraftPreview(draft: CreatorWorkDraft): CreatorWorkDraft {
  return {
    ...draft,
    title: draft.title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    description: draft.description.trim(),
    contentTypes: [...draft.contentTypes],
    content: draft.content,
    contentBlocks: draft.contentBlocks.map(block => ({ ...block })),
    tags: [...draft.tags],
    previewImages: [...draft.previewImages],
    coverImage: draft.coverImage,
    mediaDraft: { items: draft.mediaDraft.items.map(item => ({ ...item })), coverId: draft.mediaDraft.coverId },
    appPlatforms: [...draft.appPlatforms],
    contentWarnings: [...draft.contentWarnings],
    genres: [...draft.genres],
    contentCanvas: cloneContentCanvasDraft(draft.contentCanvas),
    collaboration: cloneCreatorCollaborationDraft(draft.collaboration),
    collaborationAssetId: draft.collaborationAssetId
  };
}

interface CreatorWorkWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: CreatorWorkDraft) => Promise<{ success: boolean; error?: string }>;
  initialData?: Asset | null;
  creatorProfile?: User | null;
  folders?: Folder[];
  ownedWorks?: Asset[];
}

function contentTypeToAssetCategory(value: CreatorContentType): AssetCategory { if (value === 'character') return 'character'; if (value === 'lore') return 'lore'; if (value === 'ui_code') return 'ui_code'; return 'prompts'; }
export function normalizeCreatorContentTypes(category: AssetCategory, values?: CreatorContentType[]): CreatorContentType[] {
  return normalizeCanvasContentTypes(category, values);
}
function contentTypesToAssetCategory(values: CreatorContentType[]): AssetCategory { return contentTypeToAssetCategory(values[0] || 'bot_prompt'); }
function fromAssetVisibility(value: AssetVisibility): AssetVisibility { return value === 'public' ? 'public' : 'private'; }
function visibilityLabel(value: AssetVisibility): string { return value === 'public' ? '🌐 สาธารณะ' : '🔒 ส่วนตัว'; }
function toggleSelection<T extends string>(values: T[], value: T): T[] { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }

function publicationStatusFromAsset(asset: Asset): CreatorPublicationStatus {
  return asset.visibility === 'draft' || asset.status === 'draft' ? 'draft' : 'published';
}

function workStatusFromAsset(value: AssetStatus): CreatorWorkStatus {
  if (value === 'finished') return 'finished';
  if (value === 'archived') return 'paused';
  if (value === 'in_progress') return 'in_progress';
  return 'not_started';
}

function workStatusToAssetStatus(value: CreatorWorkStatus): AssetStatus {
  if (value === 'finished') return 'finished';
  if (value === 'paused') return 'archived';
  if (value === 'in_progress') return 'in_progress';
  // Keep the legacy Asset contract valid while the richer Composer status
  // remains in the in-memory draft model until its persistence contract is expanded.
  return value === 'not_started' ? 'idea' : 'in_progress';
}

function serializeMainContentBlocks(blocks: WorkContentBlock[]): string {
  return blocks
    .filter(block => block.type !== 'UI Code')
    .map(block => `## ${block.title}\n${block.body}`)
    .join('\n\n');
}

type GraphemeSegment = { segment: string };
type GraphemeSegmenter = {
  segment: (value: string) => Iterable<GraphemeSegment>;
};

/** Keep the Work Icon input bounded without cutting a multi-codepoint emoji. */
export function limitWorkIconInput(value: string, maxGraphemes = 4): string {
  if (!value || maxGraphemes <= 0) return '';
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
  }).Segmenter;
  // Older runtimes keep the entire value rather than risk returning a broken
  // surrogate/ZWJ sequence. Supported browsers provide Intl.Segmenter.
  if (!Segmenter) return value;
  return Array.from(
    new Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
    part => part.segment
  ).slice(0, maxGraphemes).join('');
}

/** Convert persisted modern or legacy Work data into an isolated editable draft. */
export function createCreatorWorkDraftFromAsset(asset: Asset): CreatorWorkDraft {
  const storedContentBlocks = asset.contentBlocks?.map(block => ({ ...block })) || [];
  const restoredCollaboration = asset.collaboration
    ? cloneCreatorCollaborationDraft(asset.collaboration)
    : asset.publicCollaboration
      ? createCollabDraftFromPublicSnapshot(asset.publicCollaboration)
    : createCollabDraftFromPublicContentBlocks(storedContentBlocks);
  const contentBlocks = storedContentBlocks.filter(block => !isPublicCollabContentBlock(block));
  if (!contentBlocks.some(block => block.type !== 'UI Code') && asset.content.trim()) {
    contentBlocks.unshift({ id: `legacy-content-${asset.id}`, type: 'Text', title: 'เนื้อหาหลัก', body: asset.content });
  }
  if (!contentBlocks.some(block => block.type === 'UI Code') && asset.uiCodeSnippet) {
    contentBlocks.push({ id: `legacy-ui-code-${asset.id}`, type: 'UI Code', title: 'UI Code', body: asset.uiCodeSnippet });
  }

  const restoredCanvas = createContentCanvasDraftFromLegacy({
    category: asset.category,
    content: asset.content,
    contentBlocks,
    uiCodeSnippet: asset.uiCodeSnippet
  });
  restoredCanvas.imagePrompt.toolModel = asset.presentationMetadata?.imagePromptToolModel
    || contentBlocks.find(block => block.id.includes('image-tool-model') || block.title === 'เครื่องมือ / โมเดลที่ใช้')?.body
    || '';

  return {
    title: asset.title,
    category: asset.category,
    contentTypes: normalizeCreatorContentTypes(asset.category, asset.presentationMetadata?.contentTypes || asset.contentTypes),
    workMode: asset.category === 'collab' ? 'collab' : 'standard',
    publicationStatus: publicationStatusFromAsset(asset),
    workStatus: asset.presentationMetadata?.workStatus || workStatusFromAsset(asset.status || 'finished'),
    // A legacy main body must never silently become a short description.
    description: asset.shortDescription ?? '',
    visibility: fromAssetVisibility(normalizeAssetVisibility({ visibility: asset.visibility, isPublic: asset.isPublic }).visibility),
    status: workStatusToAssetStatus(workStatusFromAsset(asset.status || 'finished')),
    folderId: asset.folderId || null,
    icon: { ...asset.icon },
    content: serializeMainContentBlocks(contentBlocks),
    contentBlocks,
    uiCodeSnippet: contentBlocks.find(block => block.type === 'UI Code')?.body || '',
    previewImages: asset.previewImages?.length ? [...asset.previewImages] : (asset.previewImage ? [asset.previewImage] : []),
    coverImage: asset.previewImage || '',
    mediaDraft: createMediaDraftFromLegacy({ previewImages: asset.previewImages, previewImage: asset.previewImage }),
    tags: [...(asset.tags || [])],
    appPlatforms: [...(asset.presentationMetadata?.appPlatforms || [])],
    audienceRating: asset.presentationMetadata?.audienceRating || 'general',
    contentWarnings: [...(asset.presentationMetadata?.contentWarnings || [])],
    genres: [...(asset.presentationMetadata?.genres || [])],
    contentCanvas: restoredCanvas,
    collaboration: asset.category === 'collab' ? restoredCollaboration : createBlankCollaborationDraft(),
    collaborationAssetId: asset.category === 'collab' ? null : asset.collaborationAssetId || null
  };
}

export const CreatorWorkWorkspace: React.FC<CreatorWorkWorkspaceProps> = ({ isOpen, onClose, onSave, initialData = null, creatorProfile = null, folders = [], ownedWorks = [] }) => {
  const [section, setSection] = useState<WorkSection>('details');
  const [title, setTitle] = useState('');
  const [contentTypes, setContentTypes] = useState<CreatorContentType[]>([]);
  const [workMode, setWorkMode] = useState<CreatorWorkMode>('standard');
  const [publicationStatus, setPublicationStatus] = useState<CreatorPublicationStatus>('draft');
  const [workStatus, setWorkStatus] = useState<CreatorWorkStatus>('not_started');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<AssetVisibility>('private');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [contentCanvas, setContentCanvas] = useState<CreatorContentCanvasDraft>(createBlankContentCanvasDraft);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [appPlatforms, setAppPlatforms] = useState<string[]>([]);
  const [platformInput, setPlatformInput] = useState('');
  const [audienceRating, setAudienceRating] = useState<CreatorAudienceRating>('general');
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [warningInput, setWarningInput] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [iconKind, setIconKind] = useState<WorkIconKind>('emoji');
  const [iconValue, setIconValue] = useState('✦');
  const [iconImage, setIconImage] = useState('');
  const [iconStorageKey, setIconStorageKey] = useState<string | undefined>();
  const [iconMimeType, setIconMimeType] = useState<string | undefined>();
  const [mediaDraft, setMediaDraft] = useState<CreatorMediaDraft>(createBlankMediaDraft);
  const [collaboration, setCollaboration] = useState<CreatorCollaborationDraft>(createBlankCollaborationDraft);
  const [collaborationAssetId, setCollaborationAssetId] = useState<string | null>(null);
  const [reviewPreviewMode, setReviewPreviewMode] = useState<CreatorReviewMode>('card');
  const [counterMode, setCounterMode] = useState<CreatorContentCounterMode>('characters');
  const [uiCodeView, setUiCodeView] = useState<CreatorUiCodeView>('split');
  const [focusEditorTarget, setFocusEditorTarget] = useState<FocusEditorTarget | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [fullPreviewKind, setFullPreviewKind] = useState<CreatorReviewMode | 'ui-code'>('ui-code');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSection('details');
    setFocusEditorTarget(null);
    setFullPreviewOpen(false);
    setFullPreviewKind('ui-code');
    setReviewPreviewMode('card');
    setCounterMode('characters');
    setUiCodeView('split');
    setIsSaving(false);
    if (!initialData) {
      const blank = createBlankCreatorWorkDraft();
      setTitle(blank.title); setContentTypes(blank.contentTypes); setWorkMode(blank.workMode); setPublicationStatus(blank.publicationStatus); setWorkStatus(blank.workStatus); setDescription(blank.description); setVisibility(blank.visibility); setFolderId(blank.folderId);
      setBlocks(blank.contentBlocks); setContentCanvas(blank.contentCanvas);
      setTags(blank.tags); setTagInput(''); setAppPlatforms(blank.appPlatforms); setPlatformInput(''); setAudienceRating(blank.audienceRating); setContentWarnings(blank.contentWarnings); setWarningInput(''); setGenres(blank.genres); setIconKind('emoji'); setIconValue(blank.icon.value); setIconImage(''); setIconStorageKey(undefined); setIconMimeType(undefined); setMediaDraft(blank.mediaDraft); setCollaboration(blank.collaboration); setCollaborationAssetId(null);
      return;
    }

    const draft = createCreatorWorkDraftFromAsset(initialData);
    setTitle(draft.title);
    setContentTypes(draft.contentTypes);
    setWorkMode(draft.workMode);
    setPublicationStatus(draft.publicationStatus);
    setWorkStatus(draft.workStatus);
    setDescription(draft.description);
    setVisibility(draft.visibility);
    setFolderId(draft.folderId);
    setTags(draft.tags);
    setTagInput('');
    setAppPlatforms(draft.appPlatforms);
    setPlatformInput('');
    setAudienceRating(draft.audienceRating);
    setContentWarnings(draft.contentWarnings);
    setWarningInput('');
    setGenres(draft.genres);
    const isGif = draft.icon.type === 'image' && (draft.icon.mimeType === 'image/gif' || draft.icon.value.startsWith('data:image/gif'));
    setIconKind(draft.icon.type === 'emoji' ? 'emoji' : isGif ? 'gif' : 'image');
    setIconValue(draft.icon.type === 'emoji' ? draft.icon.value : '✦');
    setIconImage(draft.icon.type === 'emoji' ? '' : draft.icon.value);
    setIconStorageKey(draft.icon.type === 'image' ? draft.icon.storageKey : undefined);
    setIconMimeType(draft.icon.type === 'image' ? draft.icon.mimeType : undefined);
    setMediaDraft(draft.mediaDraft);
    setCollaboration(draft.collaboration);
    setCollaborationAssetId(draft.collaborationAssetId);
    setBlocks(draft.contentBlocks);
    setContentCanvas(draft.contentCanvas);
  }, [initialData, isOpen]);
  const persistedContentBlocks = useMemo(() => {
    return createCreatorContentBlocks(contentTypes, contentCanvas);
  }, [contentCanvas, contentTypes]);
  const draftContent = useMemo(() => serializeMainContentBlocks(persistedContentBlocks), [persistedContentBlocks]);
  const uiCodeSnippet = useMemo(() => contentCanvas.uiCode || blocks.find(block => block.type === 'UI Code')?.body || '', [blocks, contentCanvas.uiCode]);
  const mediaPreviewImages = useMemo(() => mediaDraftToPreviewImages(mediaDraft), [mediaDraft]);
  const coverImage = useMemo(() => getCoverMedia(mediaDraft)?.src || '', [mediaDraft]);
  const draftPreview = useMemo(() => buildWorkDraftPreview({
    title: workMode === 'collab'
      ? collaboration.name.trim() || 'ยังไม่ได้ตั้งชื่อคอลแลป'
      : title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
     category: workMode === 'collab' ? 'collab' : contentTypesToAssetCategory(contentTypes),
    contentTypes,
    workMode,
    description: description.trim(),
    visibility,
    status: workStatusToAssetStatus(workStatus),
    publicationStatus,
    workStatus,
    folderId,
    icon: iconKind === 'emoji'
      ? { type: 'emoji' as const, value: iconValue || '✦' }
      : { type: 'image' as const, value: iconImage, storageKey: iconStorageKey, mimeType: iconMimeType },
    content: draftContent,
    contentBlocks: persistedContentBlocks,
    uiCodeSnippet,
    previewImages: mediaPreviewImages,
    coverImage,
    mediaDraft,
    tags,
    appPlatforms,
    audienceRating,
    contentWarnings,
    genres,
    contentCanvas,
    collaboration,
    collaborationAssetId
  }), [appPlatforms, audienceRating, collaboration, collaborationAssetId, contentCanvas, contentTypes, contentWarnings, coverImage, description, draftContent, folderId, genres, iconImage, iconKind, iconMimeType, iconStorageKey, iconValue, mediaDraft, mediaPreviewImages, persistedContentBlocks, publicationStatus, tags, title, uiCodeSnippet, visibility, workStatus, workMode]);
  const reviewAsset = useMemo(() => {
    const serialized = serializeCreatorWorkDraft({
      ...draftPreview,
      imagePromptToolModel: draftPreview.contentCanvas.imagePrompt.toolModel
    });
    const now = new Date().toISOString();
    return {
      id: 'creator-composer-preview',
      userId: creatorProfile?.id || 'creator-preview-user',
      authorName: creatorProfile?.displayName || 'คุณ',
      authorAvatar: creatorProfile?.avatarUrl,
      ...serialized,
      createdAt: now,
      updatedAt: now,
      likesCount: 0,
      forkCount: 0,
      linkedAssetIds: [],
      versions: []
    } satisfies Asset;
  }, [creatorProfile, draftPreview]);
  const reviewMissingNotices = getCreatorReviewMissingNotices({ title, coverImage, collaborationTitle: workMode === 'collab' ? collaboration.name : '' });
  const availableCollaborations = useMemo(() => ownedWorks.filter(work => work.userId === creatorProfile?.id && work.category === 'collab' && work.id !== initialData?.id && !work.deletedAt), [creatorProfile?.id, initialData?.id, ownedWorks]);
  if (!isOpen) return null;

  const handleMediaUpload = (files: File[]) => {
    const remaining = Math.max(0, CREATOR_MEDIA_MAX_ITEMS - mediaDraft.items.length);
    if (files.length > remaining) { setError(`ผลงานหนึ่งชิ้นเพิ่มสื่อได้สูงสุด ${CREATOR_MEDIA_MAX_ITEMS} รูป`); return; }
    files.forEach(file => {
      if (!isSupportedCreatorGlobalMediaFile(file)) { setError('รองรับไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 10MB ต่อรูป'); return; }
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') setMediaDraft(previous => addMediaItem(previous, createMediaItem(reader.result as string, file.type))); };
      reader.readAsDataURL(file);
    });
  };
  const handleMediaReplace = (itemId: string, file: File) => {
    if (!isSupportedCreatorGlobalMediaFile(file)) { setError('รองรับไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 10MB ต่อรูป'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setMediaDraft(previous => replaceMediaItem(previous, itemId, createMediaItem(reader.result as string, file.type, itemId))); };
    reader.readAsDataURL(file);
  };
  const handleIconFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') { setIconImage(reader.result); setIconStorageKey(undefined); setIconMimeType(file.type); } }; reader.readAsDataURL(file); setIconKind(file.type === 'image/gif' ? 'gif' : 'image'); };
  const addTag = () => { const clean = tagInput.trim().replace(/^#/, ''); if (!clean || tags.includes(clean) || tags.length >= 10) return; setTags(previous => [...previous, clean]); setTagInput(''); };
  const addPlatform = () => { const clean = platformInput.trim(); if (!clean || appPlatforms.includes(clean)) return; setAppPlatforms(previous => [...previous, clean]); setPlatformInput(''); };
  const addWarning = () => { const clean = warningInput.trim(); if (!clean || contentWarnings.includes(clean)) return; setContentWarnings(previous => [...previous, clean]); setWarningInput(''); };
  const updateCanvas = (next: CreatorContentCanvasDraft) => {
    setContentCanvas(next);
    if (next.uiCode !== contentCanvas.uiCode) {
      setBlocks(previous => {
        const uiIndex = previous.findIndex(block => block.type === 'UI Code');
        if (uiIndex < 0) return next.uiCode ? [...previous, { id: `ui-code-canvas-${Date.now()}`, type: 'UI Code', title: 'โค้ดหน้า UI', body: next.uiCode }] : previous;
        const updated = [...previous];
        updated[uiIndex] = { ...updated[uiIndex], body: next.uiCode };
        return updated;
      });
    }
  };
  const handleContentEditorExpand = (id: CreatorContentEditorId, title: string) => setFocusEditorTarget({ id, title });
  const focusedEditor = focusEditorTarget ? getContentEditorValue(contentCanvas, focusEditorTarget.id) : null;
  const handleWorkModeChange = (nextMode: CreatorWorkMode) => {
    setWorkMode(nextMode);
    if (nextMode === 'collab') setCollaborationAssetId(null);
    if (nextMode !== 'collab' && section === 'collab') setSection('details');
  };
  const saveWork = async () => {
    const requiredTitle = workMode === 'collab' ? collaboration.name.trim() : title.trim();
    if (!requiredTitle) {
      setError(workMode === 'collab' ? 'กรุณาตั้งชื่อคอลแลปก่อนสร้าง' : `กรุณาตั้งชื่อผลงานก่อน${initialData ? 'บันทึก' : 'สร้าง'}`);
      setSection(workMode === 'collab' ? 'collab' : 'details');
      return;
    }
    setIsSaving(true); setError('');
    const result = await onSave(draftPreview);
    setIsSaving(false); if (!result.success) { setError(result.error || (initialData ? 'แก้ไขผลงานไม่สำเร็จ' : 'สร้างผลงานไม่สำเร็จ')); return; } onClose();
  };

  return <div className="csp-modal-backdrop" role="presentation"><section className="csp-work-modal" data-review-actions={section === 'review'} role="dialog" aria-modal="true" aria-labelledby="csp-work-title">
    <header className="csp-modal-header csp-composer-header"><div><h2 id="csp-work-title">{initialData ? 'แก้ไขผลงาน' : 'สร้างผลงานใหม่'}</h2><p>กำหนดตัวตนและการจัดหมวดหมู่ของผลงาน</p></div><button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิดหน้าต่างสร้างผลงาน"><X className="h-4 w-4" /></button></header>
    <nav className="csp-work-nav" aria-label="เมนูพื้นที่ทำงานผลงาน">{([['details', 'ข้อมูลผลงาน'], ['content', 'เนื้อหา'], ['media', 'สื่อ'], ...(workMode === 'collab' ? [['collab', 'คอลแลป'] as const] : []), ['settings', 'การตั้งค่าผลงาน'], ['review', 'ตรวจสอบ']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? 'is-active' : ''} onClick={() => setSection(value)}>{label}</button>)}</nav>
    <div className="csp-composer-alert">{error && <div className="csp-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด">×</button></div>}</div>
    <div className="csp-work-body"><main className="csp-work-main">
      {section === 'settings' && <section className="csp-work-section csp-composer-settings" aria-labelledby="csp-composer-settings-title">
        <div className="csp-section-heading"><div><h2 id="csp-composer-settings-title">การตั้งค่าผลงาน</h2><p>จัดการสถานะ การมองเห็น และข้อมูลช่วยจัดระเบียบผลงาน</p></div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>สถานะการเผยแพร่</h3><p>ผลงานนี้เผยแพร่แล้วหรือยัง</p></div><div className="csp-choice-row">{([['draft', '📝 แบบร่าง'], ['published', '✅ เผยแพร่แล้ว']] as const).map(([value, label]) => <button type="button" key={value} className={publicationStatus === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={publicationStatus === value} onClick={() => setPublicationStatus(value)}>{label}</button>)}</div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>การมองเห็น</h3><p>กำหนดว่าใครจะเห็นผลงานนี้</p></div><div className="csp-choice-row">{([['private', '🔒 ส่วนตัว'], ['public', '🌐 สาธารณะ']] as const).map(([value, label]) => <button type="button" key={value} className={visibility === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{label}</button>)}</div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>สถานะผลงาน</h3><p>บอกความคืบหน้าของผลงานนี้</p></div><div className="csp-choice-row">{CREATOR_WORK_STATUS_OPTIONS.map(option => <button type="button" key={option.value} className={workStatus === option.value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={workStatus === option.value} onClick={() => setWorkStatus(option.value)}>{option.label}</button>)}</div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>โฟลเดอร์</h3><p>เก็บผลงานไว้ในโฟลเดอร์ที่ต้องการ</p></div><select className="csp-taxonomy-select" value={folderId || ''} onChange={event => setFolderId(event.target.value || null)}><option value="">ไม่มีโฟลเดอร์</option>{folders.map(folder => <option value={folder.id} key={folder.id}>{folder.icon || '📁'} {folder.name}</option>)}</select></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>แอป / แพลตฟอร์ม</h3><p>เลือกได้มากกว่าหนึ่งรายการ และเพิ่มชื่อแพลตฟอร์มเองได้</p></div><div className="csp-selection-grid csp-taxonomy-options">{CREATOR_PLATFORM_OPTIONS.map(platform => <button type="button" key={platform} className={appPlatforms.includes(platform) ? 'csp-selection-chip is-selected' : 'csp-selection-chip'} aria-pressed={appPlatforms.includes(platform)} onClick={() => setAppPlatforms(previous => toggleSelection(previous, platform))}>{platform}</button>)}<div className="csp-selected-values">{appPlatforms.filter(platform => !CREATOR_PLATFORM_OPTIONS.includes(platform)).map(platform => <button type="button" key={platform} className="csp-selection-chip is-selected" onClick={() => setAppPlatforms(previous => previous.filter(item => item !== platform))}>{platform} ×</button>)}</div></div><div className="csp-inline-add"><input value={platformInput} onChange={event => setPlatformInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addPlatform(); } }} placeholder="ชื่อแอป / แพลตฟอร์มอื่น ๆ" aria-label="เพิ่มแอปหรือแพลตฟอร์ม" /><button type="button" className="csp-secondary-button" onClick={addPlatform}>+ เพิ่มเอง</button></div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>ระดับผู้ชม</h3><p>แยกจากคำเตือนเนื้อหา</p></div><div className="csp-choice-row csp-audience-options">{CREATOR_AUDIENCE_OPTIONS.map(option => <button type="button" key={option.value} className={audienceRating === option.value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={audienceRating === option.value} onClick={() => setAudienceRating(option.value)}>{option.label}</button>)}</div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>คำเตือนเนื้อหา</h3><p>เลือกได้มากกว่าหนึ่งรายการเพื่อช่วยจัดระเบียบผลงาน</p></div><div className="csp-selection-grid csp-taxonomy-options">{CREATOR_CONTENT_WARNING_OPTIONS.map(warning => <button type="button" key={warning} className={contentWarnings.includes(warning) ? 'csp-selection-chip is-selected' : 'csp-selection-chip'} aria-pressed={contentWarnings.includes(warning)} onClick={() => setContentWarnings(previous => toggleSelection(previous, warning))}>{warning}</button>)}{contentWarnings.filter(warning => !CREATOR_CONTENT_WARNING_OPTIONS.includes(warning)).map(warning => <button type="button" key={warning} className="csp-selection-chip is-selected" onClick={() => setContentWarnings(previous => previous.filter(item => item !== warning))}>{warning} ×</button>)}</div><div className="csp-inline-add"><input value={warningInput} onChange={event => setWarningInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addWarning(); } }} placeholder="คำเตือนอื่น ๆ" aria-label="เพิ่มคำเตือนเนื้อหา" /><button type="button" className="csp-secondary-button" onClick={addWarning}>+ เพิ่มเอง</button></div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>แนว</h3><p>เลือกได้หลายแนวตามลักษณะของผลงาน</p></div><div className="csp-selection-grid csp-taxonomy-options">{CREATOR_GENRE_OPTIONS.map(genre => <button type="button" key={genre} className={genres.includes(genre) ? 'csp-selection-chip is-selected' : 'csp-selection-chip'} aria-pressed={genres.includes(genre)} onClick={() => setGenres(previous => toggleSelection(previous, genre))}>{genre}</button>)}</div></div>
        <div className="csp-taxonomy-group"><div className="csp-taxonomy-heading"><h3>แท็กกำหนดเอง</h3><p>เพิ่มคำที่ช่วยค้นหาและจัดกลุ่มผลงานได้ตามต้องการ</p></div><div className="csp-tag-list">{tags.map(tag => <button type="button" key={tag} onClick={() => setTags(previous => previous.filter(item => item !== tag))}>#{tag} ×</button>)}</div><div className="csp-inline-add"><input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="เช่น ศัตรูกลายเป็นคนรัก" aria-label="เพิ่มแท็กกำหนดเอง" /><button type="button" className="csp-secondary-button" onClick={addTag}>+ เพิ่มแท็ก</button></div></div>
      </section>}
      {section === 'details' && <section className="csp-work-section csp-composer-setup"><div className="csp-section-heading"><div><h2>ข้อมูลพื้นฐาน</h2><p>ข้อมูลที่จะแสดงบนผลงานของคุณ</p></div><span>จำเป็น</span></div>{workMode === 'standard' ? <label className="csp-field">ชื่อผลงาน *<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="เช่น ระบบคู่หูใต้แสงจันทร์" /></label> : <div className="csp-collab-title-handoff"><strong>ชื่อการ์ดจะใช้ชื่อคอลแลป</strong><p>{collaboration.name.trim() || 'ยังไม่ได้ตั้งชื่อ — ไปกรอกในแท็บคอลแลป'}</p><button type="button" className="csp-secondary-button" onClick={() => setSection('collab')}>ไปตั้งชื่อคอลแลป</button></div>}<label className="csp-field">คำอธิบายสั้น <span className="csp-field-count">{description.length}/240</span><textarea value={description} maxLength={240} onChange={event => setDescription(event.target.value)} placeholder="ข้อความสั้นสำหรับการ์ดผลงานและตัวอย่าง" rows={4} /></label><div className="csp-composer-subsection"><div className="csp-section-heading"><div><h3>ประเภทเนื้อหา</h3><p>เลือกได้มากกว่าหนึ่งประเภท เพื่อกำหนดสิ่งที่ผลงานนี้จะประกอบด้วย</p></div><span>{contentTypes.length > 0 ? `${contentTypes.length} ประเภทที่เลือก` : "ยังไม่เลือก"}</span></div><div className="csp-selection-grid csp-content-type-grid">{CREATOR_CONTENT_TYPES.map(option => <button type="button" key={option.value} className={contentTypes.includes(option.value) ? 'csp-selection-card is-selected' : 'csp-selection-card'} aria-pressed={contentTypes.includes(option.value)} onClick={() => setContentTypes(previous => toggleSelection(previous, option.value))}><span className="csp-selection-mark" aria-hidden="true">{contentTypes.includes(option.value) ? '✓' : ''}</span><span className="csp-selection-copy"><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div></div><div className="csp-composer-subsection"><div className="csp-section-heading"><div><h3>รูปแบบผลงาน</h3><p>เลือกว่าผลงานนี้เป็นงานทั่วไปหรือทำร่วมกับผู้อื่น</p></div></div><div className="csp-choice-row">{([['standard', 'งานทั่วไป'], ['collab', 'คอลแลป']] as const).map(([value, label]) => <button type="button" key={value} className={workMode === value ? 'csp-choice-button is-selected' : 'csp-choice-button'} aria-pressed={workMode === value} onClick={() => handleWorkModeChange(value)}>{label}</button>)}</div></div>{workMode === 'standard' && <div className="csp-composer-subsection csp-collab-link-picker"><div className="csp-section-heading"><div><h3>คอลแลปที่เชื่อม</h3><p>เลือกคอลแลปของคุณได้สูงสุดหนึ่งรายการ หรือเว้นว่างไว้แล้วค่อยกลับมาเพิ่มภายหลัง</p></div></div><select className="csp-taxonomy-select" value={collaborationAssetId || ''} onChange={event => setCollaborationAssetId(event.target.value || null)}><option value="">ไม่เชื่อมกับคอลแลป</option>{availableCollaborations.map(collab => <option key={collab.id} value={collab.id}>{collab.publicCollaboration?.name || collab.title}</option>)}</select>{availableCollaborations.length === 0 && <small>ยังไม่มีคอลแลปของคุณที่พร้อมให้เลือก</small>}</div>}<div className="csp-composer-subsection"><div className="csp-section-heading"><div><h3>ไอคอนผลงาน</h3><p>เลือกอิโมจิ ใส่ของคุณเอง หรืออัปโหลดรูป / GIF</p></div></div><div className="csp-unified-icon-picker"><div className="csp-icon-preview">{iconKind === 'emoji' ? iconValue || '✦' : iconImage ? <img src={iconImage} alt="ตัวอย่างไอคอนผลงาน" /> : '✦'}</div><div className="csp-icon-picker-options"><span className="csp-option-label">อิโมจิแนะนำ</span><div className="csp-emoji-suggestions">{CREATOR_EMOJI_OPTIONS.map(emoji => <button type="button" key={emoji} className={iconKind === 'emoji' && iconValue === emoji ? 'is-selected' : ''} aria-label={'เลือกอิโมจิ ' + emoji} onClick={() => { setIconKind('emoji'); setIconValue(emoji); }}>{emoji}</button>)}</div><label className="csp-field">ใส่อิโมจิเอง<input value={iconKind === 'emoji' ? iconValue : ''} onChange={event => { setIconKind('emoji'); setIconValue(limitWorkIconInput(event.target.value)); }} aria-label="ใส่อิโมจิเอง" placeholder="เช่น 🌙" /></label><label className="csp-secondary-button csp-file-button">อัปโหลดรูป / GIF<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconFile} /></label></div></div></div></section>}
      {section === 'content' && <CreatorContentCanvas
        selectedContentTypes={contentTypes}
        draft={contentCanvas}
        counterMode={counterMode}
        onCounterModeChange={setCounterMode}
        onChange={updateCanvas}
        onExpand={handleContentEditorExpand}
        onGoToDetails={() => setSection('details')}
        onOpenFullPreview={() => { setFullPreviewKind('ui-code'); setFullPreviewOpen(true); }}
        uiCodeView={uiCodeView}
        onUiCodeViewChange={setUiCodeView}
      />}
      {section === 'media' && <CreatorMediaCollection
        draft={mediaDraft}
        onUpload={handleMediaUpload}
        onReplace={handleMediaReplace}
        onSetCover={itemId => setMediaDraft(previous => setCoverMedia(previous, itemId))}
        onRemove={itemId => setMediaDraft(previous => removeMediaItem(previous, itemId))}
        onReorder={(itemId, targetId) => setMediaDraft(previous => reorderMediaItem(previous, itemId, targetId))}
        onDimensions={(itemId, naturalWidth, naturalHeight) => setMediaDraft(previous => setMediaItemDimensions(previous, itemId, naturalWidth, naturalHeight))}
      />}
      {section === 'collab' && workMode === 'collab' && <CreatorCollabPanel
        draft={collaboration}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        platformOptions={CREATOR_PLATFORM_OPTIONS}
        counterMode={counterMode}
        onCounterModeChange={setCounterMode}
        creatorProfile={creatorProfile}
        ownedWorks={ownedWorks}
        currentWorkId={initialData?.id}
        onChange={setCollaboration}
      />}
      {section === 'review' && <section className="csp-work-section csp-review-work-section" aria-labelledby="csp-review-title">
        <div className="csp-section-heading csp-review-heading">
          <div><h2 id="csp-review-title">ตรวจสอบผลงาน</h2><p>ดูตัวอย่างก่อนสร้างผลงานจริง</p></div>
          {reviewMissingNotices.length > 0 && <div className="csp-review-notices" role="status">{reviewMissingNotices.map(notice => <span key={notice}>{notice}</span>)}</div>}
        </div>
        <div className="csp-review-mode-control">
          <span className="csp-review-mode-label">เลือกมุมมองตัวอย่าง</span>
          <div className="csp-review-mode-switcher" role="tablist" aria-label="รูปแบบตัวอย่างผลงาน">
            <button type="button" role="tab" aria-selected={reviewPreviewMode === 'card'} className={reviewPreviewMode === 'card' ? 'is-active' : ''} onClick={() => setReviewPreviewMode('card')}>🗂️ การ์ดผลงาน</button>
            <button type="button" role="tab" aria-selected={reviewPreviewMode === 'detail'} className={reviewPreviewMode === 'detail' ? 'is-active' : ''} onClick={() => setReviewPreviewMode('detail')}>📖 หน้ารายละเอียด</button>
          </div>
        </div>
        <CreatorReviewPreview
          asset={reviewAsset}
          mode={reviewPreviewMode}
          creatorProfile={creatorProfile}
          allAssets={ownedWorks}
          folders={folders}
          onOpenFullPreview={() => { setFullPreviewKind(reviewPreviewMode); setFullPreviewOpen(true); }}
        />
      </section>}
    </main></div>
    {section === 'review' && <footer className="csp-modal-footer"><span>{isSaving ? (initialData ? 'กำลังบันทึก…' : 'กำลังสร้าง…') : (initialData ? 'พร้อมบันทึกการแก้ไข' : 'พร้อมสร้างผลงาน')}</span><button type="button" className="csp-secondary-button" onClick={onClose}>ยกเลิก</button><button type="button" className="csp-primary-button" disabled={isSaving || !(workMode === 'collab' ? collaboration.name.trim() : title.trim())} onClick={() => void saveWork()}>{isSaving ? 'กำลังบันทึก…' : initialData ? 'บันทึกการแก้ไข' : 'สร้างผลงาน'}</button></footer>}
  </section>
  {focusEditorTarget && focusedEditor && <CreatorFocusEditor title={focusEditorTarget.title} value={focusedEditor.value} counterMode={counterMode} code={focusEditorTarget.id === 'ui-code'} onChange={value => updateCanvas(updateContentEditorValue(contentCanvas, focusEditorTarget.id, value))} onClose={() => setFocusEditorTarget(null)} />}
      {fullPreviewOpen && fullPreviewKind === 'ui-code' && <div className="csp-focus-preview-backdrop" role="presentation"><section className="csp-focus-preview" role="dialog" aria-modal="true" aria-labelledby="csp-focus-preview-title"><header className="csp-focus-editor-header"><div><span>พรีวิวเต็ม</span><h2 id="csp-focus-preview-title">โค้ดหน้า UI</h2></div><button type="button" className="csp-icon-button" onClick={() => setFullPreviewOpen(false)} aria-label="ปิดพรีวิวเต็ม">×</button></header><div className="csp-focus-preview-body"><SandboxedCodePreview code={contentCanvas.uiCode} minHeight="520px" /></div></section></div>}
      {fullPreviewOpen && fullPreviewKind !== 'ui-code' && <div className="csp-focus-preview-backdrop" role="presentation"><section className="csp-focus-preview csp-review-full-preview" role="dialog" aria-modal="true" aria-labelledby="csp-review-full-preview-title"><header className="csp-focus-editor-header"><div><span>พรีวิวเต็ม</span><h2 id="csp-review-full-preview-title">{fullPreviewKind === 'card' ? 'การ์ดผลงาน' : 'หน้ารายละเอียด'}</h2></div><button type="button" className="csp-icon-button" onClick={() => setFullPreviewOpen(false)} aria-label="ปิดพรีวิวเต็ม">×</button></header><div className="csp-focus-preview-body"><CreatorReviewPreview asset={reviewAsset} mode={fullPreviewKind} creatorProfile={creatorProfile} allAssets={ownedWorks} folders={folders} onOpenFullPreview={() => undefined} onClose={() => setFullPreviewOpen(false)} showFullButton={false} /></div></section></div>}
</div>;
};
