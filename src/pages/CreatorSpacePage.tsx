import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Edit3, Globe2, Instagram, Link2, Mail, Plus, RefreshCw, Settings2, Share2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Asset, AssetCategory, Folder, ProfileSocialLink } from '../types';
import { CATEGORIES } from '../lib/constants';
import { isPublicFeedVisibility } from '../lib/assetVisibility';
import { AssetCard } from '../components/AssetCard';
import { AssetViewModal } from '../components/AssetViewModal';
import { Header } from '../components/Header';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { CreatorCustomizePanel, CreatorWidgetControls, type CreatorLayout, type CreatorWidgetType, type LockedPreset, CREATOR_WIDGET_ICONS, CREATOR_WIDGET_LABELS } from '../components/creator/CreatorCustomizePanel';
import { CreatorWidgetEditor, type CreatorWidgetConfig } from '../components/creator/CreatorWidgetEditor';
import { getCreatorVisibleAssets, useCreatorSpaceData } from '../hooks/useCreatorSpaceData';
import { isMockPersistence } from '../lib/persistenceMode';
import { readCreatorSpaceSettings, writeCreatorSpaceSettings } from '../lib/creatorPersistence';
import { parseCanonicalProfileLocation, resolveProfileView, type ProfileTab } from '../lib/profileRouting';
import { getCanonicalProfilePath, getCanonicalProfileSlug } from '../lib/profileIdentity';

interface CreatorSpacePageProps {
  // The canonical profile is the home for profile identity editing.
  onCreateAsset: () => void;
  onEditAsset?: (asset: Asset) => void;
  slug: string;
  onOpenAuth: () => void;
  onOpenFolderManager?: () => void;
  onOpenSettingsModal?: () => void;
  allKnownAssets?: Asset[];
  bookmarkedAssetIds?: string[];
  recentlyViewedIds?: string[];
  onDeleteAsset?: (asset: Asset) => void;
  onRestoreAsset?: (assetId: string) => void;
}

const CATEGORY_ORDER: Array<AssetCategory | 'all'> = ['all', 'character', 'lore', 'ui_code', 'prompts', 'collab', 'app_data'];
const DEFAULT_WIDGETS: CreatorWidgetType[] = ['folder', 'playlist', 'todo', 'note', 'status', 'goal', 'gallery', 'clock'];
const DEFAULT_RAILS: Record<CreatorWidgetType, 'left' | 'right'> = { folder: 'left', playlist: 'left', todo: 'left', note: 'left', status: 'right', links: 'right', goal: 'right', gallery: 'right', clock: 'right', calendar: 'left', single_image: 'right', decoration: 'left' };
const DEFAULT_SPANS: Record<string, number> = { portfolio: 9, folder: 3, playlist: 4, todo: 4, note: 4, status: 4, links: 4, goal: 6, gallery: 6, clock: 3 };

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
    return asset.title.toLowerCase().includes(query) || asset.content.toLowerCase().includes(query) || Boolean(asset.tags?.some(tag => tag.toLowerCase().includes(query)));
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
}

const WidgetCard: React.FC<WidgetCardProps> = ({ type, folders, assets, profile, isOwner, editing, layout, lockedPreset, title, span, rail, onMove, onRemove, onRail, onSpan, onEdit, config, onToggleTodo, onDrop }) => {
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
  return <article draggable={editing} onDragOver={event => { if (editing) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (editing) onDrop(type); }} onDragStart={event => event.dataTransfer.setData('text/plain', type)} className={`csp-widget ${layout === 'free' ? 'csp-layout-block' : ''}`} style={layout === 'free' ? { gridColumn: `span ${span}` } : undefined}>
    {editing && <CreatorWidgetControls type={type} layout={layout} lockedPreset={lockedPreset} span={span} rail={rail} onMove={onMove} onEdit={onEdit} onRemove={onRemove} onRail={onRail} onSpan={onSpan} />}
    <div className="csp-widget-heading"><span><b>{CREATOR_WIDGET_ICONS[type]}</b>{title || CREATOR_WIDGET_LABELS[type]}</span>{type === 'folder' && <small>{folders.length} รายการ</small>}</div>
    <div className="csp-widget-body">{content[type]}</div>
  </article>;
};

