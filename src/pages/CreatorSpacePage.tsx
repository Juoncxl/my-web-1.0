import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Edit3, Globe2, Instagram, Link2, Mail, Plus, RefreshCw, Settings2, Share2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Asset, AssetCategory, Folder, ProfileSocialLink } from '../types';
import { CATEGORIES } from '../lib/constants';
import { isPublicFeedVisibility } from '../lib/assetVisibility';
import { AssetCard } from '../components/AssetCard';
import { WorkDetailModal } from '../components/WorkDetailModal';
import { FolderDetailModal } from '../components/FolderDetailModal';
import { Header } from '../components/Header';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { CreatorCustomizePanel, CreatorWidgetControls, type CreatorLayout, type CreatorWidgetType, type LockedPreset, CREATOR_WIDGET_ICONS, CREATOR_WIDGET_LABELS } from '../components/creator/CreatorCustomizePanel';
import { CreatorWidgetEditor, type CreatorWidgetConfig } from '../components/creator/CreatorWidgetEditor';
import { getCreatorVisibleAssets, useCreatorSpaceData } from '../hooks/useCreatorSpaceData';
import { isMockPersistence } from '../lib/persistenceMode';
import { readCreatorSpaceSettings, writeCreatorSpaceSettings } from '../lib/creatorPersistence';
import { anchorFreeGridCell, canAddFreePlacement, compactFreeLayout, constrainFreePlacementWidth, createFreeWidgetInstance, estimatePortfolioHeightRows, estimateWorkHeightRows, getFreePlacementId, getFreePlacementWidthOptions, getPortfolioShowcaseItems, getWorkCardSize, hydrateFreeWidgetInstances, hydrateSavedFreeLayout, materializeDerivedHeights, migrateFreeOrder, moveFreePlacement, normalizeFreePlacement, pixelsToFreeGridRows, pointerToFreeGridCell, removeFreePlacement, resolveFreePlacementPosition, resizeFreePlacement, shouldShowFreePlacementControls, updateFreeWidgetInstance, type FreeLayoutPlacement, type FreePlacementKind, type FreeWidgetInstance, type PortfolioDisplayLimit } from '../lib/creatorLayout';
import { parseCanonicalProfileLocation, resolveProfileView, type ProfileTab } from '../lib/profileRouting';
import { getCanonicalProfilePath, getCanonicalProfileSlug } from '../lib/profileIdentity';

interface CreatorSpacePageProps {
  // The canonical profile is the home for profile identity editing.
  onCreateAsset: () => void;
  onEditAsset?: (asset: Asset) => void;
  slug: string;
  onOpenAuth: () => void;
  onOpenFolderManager?: () => void;
  onOpenMoveToFolder?: (asset: Asset) => void;
  onMoveAssetToFolder?: (assetId: string, folderId: string | null) => Promise<boolean>;
  onOpenSettingsModal?: () => void;
  allKnownAssets?: Asset[];
  knownFolders?: Folder[];
  isLoadingAssets?: boolean;
  isLoadingFolders?: boolean;
  bookmarkedAssetIds?: string[];
  recentlyViewedIds?: string[];
  onDeleteAsset?: (asset: Asset) => void;
  onRestoreAsset?: (assetId: string) => void;
}

const CATEGORY_ORDER: Array<AssetCategory | 'all'> = ['all', 'character', 'lore', 'ui_code', 'prompts', 'collab', 'app_data'];
const DEFAULT_WIDGETS: CreatorWidgetType[] = ['folder', 'playlist', 'todo', 'note', 'status', 'goal', 'gallery', 'clock'];
const DEFAULT_RAILS: Record<CreatorWidgetType, 'left' | 'right'> = { folder: 'left', playlist: 'left', todo: 'left', note: 'left', status: 'right', links: 'right', goal: 'right', gallery: 'right', clock: 'right', calendar: 'left', single_image: 'right', decoration: 'left' };
const DEFAULT_SPANS: Record<string, number> = { portfolio: 9, folder: 3, playlist: 4, todo: 4, note: 4, status: 4, links: 4, goal: 6, gallery: 6, clock: 3 };
const DEFAULT_FREE_ORDER: Array<'portfolio' | CreatorWidgetType> = ['folder', 'portfolio', 'status', 'note', 'links', 'playlist', 'todo', 'goal', 'gallery', 'clock'];
const WIDGET_TYPES: CreatorWidgetType[] = ['folder', 'playlist', 'todo', 'note', 'status', 'links', 'goal', 'gallery', 'clock', 'calendar', 'single_image', 'decoration'];
const FREE_ITEM_HEIGHTS: Record<string, number> = { portfolio: 5, folder: 3, playlist: 3, todo: 3, note: 2, status: 2, links: 2, goal: 3, gallery: 3, clock: 2, calendar: 3, single_image: 3, decoration: 2, work: 4 };
const DEFAULT_WIDGET_CONFIGS: Partial<Record<CreatorWidgetType, CreatorWidgetConfig>> = {
  todo: { items: [{ label: 'เตรียมโครงสร้างผลงาน', done: false }, { label: 'ตรวจ reference', done: true }], showCompleted: true },
  goal: { goal: 35 },
  gallery: { goal: 3 }
};

interface EditingWidgetTarget {
  type: CreatorWidgetType;
  instanceId?: string;
}

function isCreatorWidgetType(value: string): value is CreatorWidgetType {
  return WIDGET_TYPES.includes(value as CreatorWidgetType);
}

function cloneWidgetConfig(config: CreatorWidgetConfig | undefined): CreatorWidgetConfig {
  if (!config) return {};
  return {
    ...config,
    ...(config.items ? { items: config.items.map(item => ({ ...item })) } : {}),
    ...(config.links ? { links: config.links.map(link => ({ ...link })) } : {})
  };
}

function getInitial(displayName: string): string { return displayName.trim().slice(0, 1).toUpperCase() || 'C'; }

function getSocialIcon(platform: ProfileSocialLink['platform']) {
  if (platform === 'instagram') return Instagram;
  if (platform === 'x') return AtSign;
  if (platform === 'contact') return Mail;
  return Globe2;
}

function getSafeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:' ? parsed.href : null;
  } catch { return null; }
}

function filterAssets(assets: Asset[], category: AssetCategory | 'all', visibility: 'all' | 'public' | 'private', search: string) {
  const query = search.trim().toLowerCase();
  return assets.filter(asset => {
    if (category !== 'all' && asset.category !== category) return false;
    if (visibility === 'public' && !isPublicFeedVisibility(asset)) return false;
    if (visibility === 'private' && isPublicFeedVisibility(asset)) return false;
    if (!query) return true;
    return asset.title.toLowerCase().includes(query)
      || Boolean(asset.shortDescription?.toLowerCase().includes(query))
      || asset.content.toLowerCase().includes(query)
      || Boolean(asset.contentBlocks?.some(block => block.title.toLowerCase().includes(query) || block.body.toLowerCase().includes(query)))
      || Boolean(asset.tags?.some(tag => tag.toLowerCase().includes(query)));
  });
}

function folderAssetCount(folder: Folder, assets: Asset[]) { return assets.filter(asset => asset.folderId === folder.id && !asset.deletedAt).length; }

interface WidgetCardProps {
  type: CreatorWidgetType;
  folders: Folder[];
  assets: Asset[];
  profile: { displayName: string };
  isOwner: boolean;
  editing: boolean;
  layout: CreatorLayout;
  lockedPreset: LockedPreset;
  title?: string;
  span: number;
  rail: 'left' | 'right';
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onRemove: () => void;
  onRail: (rail: 'left' | 'right') => void;
  onSpan: (span: number) => void;
  config: CreatorWidgetConfig;
  onToggleTodo?: (index: number) => void;
  onDrop: (target: CreatorWidgetType) => void;
  onDropEvent?: (event: React.DragEvent<HTMLElement>) => void;
  placement?: FreeLayoutPlacement;
  onDragStart?: (event: React.DragEvent<HTMLElement>, placementId: string) => void;
  onDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onHeight?: (height: number) => void;
}

const WidgetCard: React.FC<WidgetCardProps> = ({ type, folders, assets, profile, isOwner, editing, layout, lockedPreset, title, span, rail, onMove, onRemove, onRail, onSpan, onEdit, config, onToggleTodo, onDrop, onDropEvent, placement, onDragStart, onDragOver, onDragEnd, onHeight }) => {
  const publicAssets = assets.filter(isPublicFeedVisibility);
  // Folder visibility is not persisted yet. Never infer that an owner folder
  // is public: omit it from visitor/preview presentation until the deferred
  // persistence boundary introduces an explicit public-folder field.
  const visibleFolders = isOwner ? folders.slice(0, 4) : [];
  const content: Record<CreatorWidgetType, React.ReactNode> = {
    folder: <>{visibleFolders.length ? <div className="csp-folder-list">{visibleFolders.map(folder => <div className="csp-folder-row" key={folder.id}><span>{folder.icon || '📁'} {folder.name}</span>{config.showCount !== false && <small>{folderAssetCount(folder, assets)}</small>}</div>)}</div> : <div className="csp-widget-empty">ยังไม่มีโฟลเดอร์ที่เลือก</div>}</>,
    status: <div className="csp-status-widget"><strong>{config.status || 'กำลังสร้างสิ่งใหม่'}</strong><span>{config.description || 'สถานะของ Creator ในตอนนี้'}</span></div>,
    note: <blockquote className="csp-note-widget">“{config.text || 'พื้นที่ส่วนตัวไม่จำเป็นต้องสมบูรณ์ แค่ช่วยให้เราอยากกลับมาก็พอ'}”</blockquote>,
    links: <div className="csp-links-widget"><span>{config.description || `ช่องทางของ ${profile.displayName}`}</span>{config.links?.[0]?.url ? <a className="widget-link" href={config.links[0].url} target="_blank" rel="noreferrer">{config.links[0].label || 'เปิดลิงก์'} →</a> : <small>{isOwner ? 'จัดการลิงก์จาก Edit Profile หรือ Widget editor' : 'ลิงก์สาธารณะที่ Creator เลือกแสดง'}</small>}</div>,
    playlist: <div className="csp-playlist-widget"><div className="csp-playlist-art" aria-hidden="true">♫</div><div><strong>{config.title || 'เพลงสำหรับโหมดสร้างงาน'}</strong><span>{config.description || 'ยังไม่ได้เลือก playlist ภายนอก'}</span>{config.links?.[0]?.url && <a className="widget-link" href={config.links[0].url} target="_blank" rel="noreferrer">เปิด Playlist →</a>}</div></div>,
    todo: <div className="csp-todo-list">{(config.items?.length ? config.items : [{ label: 'เตรียมโครงสร้างผลงาน', done: false }, { label: 'ตรวจ reference', done: true }]).map((item, index) => ({ item, index })).filter(({ item }) => config.showCompleted || !item.done).map(({ item, index }) => <label className={`csp-todo-row ${item.done ? 'is-done' : ''}`} key={`${item.label}-${index}`}><input type="checkbox" checked={item.done} onChange={() => onToggleTodo?.(index)} />{item.label}</label>)}</div>,
    goal: <div className="csp-goal-widget"><div><strong>{config.description || 'CXL Studio Production'}</strong><span>{config.goal || 0}%</span></div><div className="csp-progress"><span style={{ width: `${config.goal || 0}%` }} /></div></div>,
    gallery: <div className="csp-gallery-widget">{publicAssets.slice(0, config.goal || 3).map(asset => <div className="csp-gallery-tile" key={asset.id}>{asset.previewImages?.[0] ? <img src={asset.previewImages[0]} alt={asset.title} /> : <span>{asset.icon?.value || CREATOR_WIDGET_ICONS.gallery}</span>}</div>)}{publicAssets.length === 0 && <div className="csp-widget-empty">ยังไม่มีภาพในผลงานสาธารณะ</div>}</div>,
    clock: <div className="csp-clock-widget"><strong>{new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}</strong><span>{config.description || 'เวลาท้องถิ่น · Asia/Bangkok'}</span></div>,
    calendar: <div className="csp-calendar-widget"><strong>{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long' }).format(new Date())}</strong><span>{config.description || 'กำหนดการสร้างงานของฉัน'}</span></div>,
    single_image: config.imageUrl ? <img className="csp-single-image" src={config.imageUrl} alt={title || 'รูปภาพเดี่ยว'} /> : <div className="csp-widget-empty">เพิ่ม URL รูปภาพใน editor</div>,
    decoration: <div className="csp-decoration-widget" aria-hidden="true">{config.text || '✦  ✧  ✦'}</div>,
  };
  const placementStyle = placement ? { gridColumn: `${placement.x + 1} / span ${placement.w}`, gridRow: `${placement.y + 1} / span ${placement.h}` } : layout === 'free' ? { gridColumn: `span ${span}` } : undefined;
  return <article draggable={editing && (Boolean(placement) || layout !== 'free')} data-placement-id={placement?.id} data-widget-instance-id={placement?.refId} onDragOver={event => { if (editing) { event.preventDefault(); onDragOver?.(event); } }} onDrop={event => { event.preventDefault(); if (editing) { onDropEvent?.(event); if (!onDropEvent) onDrop(type); } }} onDragStart={event => { if (placement) { event.dataTransfer.setData('text/plain', placement.id); onDragStart?.(event, placement.id); } else { event.dataTransfer.setData('text/plain', type); } }} onDragEnd={onDragEnd} className={`csp-widget ${layout === 'free' ? 'csp-layout-block' : ''}`} style={placementStyle}>
    {editing && <CreatorWidgetControls type={type} layout={layout} lockedPreset={lockedPreset} span={span} rail={rail} height={placement?.h} onHeight={onHeight} onMove={onMove} onEdit={onEdit} onRemove={onRemove} onRail={onRail} onSpan={onSpan} />}
    <div className="csp-widget-heading"><span><b>{CREATOR_WIDGET_ICONS[type]}</b>{title || CREATOR_WIDGET_LABELS[type]}</span>{type === 'folder' && <small>{folders.length} รายการ</small>}</div>
    <div className="csp-widget-body">{content[type]}</div>
  </article>;
};

export const CreatorSpacePage: React.FC<CreatorSpacePageProps> = ({ slug, onCreateAsset, onEditAsset, onOpenAuth, onOpenFolderManager, onOpenMoveToFolder, onMoveAssetToFolder, onOpenSettingsModal, allKnownAssets = [], knownFolders = [], isLoadingAssets = false, isLoadingFolders = false, bookmarkedAssetIds = [], recentlyViewedIds = [], onDeleteAsset, onRestoreAsset }) => {
  const { currentUser, openAuthModal } = useAuth();
  const [activeSlug, setActiveSlug] = useState(slug);
  const { profile, assets, folders, isProfileLoading, isAssetsLoading: isProfileAssetsLoading, isFoldersLoading: isProfileFoldersLoading, isNotFound, error, refresh } = useCreatorSpaceData(
    activeSlug,
    currentUser?.id,
    currentUser,
    { assets: allKnownAssets, folders: knownFolders, isAssetsLoading: isLoadingAssets, isFoldersLoading: isLoadingFolders }
  );
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const openFolderDetail = React.useCallback((folderId: string) => setSelectedFolderId(folderId), []);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestedTab, setRequestedTab] = useState<ProfileTab>(() => parseCanonicalProfileLocation(window.location.pathname, window.location.search)?.requestedTab || 'profile');
  const [layout, setLayout] = useState<CreatorLayout>('locked');
  const [lockedPreset, setLockedPreset] = useState<LockedPreset>('left');
  const [widgets, setWidgets] = useState<CreatorWidgetType[]>(DEFAULT_WIDGETS);
  const [widgetRail, setWidgetRail] = useState(DEFAULT_RAILS);
  const [spans, setSpans] = useState(DEFAULT_SPANS);
  const [freeOrder, setFreeOrder] = useState<Array<'portfolio' | CreatorWidgetType>>(DEFAULT_FREE_ORDER);
  const [freePlacements, setFreePlacements] = useState<FreeLayoutPlacement[]>(() => migrateFreeOrder(DEFAULT_FREE_ORDER, DEFAULT_SPANS));
  const [portfolioDisplayLimit, setPortfolioDisplayLimit] = useState<PortfolioDisplayLimit>(6);
  const [portfolioMeasurement, setPortfolioMeasurement] = useState<{ key: string; rows: number } | null>(null);
  const [workMeasurements, setWorkMeasurements] = useState<Record<string, { key: string; rows: number }>>({});
  const [widgetTitles, setWidgetTitles] = useState<Partial<Record<CreatorWidgetType, string>>>({});
  const [editingWidget, setEditingWidget] = useState<EditingWidgetTarget | null>(null);
  const [widgetConfigs, setWidgetConfigs] = useState<Partial<Record<CreatorWidgetType, CreatorWidgetConfig>>>(DEFAULT_WIDGET_CONFIGS);
  const [widgetInstances, setWidgetInstances] = useState<FreeWidgetInstance[]>(() => hydrateFreeWidgetInstances(
    migrateFreeOrder(DEFAULT_FREE_ORDER, DEFAULT_SPANS),
    [],
    DEFAULT_WIDGET_CONFIGS as Record<string, Record<string, unknown>>
  ));
  const [previewViewer, setPreviewViewer] = useState<'owner' | 'public'>(() => parseCanonicalProfileLocation(window.location.pathname, window.location.search)?.previewPublic ? 'public' : 'owner');
  const [folderView, setFolderView] = useState<'grid' | 'compact' | 'list'>('grid');
  const [folderSort, setFolderSort] = useState<'recent' | 'name' | 'count'>('recent');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemKind, setAddItemKind] = useState<FreePlacementKind>('widget');
  const [draggingPlacementId, setDraggingPlacementId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<FreeLayoutPlacement | null>(null);
  const freeCanvasRef = React.useRef<HTMLElement>(null);
  const portfolioContentRef = React.useRef<HTMLDivElement>(null);
  const dragGrabOffsetRef = React.useRef({ x: 0, y: 0 });

  useEffect(() => {
    const syncFromLocation = () => {
      const route = parseCanonicalProfileLocation(window.location.pathname, window.location.search);
      if (!route) return;
      setActiveSlug(route.slug);
      setRequestedTab(route.requestedTab);
      setPreviewViewer(route.previewPublic ? 'public' : 'owner');
    };
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const isOwner = Boolean(profile && currentUser?.id === profile.id);
  const resolvedView = resolveProfileView({ requestedTab, previewPublic: previewViewer === 'public' }, isOwner);
  const activeTab = resolvedView.activeTab;
  const isEditing = isOwner && !resolvedView.isPublicView;
  const canManageFreeLayout = shouldShowFreePlacementControls(isOwner, resolvedView.isPublicView, isCustomizeOpen);
  const presentationProfile = isOwner && currentUser ? currentUser : profile;
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const canonicalSlug = getCanonicalProfileSlug(profile);
    if (activeSlug === canonicalSlug) return;
    const search = window.location.search;
    window.history.replaceState({}, '', getCanonicalProfilePath(profile, search));
    setActiveSlug(canonicalSlug);
  }, [activeSlug, profile]);

  useEffect(() => {
    // Query parameters are not authority. A visitor who manually supplies an
    // owner tab must receive the public presentation, without a blank state or
    // any owner-only metadata.
    if (profile && resolvedView.isPublicView && requestedTab !== 'profile' && requestedTab !== 'works') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      setRequestedTab('profile');
    }
  }, [profile, requestedTab, resolvedView.isPublicView]);

  useEffect(() => {
    if (!isMockPersistence || !profile) return;
    setSettingsHydrated(false);
    const saved = readCreatorSpaceSettings(profile.id);
    if (saved) {
      if (saved.layout) setLayout(saved.layout);
      if (saved.lockedPreset) setLockedPreset(saved.lockedPreset);
      if (saved.widgets) setWidgets(saved.widgets as CreatorWidgetType[]);
      if (saved.widgetRail) setWidgetRail(previous => ({ ...previous, ...saved.widgetRail }));
      if (saved.spans) setSpans(previous => ({ ...previous, ...saved.spans }));
      if (saved.freeOrder) setFreeOrder(saved.freeOrder as Array<'portfolio' | CreatorWidgetType>);
      if (saved.portfolioDisplayLimit) setPortfolioDisplayLimit(saved.portfolioDisplayLimit);
      const legacyPlacements = migrateFreeOrder((saved.freeOrder as Array<'portfolio' | CreatorWidgetType> | undefined) || DEFAULT_FREE_ORDER, saved.spans || DEFAULT_SPANS);
      const hydratedPlacements = hydrateSavedFreeLayout(saved.freePlacements, legacyPlacements, saved.spans?.portfolio || DEFAULT_SPANS.portfolio, FREE_ITEM_HEIGHTS.portfolio);
      const hydratedInstances = hydrateFreeWidgetInstances(
        hydratedPlacements,
        saved.widgetInstances || [],
        (saved.widgetConfigs || {}) as Record<string, Record<string, unknown>>,
        saved.widgetTitles || {}
      ).filter(instance => isCreatorWidgetType(instance.widgetType));
      const instanceIds = new Set(hydratedInstances.map(instance => instance.id));
      setWidgetInstances(hydratedInstances);
      setFreePlacements(hydratedPlacements.filter(item => item.kind !== 'widget' || instanceIds.has(item.refId)));
      if (saved.widgetTitles) setWidgetTitles(saved.widgetTitles);
      if (saved.widgetConfigs) setWidgetConfigs(saved.widgetConfigs as Partial<Record<CreatorWidgetType, CreatorWidgetConfig>>);
    } else {
      const defaultPlacements = migrateFreeOrder(DEFAULT_FREE_ORDER, DEFAULT_SPANS);
      setFreePlacements(defaultPlacements);
      setWidgetInstances(hydrateFreeWidgetInstances(defaultPlacements, [], DEFAULT_WIDGET_CONFIGS as Record<string, Record<string, unknown>>));
    }
    setSettingsHydrated(true);
  }, [profile?.id]);

  useEffect(() => {
    if (!isMockPersistence || !isOwner || !profile || !settingsHydrated) return;
    writeCreatorSpaceSettings(profile.id, { layout, lockedPreset, widgets, widgetRail, spans, freeOrder, freePlacements, portfolioDisplayLimit, widgetTitles, widgetConfigs: widgetConfigs as Record<string, Record<string, unknown>>, widgetInstances });
  }, [freeOrder, freePlacements, isOwner, layout, lockedPreset, portfolioDisplayLimit, profile?.id, settingsHydrated, spans, widgetConfigs, widgetInstances, widgetRail, widgetTitles, widgets]);
  const visibleAssets = useMemo(() => getCreatorVisibleAssets(assets, isEditing), [assets, isEditing]);
  const widgetInstanceMap = useMemo(() => new Map(widgetInstances.map(instance => [instance.id, instance])), [widgetInstances]);
  const filteredAssets = useMemo(() => filterAssets(visibleAssets, selectedCategory, isEditing ? visibility : 'all', searchQuery), [isEditing, searchQuery, selectedCategory, visibility, visibleAssets]);
  const portfolioShowcaseAssets = useMemo(() => {
    if (portfolioDisplayLimit === 'all') return filteredAssets;
    return getPortfolioShowcaseItems(filteredAssets, portfolioDisplayLimit);
  }, [filteredAssets, portfolioDisplayLimit]);
  const portfolioPlacementWidth = freePlacements.find(item => item.kind === 'portfolio')?.w || spans.portfolio || DEFAULT_SPANS.portfolio;
  const portfolioMeasurementKey = `${portfolioPlacementWidth}:${portfolioShowcaseAssets.length}:${isCustomizeOpen && isEditing ? 1 : 0}`;
  const portfolioEstimatedRows = estimatePortfolioHeightRows(portfolioPlacementWidth, portfolioShowcaseAssets.length, isCustomizeOpen && isEditing);
  const portfolioHeightRows = portfolioMeasurement?.key === portfolioMeasurementKey ? portfolioMeasurement.rows : portfolioEstimatedRows;
  const workMeasurementSpecs = useMemo(() => {
    const specs: Record<string, { key: string; rows: number }> = {};
    for (const placement of freePlacements) {
      if (placement.kind !== 'work') continue;
      const asset = visibleAssets.find(candidate => candidate.id === placement.refId);
      if (!asset || asset.deletedAt) continue;
      const key = `${placement.id}:${placement.w}:${asset.updatedAt}:${isCustomizeOpen && isEditing ? 1 : 0}`;
      const measured = workMeasurements[placement.id];
      specs[placement.id] = {
        key,
        rows: measured?.key === key ? measured.rows : estimateWorkHeightRows(placement.w, isCustomizeOpen && isEditing)
      };
    }
    return specs;
  }, [freePlacements, isCustomizeOpen, isEditing, visibleAssets, workMeasurements]);
  const workMeasurementSignature = Object.values(workMeasurementSpecs).map(spec => spec.key).sort().join('|');
  const derivedFreeHeights = useMemo(() => {
    const heights: Record<string, number> = { [getFreePlacementId('portfolio', 'portfolio')]: portfolioHeightRows };
    for (const [id, spec] of Object.entries(workMeasurementSpecs)) heights[id] = spec.rows;
    return heights;
  }, [portfolioHeightRows, workMeasurementSpecs]);
  const publicAssets = useMemo(() => visibleAssets.filter(isPublicFeedVisibility), [visibleAssets]);
  const visibleFolderCount = isEditing ? folders.length : 0;
  const managementAssets = useMemo(() => {
    if (activeTab === 'works') return visibleAssets.filter(asset => !asset.deletedAt);
    if (activeTab === 'drafts') return visibleAssets.filter(asset => asset.status === 'draft' && !asset.deletedAt);
    if (activeTab === 'trash') return assets.filter(asset => Boolean(asset.deletedAt));
    if (activeTab === 'saved') return allKnownAssets.filter(asset => bookmarkedAssetIds.includes(asset.id) && asset.userId !== currentUser?.id && !asset.deletedAt && isPublicFeedVisibility(asset));
    if (activeTab === 'recent') return [...visibleAssets].filter(asset => recentlyViewedIds.includes(asset.id) && !asset.deletedAt).sort((a, b) => recentlyViewedIds.indexOf(a.id) - recentlyViewedIds.indexOf(b.id));
    return [];
  }, [activeTab, allKnownAssets, assets, bookmarkedAssetIds, currentUser?.id, recentlyViewedIds, visibleAssets]);
  const displayFolders = useMemo(() => [...folders].sort((a, b) => folderSort === 'name' ? a.name.localeCompare(b.name, 'th') : folderSort === 'count' ? folderAssetCount(b, visibleAssets) - folderAssetCount(a, visibleAssets) : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [folderSort, folders, visibleAssets]);
  const selectedFolder = folders.find(folder => folder.id === selectedFolderId) || null;
  const socialLinks = (profile?.socialLinks || []).filter(link => link.visible && getSafeHref(link.url));
  const displayName = profile?.displayName || 'Creator';

  useEffect(() => {
    setSelectedFolderId(null);
  }, [activeSlug]);

  useEffect(() => {
    if (!isEditing || (activeTab !== 'profile' && activeTab !== 'folders')) setSelectedFolderId(null);
  }, [activeTab, isEditing]);

  useEffect(() => {
    if (activeTab !== 'profile' || layout !== 'free' || typeof ResizeObserver === 'undefined') return;
    const content = portfolioContentRef.current;
    const canvas = freeCanvasRef.current;
    if (!content || !canvas) return;
    let frame = 0;
    const measure = () => {
      const canvasStyles = window.getComputedStyle(canvas);
      const rowHeight = Number.parseFloat(canvasStyles.gridAutoRows || '72') || 72;
      const rowGap = Number.parseFloat(canvasStyles.rowGap || '0') || 0;
      const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
      const rows = pixelsToFreeGridRows(contentHeight, rowHeight, rowGap);
      setPortfolioMeasurement(previous => previous?.key === portfolioMeasurementKey && previous.rows === rows ? previous : { key: portfolioMeasurementKey, rows });
    };
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    });
    observer.observe(content);
    measure();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, layout, portfolioMeasurementKey]);

  useEffect(() => {
    if (activeTab !== 'profile' || layout !== 'free' || typeof ResizeObserver === 'undefined') return;
    const canvas = freeCanvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const measure = () => {
      const canvasStyles = window.getComputedStyle(canvas);
      const rowHeight = Number.parseFloat(canvasStyles.gridAutoRows || '72') || 72;
      const rowGap = Number.parseFloat(canvasStyles.rowGap || '0') || 0;
      const nextMeasurements: Record<string, { key: string; rows: number }> = {};
      canvas.querySelectorAll<HTMLElement>('[data-free-work-content]').forEach(content => {
        const id = content.dataset.placementId;
        const key = content.dataset.measurementKey;
        if (!id || !key) return;
        const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
        nextMeasurements[id] = { key, rows: pixelsToFreeGridRows(contentHeight, rowHeight, rowGap) };
      });
      setWorkMeasurements(previous => {
        let changed = false;
        const next = { ...previous };
        for (const [id, measurement] of Object.entries(nextMeasurements)) {
          if (previous[id]?.key === measurement.key && previous[id]?.rows === measurement.rows) continue;
          next[id] = measurement;
          changed = true;
        }
        return changed ? next : previous;
      });
    };
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    });
    canvas.querySelectorAll<HTMLElement>('[data-free-work-content]').forEach(content => observer.observe(content));
    measure();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, layout, workMeasurementSignature]);

  const handleCreateAsset = () => {
    if (!isEditing) { openAuthModal('signup'); return; }
    onCreateAsset();
  };
  const selectTab = (tab: ProfileTab) => {
    const url = new URL(window.location.href);
    if (tab === 'profile') url.searchParams.delete('tab'); else url.searchParams.set('tab', tab);
    if (previewViewer === 'public') url.searchParams.set('preview', 'public');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setRequestedTab(tab);
    if (tab !== 'profile') setAddItemOpen(false);
  };
  const setPublicPreview = (enabled: boolean) => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('preview', 'public'); else url.searchParams.delete('preview');
    if (enabled) url.searchParams.delete('tab');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setPreviewViewer(enabled ? 'public' : 'owner');
    if (enabled) { setRequestedTab('profile'); setIsCustomizeOpen(false); setEditingWidget(null); setAddItemOpen(false); }
  };
  const handleLayoutChange = (nextLayout: CreatorLayout) => {
    setLayout(nextLayout);
    if (nextLayout !== 'free') setAddItemOpen(false);
  };
  const toggleCustomize = () => {
    if (isCustomizeOpen) {
      setIsCustomizeOpen(false);
      setAddItemOpen(false);
      setEditingWidget(null);
      return;
    }
    setIsCustomizeOpen(true);
  };

  const moveWidget = (type: CreatorWidgetType, direction: -1 | 1) => {
    setWidgets(previous => {
      const next = [...previous]; const index = next.indexOf(type); const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  };

  const commitResolvedPlacement = (id: string, resolvedLayout: FreeLayoutPlacement[]) => {
    const resolved = resolvedLayout.find(item => item.id === id);
    if (!resolved) return;
    setFreePlacements(previous => previous.map(item => item.id === id ? resolved : item));
  };

  const moveFreeBlock = (id: string, direction: -1 | 1) => {
    const current = visibleFreePlacements.find(item => item.id === id);
    if (!current) return;
    const ordered = [...visibleFreePlacements].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    const index = ordered.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const destination = ordered[target];
    const moved = resolveFreePlacementPosition(visibleFreePlacements, { ...current, x: destination.x, y: destination.y }, id);
    const resolved = moveFreePlacement(visibleFreePlacements, id, moved.x, moved.y);
    commitResolvedPlacement(id, resolved);
  };

  const handleSpanChange = (type: 'portfolio' | CreatorWidgetType, span: number) => {
    setSpans(previous => ({ ...previous, [type]: span }));
    const id = getFreePlacementId(type === 'portfolio' ? 'portfolio' : 'widget', type);
    const current = visibleFreePlacements.find(item => item.id === id);
    if (!current) return;
    const width = constrainFreePlacementWidth(span, current.kind, type === 'portfolio' ? undefined : type);
    const resolved = resizeFreePlacement(visibleFreePlacements, id, width, current.h);
    commitResolvedPlacement(id, resolved);
  };

  const getPointerCell = (event: React.DragEvent<HTMLElement>) => {
    if (!freeCanvasRef.current) return null;
    const rect = freeCanvasRef.current.getBoundingClientRect();
    const styles = window.getComputedStyle(freeCanvasRef.current);
    const rowHeight = Number.parseFloat(styles.gridAutoRows || '64') || 64;
    const rowGap = Number.parseFloat(styles.rowGap || '0') || 0;
    const columnGap = Number.parseFloat(styles.columnGap || '0') || 0;
    return pointerToFreeGridCell({
      clientX: event.clientX,
      clientY: event.clientY,
      containerLeft: rect.left,
      containerTop: rect.top,
      containerWidth: rect.width,
      rowHeight,
      columnGap,
      rowGap
    });
  };

  const getDropCandidate = (event: React.DragEvent<HTMLElement>) => {
    if (!draggingPlacementId) return null;
    const current = visibleFreePlacements.find(item => item.id === draggingPlacementId);
    const pointerCell = getPointerCell(event);
    if (!current || !pointerCell) return null;
    const anchored = anchorFreeGridCell(pointerCell, dragGrabOffsetRef.current, current.w, current.h);
    const resolved = resolveFreePlacementPosition(visibleFreePlacements, { ...current, ...anchored }, current.id);
    return { ...current, x: resolved.x, y: resolved.y };
  };

  const handleFreeDragStart = (event: React.DragEvent<HTMLElement>, id: string) => {
    const placement = visibleFreePlacements.find(item => item.id === id);
    const pointerCell = getPointerCell(event);
    if (placement && pointerCell) {
      dragGrabOffsetRef.current = {
        x: Math.max(0, Math.min(placement.w - 1, pointerCell.x - placement.x)),
        y: Math.max(0, Math.min(placement.h - 1, pointerCell.y - placement.y))
      };
    } else {
      dragGrabOffsetRef.current = { x: 0, y: 0 };
    }
    setDraggingPlacementId(id);
    setDropPreview(placement || null);
  };
  const handleFreeDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!draggingPlacementId) return;
    event.preventDefault();
    setDropPreview(getDropCandidate(event));
  };
  const handleFreeDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const candidate = getDropCandidate(event) || dropPreview;
    if (draggingPlacementId && candidate) {
      const moved = moveFreePlacement(visibleFreePlacements, draggingPlacementId, candidate.x, candidate.y);
      commitResolvedPlacement(draggingPlacementId, moved);
    }
    setDraggingPlacementId(null);
    setDropPreview(null);
    dragGrabOffsetRef.current = { x: 0, y: 0 };
  };
  const handleFreeDragEnd = () => { setDraggingPlacementId(null); setDropPreview(null); dragGrabOffsetRef.current = { x: 0, y: 0 }; };

  const addCompositionItem = (kind: FreePlacementKind, refId: string) => {
    const widgetType = kind === 'widget' && isCreatorWidgetType(refId) ? refId : undefined;
    const instance = widgetType
      ? createFreeWidgetInstance(
        widgetType,
        widgetInstances,
        `${widgetType}-${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${widgetInstances.length + 1}`}`,
        cloneWidgetConfig(DEFAULT_WIDGET_CONFIGS[widgetType]) as Record<string, unknown>
      )
      : null;
    const placementRefId = instance?.id || refId;
    const id = getFreePlacementId(kind, placementRefId);
    if (instance) setWidgetInstances(previous => [...previous, instance]);
    setFreePlacements(previous => {
      if (!canAddFreePlacement(previous, kind, refId)) return previous;
      const requestedWidth = kind === 'portfolio' ? spans.portfolio : kind === 'widget' ? spans[refId] || 4 : kind === 'work' ? 6 : 4;
      const width = constrainFreePlacementWidth(requestedWidth, kind, widgetType);
      const item = normalizeFreePlacement({ id, kind, refId: placementRefId, x: 0, y: 0, w: width, h: FREE_ITEM_HEIGHTS[refId] || 3 });
      if (!item) return previous;
      const position = resolveFreePlacementPosition(visibleFreePlacements, item, id);
      return [...previous, { ...item, x: position.x, y: position.y }];
    });
    setAddItemOpen(false);
  };
  const addWidget = (type: CreatorWidgetType, rail?: 'left' | 'right') => {
    if (!widgets.includes(type)) setWidgets(previous => [...previous, type]);
    if (rail) setWidgetRail(previous => ({ ...previous, [type]: rail }));
    if (layout === 'free') addCompositionItem('widget', type);
  };
  const removeWidget = (type: CreatorWidgetType) => {
    setWidgets(previous => previous.filter(item => item !== type));
    setFreeOrder(previous => previous.filter(item => item !== type));
  };

  const visibleFreePlacements = useMemo(() => {
    const filtered = freePlacements.filter(item => {
    if (item.kind === 'portfolio') return true;
    if (item.kind === 'widget') {
      const instance = widgetInstanceMap.get(item.refId);
      if (!instance || !isCreatorWidgetType(instance.widgetType)) return false;
      const config = instance.config as CreatorWidgetConfig;
      return !(previewViewer === 'public' && (instance.widgetType === 'todo' || instance.widgetType === 'folder' || config.visibility === 'private'));
    }
    if (item.kind === 'folder') return isEditing && folders.some(folder => folder.id === item.refId);
    const asset = visibleAssets.find(candidate => candidate.id === item.refId);
    return Boolean(asset && !asset.deletedAt && (isEditing || isPublicFeedVisibility(asset)));
    });
    const base = isEditing ? filtered : compactFreeLayout(filtered);
    return materializeDerivedHeights(base, derivedFreeHeights);
  }, [derivedFreeHeights, folders, freePlacements, isEditing, previewViewer, visibleAssets, widgetInstanceMap]);

  const placementHandlers = (placement: FreeLayoutPlacement) => ({
    draggable: canManageFreeLayout,
    onDragOver: handleFreeDragOver,
    onDrop: handleFreeDrop,
    onDragStart: (event: React.DragEvent<HTMLElement>) => handleFreeDragStart(event, placement.id),
    onDragEnd: handleFreeDragEnd,
  });

  const renderPortfolio = (free = false, placement?: FreeLayoutPlacement) => {
    const hasHiddenShowcaseAssets = portfolioShowcaseAssets.length < filteredAssets.length;
    const openAllWorks = () => selectTab('works');
    const portfolioStyle = free && placement ? {
      gridColumn: `${placement.x + 1} / span ${placement.w}`,
      gridRow: `${placement.y + 1} / span ${placement.h}`
    } : undefined;

    return <section key={placement?.id} className={free ? 'csp-portfolio csp-layout-block' : 'csp-portfolio'} data-height-mode={free ? 'auto' : undefined} style={portfolioStyle} {...(placement && canManageFreeLayout ? placementHandlers(placement) : {})}>
      <div ref={free ? portfolioContentRef : undefined} className={free ? 'csp-portfolio-content' : undefined}>
        {isCustomizeOpen && <div className="csp-portfolio-edit-bar"><span>▦ Portfolio · Showcase auto-height</span><div>{layout === 'free' && <select value={placement?.w || spans.portfolio} onChange={event => handleSpanChange('portfolio', Number(event.target.value))} aria-label="ความกว้าง Portfolio">{getFreePlacementWidthOptions('portfolio').map(value => <option value={value} key={value}>{value} / 12 คอลัมน์</option>)}</select>}<label className="csp-portfolio-limit-label">แสดง<select value={portfolioDisplayLimit} onChange={event => setPortfolioDisplayLimit(event.target.value === 'all' ? 'all' : Number(event.target.value) as PortfolioDisplayLimit)} aria-label="จำนวนผลงานใน Portfolio">{[3, 6, 9, 12].map(value => <option value={value} key={value}>{value} ผลงาน</option>)}<option value="all">ทั้งหมด</option></select></label>{layout === 'free' && <><button type="button" onClick={() => moveFreeBlock(getFreePlacementId('portfolio', 'portfolio'), -1)} aria-label="เลื่อน Portfolio ขึ้น">↑</button><button type="button" onClick={() => moveFreeBlock(getFreePlacementId('portfolio', 'portfolio'), 1)} aria-label="เลื่อน Portfolio ลง">↓</button>{placement && <button type="button" className="is-danger csp-remove-from-profile" onClick={() => removeCompositionPlacement(placement.id)} title="ซ่อน Portfolio จากหน้าโปรไฟล์โดยไม่ลบผลงาน">นำออก</button>}</>}</div></div>}
        <div className="csp-section-heading"><div><p className="csp-eyebrow">PORTFOLIO</p><h2>ผลงานของ {displayName}</h2><p>Showcase จากคลังผลงานของ Creator · ความสูงปรับตามเนื้อหา</p></div><span>{portfolioShowcaseAssets.length}{hasHiddenShowcaseAssets ? ` / ${filteredAssets.length}` : ''} รายการ</span></div>
        <div className="csp-creator-filters"><div className="csp-filter-row" aria-label="กรองตามหมวดหมู่">{CATEGORY_ORDER.map(category => <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={selectedCategory === category ? 'is-active' : ''}>{category === 'all' ? 'ทั้งหมด' : CATEGORIES[category].name}</button>)}</div>{isEditing && <div className="csp-filter-row" aria-label="กรองตามการมองเห็น">{(['all', 'public', 'private'] as const).map(value => <button key={value} type="button" onClick={() => setVisibility(value)} className={visibility === value ? 'is-active' : ''}>{value === 'all' ? 'ทั้งหมด' : value === 'public' ? 'สาธารณะ' : 'ส่วนตัว'}</button>)}</div>}</div>
        {isProfileAssetsLoading ? <div className="csp-empty" aria-busy="true"><h3>กำลังโหลดผลงาน...</h3></div> : filteredAssets.length > 0 ? <><div className={`csp-asset-grid ${free ? 'csp-portfolio-showcase-grid' : ''}`}>{portfolioShowcaseAssets.map(asset => <AssetCard key={asset.id} asset={asset} onClick={setSelectedAsset} onEdit={isEditing ? onEditAsset : undefined} isOwner={isEditing} creatorProfile={presentationProfile} />)}</div>{hasHiddenShowcaseAssets && <div className="csp-portfolio-all-action"><button type="button" className="csp-secondary-button" onClick={openAllWorks}>ดูผลงานทั้งหมด</button></div>}</> : <div className="csp-empty"><div className="csp-empty-icon"><Edit3 className="h-5 w-5" /></div><h3>{searchQuery ? `ไม่พบผลงานที่ตรงกับ “${searchQuery}”` : isEditing ? 'ยังไม่มีผลงานในพื้นที่ของคุณ' : 'Creator คนนี้ยังไม่มีผลงานสาธารณะ'}</h3><p>{isEditing ? 'เริ่มจากผลงานที่มีอยู่ในคลัง หรือเปิด workspace เพื่อเตรียมผลงานใหม่' : 'ผลงานสาธารณะที่ Creator เลือกแสดงจะปรากฏที่นี่'}</p>{isEditing && !searchQuery && <button type="button" onClick={handleCreateAsset} className="csp-primary-button"><Plus className="h-4 w-4" />สร้างผลงาน</button>}</div>}
      </div>
    </section>;
  };

  const resizeCompositionPlacement = (id: string, width: number, height: number, widgetType?: CreatorWidgetType) => {
    const current = visibleFreePlacements.find(item => item.id === id);
    if (!current) return;
    const constrainedWidth = constrainFreePlacementWidth(width, current.kind, widgetType);
    const resolved = resizeFreePlacement(visibleFreePlacements, id, constrainedWidth, height);
    commitResolvedPlacement(id, resolved);
  };

  const removeCompositionPlacement = (id: string) => {
    setFreePlacements(previous => removeFreePlacement(previous, id));
  };

  const renderWidget = (type: CreatorWidgetType, placement?: FreeLayoutPlacement) => {
    const instance = placement ? widgetInstanceMap.get(placement.refId) : undefined;
    const config = instance ? instance.config as CreatorWidgetConfig : widgetConfigs[type] || {};
    const title = instance?.title || widgetTitles[type] || config.title;
    if (previewViewer === 'public' && (config.visibility === 'private' || type === 'todo' || type === 'folder')) return null;
    const updateConfig = (nextConfig: CreatorWidgetConfig) => {
      if (instance) {
        setWidgetInstances(previous => updateFreeWidgetInstance(previous, instance.id, nextConfig as Record<string, unknown>));
      } else {
        setWidgetConfigs(previous => ({ ...previous, [type]: nextConfig }));
      }
    };
    return <WidgetCard key={placement?.id || type} type={type} folders={folders} assets={visibleAssets} profile={{ displayName }} isOwner={isEditing} editing={isCustomizeOpen} layout={layout} lockedPreset={lockedPreset} title={title} span={placement?.w || spans[type] || 4} rail={widgetRail[type]} config={config} placement={placement} onDragStart={handleFreeDragStart} onDragOver={handleFreeDragOver} onDragEnd={handleFreeDragEnd} onDropEvent={placement ? handleFreeDrop : undefined} onHeight={placement ? height => resizeCompositionPlacement(placement.id, placement.w, height, type) : undefined} onToggleTodo={index => { if (type !== 'todo') return; const items = config.items || []; updateConfig({ ...config, items: items.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item) }); }} onDrop={target => { if (layout === 'free') return; setWidgets(previous => { const from = previous.indexOf(type); const to = previous.indexOf(target); if (from < 0 || to < 0 || from === to) return previous; const next = [...previous]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }); }} onMove={direction => placement ? moveFreeBlock(placement.id, direction) : moveWidget(type, direction)} onEdit={() => setEditingWidget({ type, ...(instance ? { instanceId: instance.id } : {}) })} onRemove={() => placement ? removeCompositionPlacement(placement.id) : removeWidget(type)} onRail={rail => setWidgetRail(previous => ({ ...previous, [type]: rail }))} onSpan={span => placement ? resizeCompositionPlacement(placement.id, span, placement.h, type) : handleSpanChange(type, span)} />;
  };

  const renderFreePlacement = (placement: FreeLayoutPlacement) => {
    if (placement.kind === 'portfolio') return renderPortfolio(true, placement);
    if (placement.kind === 'widget') {
      const instance = widgetInstanceMap.get(placement.refId);
      if (!instance || !isCreatorWidgetType(instance.widgetType)) return null;
      return renderWidget(instance.widgetType, placement);
    }
    if (placement.kind === 'work') {
      const asset = visibleAssets.find(candidate => candidate.id === placement.refId);
      if (!asset || asset.deletedAt || (!isEditing && !isPublicFeedVisibility(asset))) return null;
      const workSize = getWorkCardSize(placement.w);
      const measurementKey = workMeasurementSpecs[placement.id]?.key || `${placement.id}:${placement.w}`;
      return <div key={placement.id} className={`csp-free-placement csp-free-work-placement is-${workSize} csp-layout-block`} data-height-mode="auto" style={{ gridColumn: `${placement.x + 1} / span ${placement.w}`, gridRow: `${placement.y + 1} / span ${placement.h}` }} {...(isEditing && isCustomizeOpen ? placementHandlers(placement) : {})}><div className="csp-free-work-content" data-free-work-content data-placement-id={placement.id} data-measurement-key={measurementKey}>{isEditing && isCustomizeOpen && <div className="csp-widget-edit-bar"><span className="csp-drag-handle" aria-hidden="true">⋮⋮</span><strong>▦ Work · ความสูงอัตโนมัติ</strong><select value={placement.w} onChange={event => resizeCompositionPlacement(placement.id, Number(event.target.value), placement.h)} aria-label="ความกว้าง Work">{getFreePlacementWidthOptions('work').map(value => <option value={value} key={value}>{value} / 12 คอลัมน์</option>)}</select><button type="button" className="is-danger csp-remove-from-profile" onClick={() => removeCompositionPlacement(placement.id)} title="ลบเฉพาะตำแหน่ง ผลงานยังอยู่ในแท็บผลงาน">นำออก</button></div>}<AssetCard asset={asset} onClick={setSelectedAsset} onEdit={isEditing ? onEditAsset : undefined} isOwner={isEditing} creatorProfile={presentationProfile} /></div></div>;
    }
    const folder = folders.find(candidate => candidate.id === placement.refId);
    if (!folder || !isEditing) return null;
    return <article key={placement.id} className="csp-free-folder-card csp-layout-block" data-folder-id={folder.id} style={{ gridColumn: `${placement.x + 1} / span ${placement.w}`, gridRow: `${placement.y + 1} / span ${placement.h}` }} {...(isEditing && isCustomizeOpen ? placementHandlers(placement) : {})}>{isCustomizeOpen && <div className="csp-widget-edit-bar"><span className="csp-drag-handle" aria-hidden="true">⋮⋮</span><strong>📁 Folder</strong><select value={placement.w} onChange={event => resizeCompositionPlacement(placement.id, Number(event.target.value), placement.h)} aria-label="ความกว้าง Folder">{getFreePlacementWidthOptions('folder').map(value => <option value={value} key={value}>{value} / 12 คอลัมน์</option>)}</select><select value={placement.h} onChange={event => resizeCompositionPlacement(placement.id, placement.w, Number(event.target.value))} aria-label="ความสูง Folder">{[2, 3, 4, 5, 6].map(value => <option value={value} key={value}>{value} แถว</option>)}</select><button type="button" className="is-danger csp-remove-from-profile" onClick={() => removeCompositionPlacement(placement.id)} title="ลบเฉพาะตำแหน่ง โฟลเดอร์และเนื้อหายังอยู่">นำออก</button></div>}<button type="button" className="csp-free-folder-open" onClick={() => openFolderDetail(folder.id)}><span>{folder.icon || '📁'}</span><strong>{folder.name}</strong><small>{folderAssetCount(folder, visibleAssets)} ผลงาน</small></button></article>;
  };
  const renderAddItemPicker = () => {
    if (!addItemOpen || !isCustomizeOpen || !isEditing) return null;
    const availableFolders = folders.filter(folder => !freePlacements.some(item => item.kind === 'folder' && item.refId === folder.id));
    const availableWorks = visibleAssets.filter(asset => !asset.deletedAt && !freePlacements.some(item => item.kind === 'work' && item.refId === asset.id));
    const hasPortfolio = freePlacements.some(item => item.kind === 'portfolio');
    return <section className="csp-inline-dialog csp-add-item-dialog" role="dialog" aria-label="เพิ่มรายการใน Free Layout">
      <div className="csp-section-heading"><div><h3>เพิ่มรายการ</h3><p>เลือก Portfolio, Widget, Work หรือ Folder ที่มีอยู่จริง</p></div><button type="button" className="csp-icon-button" onClick={() => setAddItemOpen(false)} aria-label="ปิด">×</button></div>
      <div className="csp-filter-row">
        <button type="button" className={addItemKind === 'portfolio' ? 'is-active' : ''} onClick={() => setAddItemKind('portfolio')}>Portfolio</button>
        <button type="button" className={addItemKind === 'widget' ? 'is-active' : ''} onClick={() => setAddItemKind('widget')}>Widget</button>
        <button type="button" className={addItemKind === 'work' ? 'is-active' : ''} onClick={() => setAddItemKind('work')}>Work</button>
        <button type="button" className={addItemKind === 'folder' ? 'is-active' : ''} onClick={() => setAddItemKind('folder')}>Folder</button>
      </div>
      <div className="csp-add-item-grid">
        {addItemKind === 'portfolio' && (hasPortfolio ? <p className="csp-add-item-empty">Portfolio อยู่บนโปรไฟล์แล้ว และเพิ่มซ้ำไม่ได้</p> : <button type="button" onClick={() => addCompositionItem('portfolio', 'portfolio')}>▦ Portfolio Showcase</button>)}
        {addItemKind === 'widget' && WIDGET_TYPES.map(type => <button type="button" key={type} onClick={() => addCompositionItem('widget', type)}>{CREATOR_WIDGET_ICONS[type]} {CREATOR_WIDGET_LABELS[type]}</button>)}
        {addItemKind === 'work' && (availableWorks.length ? availableWorks.map(asset => <button type="button" key={asset.id} data-work-id={asset.id} onClick={() => addCompositionItem('work', asset.id)}>▦ {asset.title}</button>) : <p className="csp-add-item-empty">ไม่มี Work ที่ยังไม่ได้วางบนหน้าโปรไฟล์</p>)}
        {addItemKind === 'folder' && (availableFolders.length ? availableFolders.map(folder => <button type="button" key={folder.id} data-folder-id={folder.id} onClick={() => addCompositionItem('folder', folder.id)}>📁 {folder.name}</button>) : <div className="csp-add-item-empty"><p>{folders.length ? 'Folder ทั้งหมดถูกวางบนหน้าโปรไฟล์แล้ว' : 'ยังไม่มี Folder ให้เลือก'}</p>{folders.length === 0 && onOpenFolderManager && <button type="button" className="csp-secondary-button" onClick={() => { setAddItemOpen(false); onOpenFolderManager(); }}>สร้างโฟลเดอร์</button>}</div>)}
      </div>
    </section>;
  };
  const renderFreeAddAction = () => layout === 'free' && isCustomizeOpen && isEditing ? <div className="csp-free-add-anchor"><button type="button" className="csp-add-block-tile" onClick={() => setAddItemOpen(true)}><Plus className="h-4 w-4" />เพิ่มรายการ</button>{renderAddItemPicker()}</div> : null;
  const renderRail = (items: CreatorWidgetType[]) => <div className="csp-rail">{items.map(type => renderWidget(type))}</div>;
  const renderComposition = () => {
    if (layout === 'free') return <><section ref={freeCanvasRef} className="csp-free-canvas" aria-label="Free layout 12-column canvas" onDragOver={handleFreeDragOver} onDrop={handleFreeDrop}>{visibleFreePlacements.map(renderFreePlacement)}{dropPreview && draggingPlacementId && isEditing && <div className="csp-free-drop-preview" aria-hidden="true" style={{ gridColumn: `${dropPreview.x + 1} / span ${dropPreview.w}`, gridRow: `${dropPreview.y + 1} / span ${dropPreview.h}` }} />}</section>{renderFreeAddAction()}</>;
    if (lockedPreset === 'right') return <section className="csp-composition csp-locked-right">{renderPortfolio()}{renderRail(widgets)}</section>;
    if (lockedPreset === 'split') return <section className="csp-composition csp-locked-split">{renderRail(widgets.filter(type => widgetRail[type] === 'left'))}{renderPortfolio()}{renderRail(widgets.filter(type => widgetRail[type] === 'right'))}</section>;
    return <section className="csp-composition csp-locked-left">{renderRail(widgets)}{renderPortfolio()}</section>;
  };

  const editingWidgetInstance = editingWidget?.instanceId ? widgetInstanceMap.get(editingWidget.instanceId) : undefined;
  const editingWidgetConfig = editingWidgetInstance
    ? editingWidgetInstance.config as CreatorWidgetConfig
    : editingWidget ? widgetConfigs[editingWidget.type] || {} : {};
  const editingWidgetDisplayName = editingWidget
    ? editingWidgetInstance?.title || widgetTitles[editingWidget.type] || ''
    : '';
  const updateEditingWidget = (config: CreatorWidgetConfig) => {
    if (!editingWidget) return;
    if (editingWidget.instanceId) {
      setWidgetInstances(previous => updateFreeWidgetInstance(previous, editingWidget.instanceId!, config as Record<string, unknown>));
      return;
    }
    setWidgetConfigs(previous => ({ ...previous, [editingWidget.type]: config }));
  };
  const updateEditingWidgetDisplayName = (displayName: string) => {
    if (!editingWidget) return;
    if (editingWidget.instanceId) {
      setWidgetInstances(previous => updateFreeWidgetInstance(previous, editingWidget.instanceId!, editingWidgetConfig as Record<string, unknown>, displayName));
      return;
    }
    setWidgetTitles(previous => ({ ...previous, [editingWidget.type]: displayName }));
  };

  return <div className="csp-route min-h-screen">
    <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} activeView="feed" onViewChange={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }} onOpenCreateModal={handleCreateAsset} onOpenAuthModal={onOpenAuth} onOpenSignUpModal={() => openAuthModal('signup')} onOpenSettingsModal={onOpenSettingsModal} creatorMode />
    <main className="csp-main mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="csp-breadcrumb"><a href="/">CXL Studio</a><span aria-hidden="true">/</span><span>โปรไฟล์ครีเอเตอร์</span></div>
      {isProfileLoading && !profile && <section className="csp-loading" aria-label="กำลังโหลดโปรไฟล์ครีเอเตอร์"><div /><div className="csp-loading-body"><span /><span /><span /></div></section>}
      {!isProfileLoading && !profile && <section className="csp-empty csp-route-state" role="alert"><div className="csp-empty-icon"><UserRound className="h-6 w-6" /></div><h1>{isNotFound ? 'ไม่พบโปรไฟล์ครีเอเตอร์' : 'โหลดโปรไฟล์ไม่สำเร็จ'}</h1><p>{error || (isNotFound ? 'โปรไฟล์นี้อาจยังไม่มีอยู่ หรือ URL ไม่ถูกต้อง' : 'ระบบโปรไฟล์ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง')}</p><div className="csp-state-actions"><button type="button" onClick={() => void refresh()} className="csp-secondary-button"><RefreshCw className="h-3.5 w-3.5" />ลองใหม่</button><a href="/" className="csp-primary-button">กลับหน้าแรก</a></div></section>}
      {profile && <>
       {isCustomizeOpen && isEditing && activeTab === 'profile' && <CreatorCustomizePanel layout={layout} lockedPreset={lockedPreset} widgets={widgets} widgetRail={widgetRail} spans={spans} onLayoutChange={handleLayoutChange} onLockedPresetChange={setLockedPreset} onAddWidget={addWidget} onRemoveWidget={removeWidget} onMoveWidget={moveWidget} onMoveRail={(type, rail) => setWidgetRail(previous => ({ ...previous, [type]: rail }))} onSpanChange={handleSpanChange} onClose={() => { setIsCustomizeOpen(false); setAddItemOpen(false); }} />}
        <section className="csp-profile-header" aria-labelledby="csp-profile-title">
           <div className="csp-cover">{profile.coverUrl ? <img src={profile.coverUrl} alt="ภาพปกโปรไฟล์" referrerPolicy="no-referrer" /> : <div className="csp-cover-fallback" aria-hidden="true" />}<span>PROFILE</span>{isEditing && <button type="button" onClick={() => setIsProfileOpen(true)}>🖼 เปลี่ยนภาพปก</button>}</div>
           <div className="csp-profile-surface"><div className="csp-profile-identity"><div className="csp-avatar-column"><div className="csp-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="รูปโปรไฟล์" referrerPolicy="no-referrer" /> : <span>{getInitial(displayName)}</span>}</div><div className="csp-desktop-stats"><span><strong>{visibleAssets.length}</strong> ผลงาน</span>{isEditing && <span><strong>{visibleFolderCount}</strong> โฟลเดอร์</span>}<span><strong>{publicAssets.length}</strong> สาธารณะ</span></div></div><div className="csp-identity-copy"><div className="csp-name-row"><h1 id="csp-profile-title">{displayName}</h1>{isEditing && <><span className="csp-owner-badge">พื้นที่ส่วนตัว</span><button type="button" className="csp-edit-icon" onClick={() => setIsProfileOpen(true)} aria-label="แก้ไขข้อมูลโปรไฟล์" title="แก้ไขโปรไฟล์"><Edit3 className="h-3.5 w-3.5" /></button></>}</div><p className="csp-username">@{profile.username || 'ยังไม่ได้ตั้งชื่อผู้ใช้'}</p><p className="csp-bio">{profile.bio || (isEditing ? 'ยังไม่ได้เพิ่มคำแนะนำตัว' : 'Creator คนนี้ยังไม่ได้เพิ่มคำแนะนำตัว')}</p>{socialLinks.length > 0 && <div className="csp-social-links" aria-label="ช่องทางหลักของโปรไฟล์">{socialLinks.map(link => { const Icon = getSocialIcon(link.platform); const href = getSafeHref(link.url); return href ? <a href={href} target="_blank" rel="noreferrer" key={link.id || `${link.platform}-${link.label}`}><Icon className="h-3.5 w-3.5" />{link.label}</a> : null; })}</div>}</div></div><div className="csp-mobile-stats"><span><strong>{visibleAssets.length}</strong> ผลงาน</span>{isEditing && <span><strong>{visibleFolderCount}</strong> โฟลเดอร์</span>}<span><strong>{publicAssets.length}</strong> สาธารณะ</span></div><div className="csp-profile-actions">{isEditing ? <><span>เฉพาะคุณเท่านั้น</span><button type="button" className="csp-secondary-button" onClick={toggleCustomize}><Settings2 className="h-3.5 w-3.5" />{isCustomizeOpen ? 'ปิดการตกแต่ง' : 'ตกแต่งโปรไฟล์'}</button><button type="button" className="csp-primary-button" onClick={handleCreateAsset}><Plus className="h-4 w-4" />สร้างผลงาน</button></> : <><button type="button" className="csp-secondary-button" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}><Share2 className="h-3.5 w-3.5" />แชร์โปรไฟล์</button>{!isOwner && <button type="button" className="csp-secondary-button" onClick={() => onOpenAuth()}><Link2 className="h-3.5 w-3.5" />เข้าสู่ระบบ</button>}</>}</div>{isCustomizeOpen && isEditing && <span className="csp-core-lock">🔒 ส่วนหลัก</span>}</div>
           {isOwner && previewViewer === 'owner' && <nav className="csp-tabs" aria-label="เมนูจัดการโปรไฟล์">{([['profile', 'หน้าโปรไฟล์'], ['works', 'ผลงาน'], ['folders', 'โฟลเดอร์'], ['drafts', 'แบบร่าง'], ['saved', 'บันทึกไว้'], ['recent', 'ล่าสุด'], ['trash', 'ถังขยะ']] as const).map(([value, label]) => <button type="button" key={value} className={activeTab === value ? 'is-active' : ''} onClick={() => selectTab(value)}>{label}</button>)}<span>พื้นที่ส่วนตัว</span></nav>}
           {resolvedView.isPublicView && <nav className="csp-tabs" aria-label="เมนูโปรไฟล์สาธารณะ">{([['profile', 'หน้าโปรไฟล์'], ['works', 'ผลงานทั้งหมด']] as const).map(([value, label]) => <button type="button" key={value} className={activeTab === value ? 'is-active' : ''} onClick={() => selectTab(value)}>{label}</button>)}</nav>}
        </section>
       {isOwner && <section className="csp-viewer-toolbar" aria-label="ดูแบบผู้เยี่ยมชม"><span>มุมมองโปรไฟล์</span><button type="button" className={previewViewer === 'owner' ? 'is-active' : ''} onClick={() => setPublicPreview(false)}>Owner</button><button type="button" className={previewViewer === 'public' ? 'is-active' : ''} onClick={() => setPublicPreview(true)}>ดูแบบผู้เยี่ยมชม</button><small>{previewViewer === 'public' ? 'กำลังแสดงผลแบบผู้เยี่ยมชม — เนื้อหาส่วนตัวและเครื่องมือจัดการถูกซ่อนแล้ว' : 'กำลังจัดการโปรไฟล์ของคุณ'}</small></section>}
       {activeTab === 'profile' && renderComposition()}
       {activeTab === 'folders' && isEditing && <section className="csp-portfolio"><div className="csp-section-heading"><div><p className="csp-eyebrow">FOLDERS</p><h2>โฟลเดอร์</h2><p>จัดการโฟลเดอร์ทั้งหมดของคุณ</p></div><div className="csp-heading-actions"><span>{folders.length} รายการ</span>{onOpenFolderManager && <button type="button" className="csp-secondary-button" onClick={onOpenFolderManager}><Settings2 className="h-3.5 w-3.5" />จัดการโฟลเดอร์</button>}</div></div>{isProfileFoldersLoading ? <div className="csp-empty" aria-busy="true"><h3>กำลังโหลดโฟลเดอร์...</h3></div> : folders.length ? <div className={`csp-folder-directory ${folderView === 'compact' ? 'is-compact' : ''} ${folderView === 'list' ? 'is-list' : ''}`}>{displayFolders.map(folder => <button type="button" key={folder.id} data-folder-id={folder.id} className="csp-folder-card" onClick={() => openFolderDetail(folder.id)}><span>{folder.icon || '📁'}</span><strong>{folder.name}</strong><small>{folderAssetCount(folder, visibleAssets)} ผลงาน</small></button>)}</div> : <div className="csp-empty"><h3>ยังไม่มีโฟลเดอร์</h3></div>}</section>}
       {(['works', 'drafts', 'saved', 'recent', 'trash'] as const).includes(activeTab as 'works' | 'drafts' | 'saved' | 'recent' | 'trash') && (isEditing || activeTab === 'works') && <section className="csp-portfolio"><div className="csp-section-heading"><div><p className="csp-eyebrow">{isEditing ? 'MANAGE' : 'WORKS'}</p><h2>{activeTab === 'works' ? 'ผลงาน' : activeTab === 'drafts' ? 'แบบร่าง' : activeTab === 'saved' ? 'บันทึกไว้' : activeTab === 'recent' ? 'ล่าสุด' : 'ถังขยะ'}</h2><p>{!isEditing && activeTab === 'works' ? 'ผลงานสาธารณะทั้งหมดของ Creator' : activeTab === 'saved' ? 'ผลงานสาธารณะจาก Creator คนอื่นที่คุณบันทึกไว้' : activeTab === 'recent' ? 'ผลงานที่คุณเปิดล่าสุด' : activeTab === 'trash' ? 'ผลงานที่ลบแล้วของคุณ' : 'จัดการผลงานของคุณ'}</p></div><span>{managementAssets.length} รายการ</span></div>{isProfileAssetsLoading ? <div className="csp-empty" aria-busy="true"><h3>กำลังโหลดผลงาน...</h3></div> : managementAssets.length ? <div className="csp-asset-grid">{managementAssets.map(asset => <AssetCard key={asset.id} asset={asset} onClick={setSelectedAsset} onEdit={isEditing && (activeTab === 'works' || activeTab === 'drafts') ? onEditAsset : undefined} isOwner={isEditing && asset.userId === currentUser?.id} />)}</div> : <div className="csp-empty"><h3>ยังไม่มีรายการ</h3><p>{activeTab === 'saved' ? 'ผลงานที่บันทึกไว้จะแสดงที่นี่' : activeTab === 'recent' ? 'ผลงานที่เปิดล่าสุดจะแสดงที่นี่' : activeTab === 'works' && !isEditing ? 'ยังไม่มีผลงานสาธารณะ' : 'ไม่มีผลงานในส่วนนี้'}</p></div>}</section>}
      </>}
    </main>
    <WorkDetailModal asset={selectedAsset} isOpen={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} onEdit={isEditing && onEditAsset ? asset => { setSelectedAsset(null); onEditAsset(asset); } : undefined} onMoveToFolder={isEditing && onOpenMoveToFolder ? asset => { setSelectedAsset(null); onOpenMoveToFolder(asset); } : undefined} folders={folders} allAssets={visibleAssets} isOwner={isEditing} creatorProfile={presentationProfile} />
    <FolderDetailModal isOpen={Boolean(selectedFolder)} folder={selectedFolder} assets={visibleAssets} isOwner={isEditing} creatorProfile={presentationProfile} onClose={() => setSelectedFolderId(null)} onOpenWork={asset => { setSelectedFolderId(null); setSelectedAsset(asset); }} onEditWork={onEditAsset ? asset => { setSelectedFolderId(null); onEditAsset(asset); } : undefined} onMoveWork={onOpenMoveToFolder ? asset => { setSelectedFolderId(null); onOpenMoveToFolder(asset); } : undefined} onRemoveWork={onMoveAssetToFolder ? assetId => onMoveAssetToFolder(assetId, null) : undefined} />
    {isCustomizeOpen && isEditing && editingWidget && <CreatorWidgetEditor type={editingWidget.type} config={editingWidgetConfig} displayName={editingWidgetDisplayName} contextual instanceId={editingWidget.instanceId} onChange={updateEditingWidget} onDisplayNameChange={updateEditingWidgetDisplayName} onClose={() => setEditingWidget(null)} />}
    <ProfileEditModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onSaved={savedUser => { const nextSlug = getCanonicalProfileSlug(savedUser); if (nextSlug === activeSlug) void refresh(); setActiveSlug(nextSlug); window.history.replaceState({}, '', getCanonicalProfilePath(savedUser)); }} />
  </div>;
};