export const CreatorSpacePage: React.FC<CreatorSpacePageProps> = ({ slug, onCreateAsset, onEditAsset, onOpenAuth, onOpenFolderManager, onOpenSettingsModal, allKnownAssets = [], bookmarkedAssetIds = [], recentlyViewedIds = [], onDeleteAsset, onRestoreAsset }) => {
  const { currentUser, openAuthModal } = useAuth();
  const [activeSlug, setActiveSlug] = useState(slug);
  const { profile, assets, folders, isLoading, isNotFound, error, refresh } = useCreatorSpaceData(activeSlug, currentUser?.id, currentUser);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestedTab, setRequestedTab] = useState<ProfileTab>(() => parseCanonicalProfileLocation(window.location.pathname, window.location.search)?.requestedTab || 'profile');
  const [layout, setLayout] = useState<CreatorLayout>('locked');
  const [lockedPreset, setLockedPreset] = useState<LockedPreset>('left');
  const [widgets, setWidgets] = useState<CreatorWidgetType[]>(DEFAULT_WIDGETS);
  const [widgetRail, setWidgetRail] = useState(DEFAULT_RAILS);
  const [spans, setSpans] = useState(DEFAULT_SPANS);
  const [freeOrder, setFreeOrder] = useState<Array<'portfolio' | CreatorWidgetType>>(['folder', 'portfolio', 'status', 'note', 'links', 'playlist', 'goal', 'gallery', 'clock']);
  const [widgetTitles, setWidgetTitles] = useState<Partial<Record<CreatorWidgetType, string>>>({});
  const [editingWidget, setEditingWidget] = useState<CreatorWidgetType | null>(null);
  const [widgetConfigs, setWidgetConfigs] = useState<Partial<Record<CreatorWidgetType, CreatorWidgetConfig>>>({ todo: { items: [{ label: 'เตรียมโครงสร้างผลงาน', done: false }, { label: 'ตรวจ reference', done: true }], showCompleted: true }, goal: { goal: 35 }, gallery: { goal: 3 } });
  const [previewViewer, setPreviewViewer] = useState<'owner' | 'public'>(() => parseCanonicalProfileLocation(window.location.pathname, window.location.search)?.previewPublic ? 'public' : 'owner');
  const [folderView, setFolderView] = useState<'grid' | 'compact' | 'list'>('grid');
  const [folderSort, setFolderSort] = useState<'recent' | 'name' | 'count'>('recent');

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
    if (profile && resolvedView.isPublicView && requestedTab !== 'profile') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      setRequestedTab('profile');
    }
  }, [profile, requestedTab, resolvedView.isPublicView]);

  useEffect(() => {
    if (!isMockPersistence || !profile || !isOwner) return;
    setSettingsHydrated(false);
    const saved = readCreatorSpaceSettings(profile.id);
    if (saved) {
      if (saved.layout) setLayout(saved.layout);
      if (saved.lockedPreset) setLockedPreset(saved.lockedPreset);
      if (saved.widgets) setWidgets(saved.widgets as CreatorWidgetType[]);
      if (saved.widgetRail) setWidgetRail(previous => ({ ...previous, ...saved.widgetRail }));
      if (saved.spans) setSpans(previous => ({ ...previous, ...saved.spans }));
      if (saved.freeOrder) setFreeOrder(saved.freeOrder as Array<'portfolio' | CreatorWidgetType>);
      if (saved.widgetTitles) setWidgetTitles(saved.widgetTitles);
      if (saved.widgetConfigs) setWidgetConfigs(saved.widgetConfigs as Partial<Record<CreatorWidgetType, CreatorWidgetConfig>>);
    }
    setSettingsHydrated(true);
  }, [isOwner, profile?.id]);

  useEffect(() => {
    if (!isMockPersistence || !isOwner || !profile || !settingsHydrated) return;
    writeCreatorSpaceSettings(profile.id, { layout, lockedPreset, widgets, widgetRail, spans, freeOrder, widgetTitles, widgetConfigs: widgetConfigs as Record<string, Record<string, unknown>> });
  }, [freeOrder, isOwner, layout, lockedPreset, profile?.id, settingsHydrated, spans, widgetConfigs, widgetRail, widgetTitles, widgets]);
  const visibleAssets = useMemo(() => getCreatorVisibleAssets(assets, isEditing), [assets, isEditing]);
  const filteredAssets = useMemo(() => filterAssets(visibleAssets, selectedCategory, isEditing ? visibility : 'all', searchQuery), [isEditing, searchQuery, selectedCategory, visibility, visibleAssets]);
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
  const socialLinks = (profile?.socialLinks || []).filter(link => link.visible && getSafeHref(link.url));
  const displayName = profile?.displayName || 'Creator';

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
  };
  const setPublicPreview = (enabled: boolean) => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('preview', 'public'); else url.searchParams.delete('preview');
    if (enabled) url.searchParams.delete('tab');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setPreviewViewer(enabled ? 'public' : 'owner');
    if (enabled) { setRequestedTab('profile'); setIsCustomizeOpen(false); setEditingWidget(null); }
  };

  const moveWidget = (type: CreatorWidgetType, direction: -1 | 1) => {
    setWidgets(previous => {
      const next = [...previous]; const index = next.indexOf(type); const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  };

  const moveFreeBlock = (type: 'portfolio' | CreatorWidgetType, direction: -1 | 1) => {
    setFreeOrder(previous => {
      const next = [...previous]; const index = next.indexOf(type); const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  };

  const renderPortfolio = (free = false) => <section className={free ? 'csp-portfolio csp-layout-block' : 'csp-portfolio'} style={free ? { gridColumn: `span ${spans.portfolio}` } : undefined}>
    {isCustomizeOpen && <div className="csp-portfolio-edit-bar"><span>▦ Portfolio · ส่วนหลัก</span><div>{layout === 'free' && <><select value={spans.portfolio} onChange={event => setSpans(previous => ({ ...previous, portfolio: Number(event.target.value) }))} aria-label="ความกว้าง Portfolio">{[3, 4, 6, 8, 9, 12].map(value => <option value={value} key={value}>{value} / 12 คอลัมน์</option>)}</select><button type="button" onClick={() => moveFreeBlock('portfolio', -1)} aria-label="เลื่อน Portfolio ขึ้น">↑</button><button type="button" onClick={() => moveFreeBlock('portfolio', 1)} aria-label="เลื่อน Portfolio ลง">↓</button></>}</div></div>}
    <div className="csp-section-heading"><div><p className="csp-eyebrow">PORTFOLIO</p><h2>ผลงานของ {displayName}</h2><p>ผลงานที่จัดแสดงจากคลังจริงของ Creator</p></div><span>{filteredAssets.length} รายการ</span></div>
    <div className="csp-creator-filters"><div className="csp-filter-row" aria-label="กรองตามหมวดหมู่">{CATEGORY_ORDER.map(category => <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={selectedCategory === category ? 'is-active' : ''}>{category === 'all' ? 'ทั้งหมด' : CATEGORIES[category].name}</button>)}</div>{isEditing && <div className="csp-filter-row" aria-label="กรองตามการมองเห็น">{(['all', 'public', 'private'] as const).map(value => <button key={value} type="button" onClick={() => setVisibility(value)} className={visibility === value ? 'is-active' : ''}>{value === 'all' ? 'ทั้งหมด' : value === 'public' ? 'สาธารณะ' : 'ส่วนตัว'}</button>)}</div>}</div>
    {filteredAssets.length > 0 ? <div className="csp-asset-grid">{filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} onClick={setSelectedAsset} onEdit={isEditing ? onEditAsset : undefined} isOwner={isEditing} />)}</div> : <div className="csp-empty"><div className="csp-empty-icon"><Edit3 className="h-5 w-5" /></div><h3>{searchQuery ? `ไม่พบผลงานที่ตรงกับ “${searchQuery}”` : isEditing ? 'ยังไม่มีผลงานในพื้นที่ของคุณ' : 'Creator คนนี้ยังไม่มีผลงานสาธารณะ'}</h3><p>{isEditing ? 'เริ่มจากผลงานที่มีอยู่ในคลัง หรือเปิด workspace เพื่อเตรียมผลงานใหม่' : 'ผลงานสาธารณะที่ Creator เลือกแสดงจะปรากฏที่นี่'}</p>{isEditing && !searchQuery && <button type="button" onClick={handleCreateAsset} className="csp-primary-button"><Plus className="h-4 w-4" />สร้างผลงาน</button>}</div>}
  </section>;

  const renderWidget = (type: CreatorWidgetType) => {
    const config = widgetConfigs[type] || {};
    if (previewViewer === 'public' && (config.visibility === 'private' || type === 'todo' || type === 'folder')) return null;
    return <WidgetCard key={type} type={type} folders={folders} assets={visibleAssets} profile={{ displayName }} isOwner={isEditing} editing={isCustomizeOpen} layout={layout} lockedPreset={lockedPreset} title={widgetTitles[type] || config.title} span={spans[type] || 4} rail={widgetRail[type]} config={config} onToggleTodo={index => { if (type !== 'todo') return; const items = widgetConfigs.todo?.items || []; setWidgetConfigs(previous => ({ ...previous, todo: { ...previous.todo, items: items.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item) } })); }} onDrop={target => { if (layout !== 'free') return; setFreeOrder(previous => { const from = previous.indexOf(type); const to = previous.indexOf(target); if (from < 0 || to < 0 || from === to) return previous; const next = [...previous]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }); }} onMove={direction => layout === 'free' ? moveFreeBlock(type, direction) : moveWidget(type, direction)} onEdit={() => setEditingWidget(type)} onRemove={() => { setWidgets(previous => previous.filter(item => item !== type)); setFreeOrder(previous => previous.filter(item => item !== type)); }} onRail={rail => setWidgetRail(previous => ({ ...previous, [type]: rail }))} onSpan={span => setSpans(previous => ({ ...previous, [type]: span }))} />;
  };

  const renderAddBlock = (label: string) => isCustomizeOpen ? <button type="button" className="csp-add-block-tile" onClick={() => setIsCustomizeOpen(true)}><Plus className="h-4 w-4" />{label}</button> : null;
  const renderRail = (items: CreatorWidgetType[]) => <div className="csp-rail">{items.map(renderWidget)}{renderAddBlock('เพิ่มบล็อกใน rail')}</div>;
  const renderComposition = () => {
    if (layout === 'free') return <section className="csp-free-canvas" aria-label="Free layout 12-column canvas">{widgets.map(renderWidget)}{renderPortfolio(true)}{renderAddBlock('เพิ่มบล็อก')}</section>;
    if (lockedPreset === 'right') return <section className="csp-composition csp-locked-right">{renderPortfolio()}{renderRail(widgets)}</section>;
    if (lockedPreset === 'split') return <section className="csp-composition csp-locked-split">{renderRail(widgets.filter(type => widgetRail[type] === 'left'))}{renderPortfolio()}{renderRail(widgets.filter(type => widgetRail[type] === 'right'))}</section>;
    return <section className="csp-composition csp-locked-left">{renderRail(widgets)}{renderPortfolio()}</section>;
  };

  return <div className="csp-route min-h-screen">
    <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} activeView="feed" onViewChange={() => window.location.assign('/')} onOpenCreateModal={handleCreateAsset} onOpenAuthModal={onOpenAuth} onOpenSignUpModal={() => openAuthModal('signup')} onOpenSettingsModal={onOpenSettingsModal} creatorMode />
    <main className="csp-main mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="csp-breadcrumb"><a href="/">CXL Studio</a><span aria-hidden="true">/</span><span>โปรไฟล์ครีเอเตอร์</span></div>
      {isLoading && !profile && <section className="csp-loading" aria-label="กำลังโหลดโปรไฟล์ครีเอเตอร์"><div /><div className="csp-loading-body"><span /><span /><span /></div></section>}
      {!isLoading && !profile && <section className="csp-empty csp-route-state" role="alert"><div className="csp-empty-icon"><UserRound className="h-6 w-6" /></div><h1>{isNotFound ? 'ไม่พบโปรไฟล์ครีเอเตอร์' : 'โหลดโปรไฟล์ไม่สำเร็จ'}</h1><p>{error || (isNotFound ? 'โปรไฟล์นี้อาจยังไม่มีอยู่ หรือ URL ไม่ถูกต้อง' : 'ระบบโปรไฟล์ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง')}</p><div className="csp-state-actions"><button type="button" onClick={() => void refresh()} className="csp-secondary-button"><RefreshCw className="h-3.5 w-3.5" />ลองใหม่</button><a href="/" className="csp-primary-button">กลับหน้าแรก</a></div></section>}
      {profile && <>
       {isCustomizeOpen && isEditing && activeTab === 'profile' && <CreatorCustomizePanel layout={layout} lockedPreset={lockedPreset} widgets={widgets} widgetRail={widgetRail} spans={spans} onLayoutChange={setLayout} onLockedPresetChange={setLockedPreset} onAddWidget={(type, rail) => { if (!widgets.includes(type)) { setWidgets(previous => [...previous, type]); setFreeOrder(previous => previous.includes(type) ? previous : [...previous, type]); if (rail) setWidgetRail(previous => ({ ...previous, [type]: rail })); } }} onRemoveWidget={type => { setWidgets(previous => previous.filter(item => item !== type)); setFreeOrder(previous => previous.filter(item => item !== type)); }} onMoveWidget={moveWidget} onMoveRail={(type, rail) => setWidgetRail(previous => ({ ...previous, [type]: rail }))} onSpanChange={(type, span) => setSpans(previous => ({ ...previous, [type]: span }))} onClose={() => setIsCustomizeOpen(false)} />}
        {isCustomizeOpen && isEditing && editingWidget && <CreatorWidgetEditor type={editingWidget} config={widgetConfigs[editingWidget] || {}} onChange={config => setWidgetConfigs(previous => ({ ...previous, [editingWidget]: config }))} onClose={() => setEditingWidget(null)} />}
        <section className="csp-profile-header" aria-labelledby="csp-profile-title">
           <div className="csp-cover">{profile.coverUrl ? <img src={profile.coverUrl} alt="ภาพปกโปรไฟล์" referrerPolicy="no-referrer" /> : <div className="csp-cover-fallback" aria-hidden="true" />}<span>PROFILE</span>{isEditing && <button type="button" onClick={() => setIsProfileOpen(true)}>🖼 เปลี่ยนภาพปก</button>}</div>
           <div className="csp-profile-surface"><div className="csp-profile-identity"><div className="csp-avatar-column"><div className="csp-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="รูปโปรไฟล์" referrerPolicy="no-referrer" /> : <span>{getInitial(displayName)}</span>}</div><div className="csp-desktop-stats"><span><strong>{visibleAssets.length}</strong> ผลงาน</span>{isEditing && <span><strong>{visibleFolderCount}</strong> โฟลเดอร์</span>}<span><strong>{publicAssets.length}</strong> สาธารณะ</span></div></div><div className="csp-identity-copy"><div className="csp-name-row"><h1 id="csp-profile-title">{displayName}</h1>{isEditing && <><span className="csp-owner-badge">พื้นที่ส่วนตัว</span><button type="button" className="csp-edit-icon" onClick={() => setIsProfileOpen(true)} aria-label="แก้ไขข้อมูลโปรไฟล์" title="แก้ไขโปรไฟล์"><Edit3 className="h-3.5 w-3.5" /></button></>}</div><p className="csp-username">@{profile.username || 'ยังไม่ได้ตั้งชื่อผู้ใช้'}</p><p className="csp-bio">{profile.bio || (isEditing ? 'ยังไม่ได้เพิ่มคำแนะนำตัว' : 'Creator คนนี้ยังไม่ได้เพิ่มคำแนะนำตัว')}</p>{socialLinks.length > 0 && <div className="csp-social-links" aria-label="ช่องทางหลักของโปรไฟล์">{socialLinks.map(link => { const Icon = getSocialIcon(link.platform); const href = getSafeHref(link.url); return href ? <a href={href} target="_blank" rel="noreferrer" key={link.id || `${link.platform}-${link.label}`}><Icon className="h-3.5 w-3.5" />{link.label}</a> : null; })}</div>}</div></div><div className="csp-mobile-stats"><span><strong>{visibleAssets.length}</strong> ผลงาน</span>{isEditing && <span><strong>{visibleFolderCount}</strong> โฟลเดอร์</span>}<span><strong>{publicAssets.length}</strong> สาธารณะ</span></div><div className="csp-profile-actions">{isEditing ? <><span>เฉพาะคุณเท่านั้น</span><button type="button" className="csp-secondary-button" onClick={() => setIsCustomizeOpen(value => !value)}><Settings2 className="h-3.5 w-3.5" />{isCustomizeOpen ? 'ปิดการตกแต่ง' : 'ตกแต่งโปรไฟล์'}</button><button type="button" className="csp-primary-button" onClick={handleCreateAsset}><Plus className="h-4 w-4" />สร้างผลงาน</button></> : <><button type="button" className="csp-secondary-button" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}><Share2 className="h-3.5 w-3.5" />แชร์โปรไฟล์</button>{!isOwner && <button type="button" className="csp-secondary-button" onClick={() => onOpenAuth()}><Link2 className="h-3.5 w-3.5" />เข้าสู่ระบบ</button>}</>}</div>{isCustomizeOpen && isEditing && <span className="csp-core-lock">🔒 ส่วนหลัก</span>}</div>
           {isOwner && previewViewer === 'owner' && <nav className="csp-tabs" aria-label="เมนูจัดการโปรไฟล์">{([['profile', 'หน้าโปรไฟล์'], ['works', 'ผลงาน'], ['folders', 'โฟลเดอร์'], ['drafts', 'แบบร่าง'], ['saved', 'บันทึกไว้'], ['recent', 'ล่าสุด'], ['trash', 'ถังขยะ']] as const).map(([value, label]) => <button type="button" key={value} className={activeTab === value ? 'is-active' : ''} onClick={() => selectTab(value)}>{label}</button>)}<span>พื้นที่ส่วนตัว</span></nav>}
        </section>
       {isOwner && <section className="csp-viewer-toolbar" aria-label="ดูแบบผู้เยี่ยมชม"><span>มุมมองโปรไฟล์</span><button type="button" className={previewViewer === 'owner' ? 'is-active' : ''} onClick={() => setPublicPreview(false)}>Owner</button><button type="button" className={previewViewer === 'public' ? 'is-active' : ''} onClick={() => setPublicPreview(true)}>ดูแบบผู้เยี่ยมชม</button><small>{previewViewer === 'public' ? 'กำลังแสดงผลแบบผู้เยี่ยมชม — เนื้อหาส่วนตัวและเครื่องมือจัดการถูกซ่อนแล้ว' : 'กำลังจัดการโปรไฟล์ของคุณ'}</small></section>}
       {activeTab === 'profile' && (layout === 'free' ? <section className="csp-free-canvas" aria-label="Free layout 12-column canvas">{freeOrder.map(type => type === 'portfolio' ? renderPortfolio(true) : widgets.includes(type) ? renderWidget(type) : null)}{renderAddBlock('เพิ่มรายการ')}</section> : renderComposition())}
       {activeTab === 'folders' && isEditing && <section className="csp-portfolio"><div className="csp-section-heading"><div><p className="csp-eyebrow">FOLDERS</p><h2>โฟลเดอร์</h2><p>จัดการโฟลเดอร์ทั้งหมดของคุณ</p></div><div className="csp-heading-actions"><span>{folders.length} รายการ</span>{onOpenFolderManager && <button type="button" className="csp-secondary-button" onClick={onOpenFolderManager}><Settings2 className="h-3.5 w-3.5" />จัดการโฟลเดอร์</button>}</div></div>{folders.length ? <div className={`csp-folder-directory ${folderView === 'compact' ? 'is-compact' : ''} ${folderView === 'list' ? 'is-list' : ''}`}>{displayFolders.map(folder => <button type="button" key={folder.id} className="csp-folder-card"><span>{folder.icon || '📁'}</span><strong>{folder.name}</strong><small>{folderAssetCount(folder, visibleAssets)} ผลงาน</small></button>)}</div> : <div className="csp-empty"><h3>ยังไม่มีโฟลเดอร์</h3></div>}</section>}
       {(['works', 'drafts', 'saved', 'recent', 'trash'] as const).includes(activeTab as 'works' | 'drafts' | 'saved' | 'recent' | 'trash') && isEditing && <section className="csp-portfolio"><div className="csp-section-heading"><div><p className="csp-eyebrow">MANAGE</p><h2>{activeTab === 'works' ? 'ผลงาน' : activeTab === 'drafts' ? 'แบบร่าง' : activeTab === 'saved' ? 'บันทึกไว้' : activeTab === 'recent' ? 'ล่าสุด' : 'ถังขยะ'}</h2><p>{activeTab === 'saved' ? 'ผลงานสาธารณะจาก Creator คนอื่นที่คุณบันทึกไว้' : activeTab === 'recent' ? 'ผลงานที่คุณเปิดล่าสุด' : activeTab === 'trash' ? 'ผลงานที่ลบแล้วของคุณ' : 'จัดการผลงานของคุณ'}</p></div><span>{managementAssets.length} รายการ</span></div>{managementAssets.length ? <div className="csp-asset-grid">{managementAssets.map(asset => <AssetCard key={asset.id} asset={asset} onClick={setSelectedAsset} onEdit={activeTab === 'works' || activeTab === 'drafts' ? onEditAsset : undefined} isOwner={asset.userId === currentUser?.id} />)}</div> : <div className="csp-empty"><h3>ยังไม่มีรายการ</h3><p>{activeTab === 'saved' ? 'ผลงานที่บันทึกไว้จะแสดงที่นี่' : activeTab === 'recent' ? 'ผลงานที่เปิดล่าสุดจะแสดงที่นี่' : 'ไม่มีผลงานในส่วนนี้'}</p></div>}</section>}
      </>}
    </main>
    <AssetViewModal asset={selectedAsset} isOpen={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} onEdit={isEditing ? onEditAsset : undefined} allAssets={visibleAssets} isOwner={isEditing} />
    <ProfileEditModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onSaved={savedUser => { const nextSlug = getCanonicalProfileSlug(savedUser); setActiveSlug(nextSlug); window.history.replaceState({}, '', getCanonicalProfilePath(savedUser)); }} />
  </div>;
};
