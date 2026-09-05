import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Clock3, Cloud, Droplets, ExternalLink, FileText, Flower2, Folder as FolderIcon, FolderOpen, Frame, Globe2, Heart, Image as ImageIcon, Link2, MapPin, MoreHorizontal, Music2, Orbit, Pause, Play, Ribbon, SkipBack, SkipForward, Sparkles, Square, Sun, Target, Umbrella, Volume2, WandSparkles, Wind } from 'lucide-react';
import type { Asset, Folder } from '../../types';
import { isPublicFeedVisibility } from '../../lib/assetVisibility';
import { CREATOR_WIDGET_ICONS, CREATOR_WIDGET_LABELS, type CreatorWidgetType } from './CreatorCustomizePanel';
import { getCalendarPresentation, getClockPresentation, getDecorationPresentation, getFolderPresentation, getGalleryPresentation, getGoalPresentation, getMusicPresentation, getNotePresentation, getPublicFolderPresentation, getTodoPresentation, getWeatherPresentation, getWidgetRenderSize, isSafeGallerySource, isSafeMusicUrl, NOTE_FALLBACK_TITLE, type CalendarEvent, type ClockDialMarker, type CreatorWidgetConfig, type DecorationStickerIcon, type FolderCardPreview, type GalleryItem, type WeatherCondition, type WidgetRenderSize } from './creatorWidgetModel';

export interface CreatorWidgetRendererProps {
  type: CreatorWidgetType;
  config: CreatorWidgetConfig;
  title?: string;
  span: number;
  folders: Folder[];
  assets: Asset[];
  displayName: string;
  isOwner: boolean;
  onToggleTodo?: (index: number) => void;
  onEditTodo?: () => void;
  onEditNote?: () => void;
  onEditGoal?: () => void;
  onEditMusic?: () => void;
  onEditGallery?: () => void;
  onEditDecoration?: () => void;
  onEditClock?: () => void;
  onEditWeather?: () => void;
  onEditCalendar?: () => void;
  onEditFolder?: () => void;
  onOpenFolder?: (folderId: string) => void;
  onOpenAsset?: (asset: Asset, folderId?: string) => void;
}

interface WidgetContentProps extends CreatorWidgetRendererProps {
  size: WidgetRenderSize;
}

function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return <div className="csp-widget-empty">{children}</div>;
}

function NoteWidget({ config, title, displayName, isOwner, onEditNote }: CreatorWidgetRendererProps) {
  const note = getNotePresentation(config, displayName);
  const menu = isOwner && onEditNote
    ? <button type="button" className="csp-note-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditNote(); }} aria-label="แก้ไขโน้ต" title="แก้ไขโน้ต"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-note-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;

  return <section className="csp-note-surface">
    <div className="csp-note-glow" aria-hidden="true" />
    <header className="csp-note-meta"><div className="csp-note-meta-copy"><span className="csp-note-overline">{note.kicker}</span><span className="csp-note-badge">{note.badge}</span></div>{menu}</header>
    <div className="csp-note-main">
      <div className="csp-note-title-row"><span className="csp-note-status-dot" aria-hidden="true" /><span className="csp-note-icon" aria-hidden="true">{note.icon}</span><h3 className="csp-note-title">{title?.trim() || config.title?.trim() || NOTE_FALLBACK_TITLE}</h3></div>
      <p className="csp-note-copy">{note.text}</p>
    </div>
    <footer className="csp-note-footer"><span><Clock3 aria-hidden="true" />{note.footerLeft}</span><strong>{note.footerRight}</strong></footer>
  </section>;
}

function TodoWidget({ config, title, span, isOwner, onEditTodo, onToggleTodo }: CreatorWidgetRendererProps) {
  const todo = getTodoPresentation(config, title);
  const category = (id?: string) => todo.categories.find(item => item.id === id);
  const icon = todo.checkboxStyle === 'heart' ? <Heart /> : todo.checkboxStyle === 'star' ? <Sparkles /> : todo.checkboxStyle === 'tulip' ? <Flower2 /> : todo.checkboxStyle === 'dot' ? <CircleDot /> : <Check />;
  const menu = isOwner && onEditTodo ? <button type="button" className="csp-todo-menu" onClick={onEditTodo} aria-label="แก้ไข To-Do"><MoreHorizontal /></button> : <span className="csp-todo-menu is-readonly"><MoreHorizontal /></span>;
  const list = (tasks: typeof todo.tasks) => <div className="csp-todo-task-list">{tasks.slice(0, span >= 7 ? 7 : 5).map(task => {
    const sourceIndex = todo.tasks.findIndex(source => source.id === task.id);
    const cat = category(task.categoryId);
    return <button key={task.id} type="button" className={`csp-todo-task is-${task.done ? 'done' : 'open'} is-${task.priority || 'medium'}`} onClick={() => onToggleTodo?.(sourceIndex)}>
      <span className="csp-todo-checkbox" aria-hidden="true">{task.done ? icon : null}</span><span className="csp-todo-task-copy"><strong>{task.label}</strong><small>{cat && <i className={`is-${cat.color}`}>{cat.label}</i>}{task.time && <em>{task.time}</em>}</small></span>{todo.showPriority && <b aria-label={`priority ${task.priority || 'medium'}`} />}
    </button>;
  })}{!tasks.length && <p className="csp-todo-empty">ยังไม่มีงานในรายการนี้</p>}</div>;
  const progress = todo.progressMode === 'bar' ? <div className="csp-todo-progress"><span style={{ width: `${todo.percent}%` }} /></div> : <strong className="csp-todo-progress-text">{todo.progressMode === 'number' ? `${todo.completed} / ${todo.total}` : `${todo.percent}%`}</strong>;
  if (span >= 7) return <section className={`csp-todo-surface is-kanban ${todo.transparent ? 'is-transparent' : ''}`}><header><div><span>NOTION WIDGET SUITE • DAILY ROUTINE</span><h3>{todo.listTitle}</h3></div>{menu}</header><div className="csp-todo-kanban">{([['todo', 'To Do'], ['in-progress', 'In Progress'], ['completed', 'Completed']] as const).map(([status, label]) => <section key={status}><strong>{label}</strong>{list(todo.visibleTasks.filter(task => (task.done ? 'completed' : task.status) === status))}</section>)}</div><footer>{progress}<span>{todo.completed}/{todo.total} เสร็จแล้ว</span></footer></section>;
  return <section className={`csp-todo-surface ${todo.transparent ? 'is-transparent' : ''}`}><header><div><span>NOTION WIDGET SUITE • DAILY ROUTINE</span><h3>{todo.listTitle}</h3></div>{menu}</header><div className="csp-todo-summary"><span>ความคืบหน้ารวม</span><b>{todo.percent}%</b></div>{progress}{list(todo.visibleTasks)}<footer><span>{todo.completed}/{todo.total} เสร็จแล้ว</span><small>{todo.resetSchedule === 'manual' ? 'Manual reset' : `${todo.resetSchedule === 'daily' ? 'Daily' : 'Weekly'} routine`}</small></footer></section>;
}

function GoalProgressVisual({ config, title, displayName }: Pick<CreatorWidgetRendererProps, 'config' | 'title' | 'displayName'>) {
  const goal = getGoalPresentation(config, title);
  const formattedCurrent = `${goal.current.toLocaleString()}${goal.unit === '฿' ? ' ฿' : ` ${goal.unit}`}`;
  const fraction = `${goal.current.toLocaleString()} / ${goal.target.toLocaleString()} ${goal.unit}`;
  if (goal.style === 'ring') return <div className="csp-goal-visual is-ring"><div className="csp-goal-ring" style={{ '--goal-progress': `${goal.percent * 3.6}deg` } as React.CSSProperties}><span>{goal.showPercent ? `${goal.percent}%` : formattedCurrent}</span></div><div><strong>{goal.title}</strong><p>{goal.description}</p></div></div>;
  if (goal.style === 'counter') return <div className="csp-goal-visual is-counter"><strong>{goal.current.toLocaleString()} <em>/ {goal.target.toLocaleString()}</em></strong><span>{goal.unit} · {goal.showPercent ? `${goal.percent}% completed` : goal.description}</span></div>;
  if (goal.style === 'cute') return <div className="csp-goal-visual is-cute"><span className="csp-goal-cute-icon" aria-hidden="true">{goal.icon}</span><div><strong>{goal.current.toLocaleString()} / {goal.target.toLocaleString()} ★</strong><p>{goal.description}</p></div><span className="csp-goal-cute-percent">{goal.showPercent ? `${goal.percent}%` : '✦'}</span></div>;
  return <div className="csp-goal-visual is-bar"><div className="csp-goal-bar-head"><span>{goal.showFraction ? fraction : goal.title}</span>{goal.showRemaining && <strong>เหลืออีก {goal.remaining.toLocaleString()} {goal.unit}</strong>}</div><div className="csp-goal-progress-track" aria-label={`ความคืบหน้า ${goal.percent}%`}><span style={{ width: `${goal.percent}%` }} /></div></div>;
}

function GoalWidget({ config, title, displayName, isOwner, onEditGoal }: CreatorWidgetRendererProps) {
  const goal = getGoalPresentation(config, title);
  const menu = isOwner && onEditGoal
    ? <button type="button" className="csp-goal-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditGoal(); }} aria-label="แก้ไข Goal" title="แก้ไข Goal"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-goal-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const deadline = goal.deadline ? `ครบกำหนด: ${goal.deadline}` : '';
  return <section className="csp-goal-surface">
    <div className="csp-goal-glow" aria-hidden="true" />
    <header className="csp-goal-meta"><span>{goal.displayName}</span>{goal.showPercent && <b>{goal.percent}%</b>}{menu}</header>
    <div className="csp-goal-title-row"><span aria-hidden="true">{goal.icon}</span><div><h3>{goal.title}</h3><p>{goal.description}</p></div></div>
    {goal.type === 'checklist' && goal.items.length > 0 && <div className="csp-goal-checklist-mini">{goal.items.slice(0, 3).map((item, index) => <span key={`${item.label}-${index}`} className={item.done ? 'is-done' : ''}><CheckCircle2 aria-hidden="true" />{item.label || `รายการ ${index + 1}`}</span>)}</div>}
    {goal.type === 'checklist' && goal.items.length === 0 && <div className="csp-goal-empty-progress"><Target aria-hidden="true" />เพิ่มรายการเช็กเพื่อเริ่มติดตาม</div>}
    {goal.type !== 'checklist' || goal.items.length > 0 ? <GoalProgressVisual config={config} title={title} displayName={displayName} /> : null}
    <footer className="csp-goal-footer"><span>{deadline ? <><CalendarDays aria-hidden="true" />{deadline}</> : <><Target aria-hidden="true" />{goal.type === 'date' ? 'กำหนดวันเริ่มและ Deadline' : 'Goal in progress'}</>}</span><strong>{displayName}</strong></footer>
  </section>;
}

function MusicCover({ url, className = '' }: { url: string; className?: string }) {
  return <div className={`csp-music-cover ${className}`}>{url && isSafeMusicUrl(url) ? <img src={url} alt="ภาพปกเพลง" /> : <Music2Fallback />}</div>;
}

function Music2Fallback() { return <Volume2 aria-hidden="true" />; }

function MusicWidget({ config, title, displayName, isOwner, onEditMusic }: CreatorWidgetRendererProps) {
  const music = getMusicPresentation(config, title || displayName);
  const [activeIndex, setActiveIndex] = useState(music.activeTrackIndex);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(36);
  const safeActiveIndex = music.tracks.length ? Math.min(activeIndex, music.tracks.length - 1) : 0;
  const activeTrack = music.type === 'playlist' ? music.tracks[safeActiveIndex] : music.activeTrack;
  const openSource = () => { const href = activeTrack?.url || music.url; if (isSafeMusicUrl(href)) window.open(href, '_blank', 'noopener,noreferrer'); };
  const moveTrack = (direction: -1 | 1) => { if (!music.tracks.length) return; setActiveIndex(index => (index + direction + music.tracks.length) % music.tracks.length); setProgress(0); };
  const menu = isOwner && onEditMusic
    ? <button type="button" className="csp-music-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditMusic(); }} aria-label="แก้ไข Playlist / Music" title="แก้ไข Playlist / Music"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-music-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const titleText = music.type === 'playlist' ? music.playlistName : music.title;
  const style = music.style;
  return <section className={`csp-music-surface is-${style} ${music.type === 'playlist' ? 'is-playlist' : 'is-single'}`}>
    <div className="csp-music-glow" aria-hidden="true" />
    <header className="csp-music-meta"><span>弥散渐变 • ROMANTIC VOL.01</span><b>{music.type === 'playlist' ? `${music.tracks.length} เพลง` : 'NOW PLAYING'}</b>{menu}</header>
    {style === 'mini' ? <div className="csp-music-mini-row">{music.showCover && <MusicCover url={music.coverUrl} />}<div className="csp-music-mini-copy">{music.showTitle && <strong>{titleText}</strong>}{music.showArtist && <span>{activeTrack?.artist || music.artist}</span>}</div>{music.showControls && <button type="button" className="csp-music-play is-small" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'หยุดเพลง' : 'เล่นเพลง'}>{playing ? <Pause /> : <Play />}</button>}</div> : <>
      <div className="csp-music-head">{music.showCover && <MusicCover url={music.coverUrl} className={style === 'vinyl' ? 'is-vinyl' : ''} />}<div className="csp-music-copy">{music.showTitle && <h3>{titleText}</h3>}{music.showArtist && <p>{music.type === 'playlist' ? `${activeTrack?.artist || music.artist} · ${music.tracks.length} เพลง` : music.artist}</p>}<span>{music.caption}</span></div><span className="csp-music-source">{music.source === 'spotify' ? 'Spotify' : music.source}</span></div>
      {music.showProgress && <div className="csp-music-progress"><span style={{ width: `${progress}%` }} /></div>}
      <div className="csp-music-controls">{music.showDuration && <small>{playing ? '1:12' : '0:00'}</small>}{music.showControls && <div><button type="button" onClick={() => moveTrack(-1)} aria-label="เพลงก่อนหน้า"><SkipBack /></button><button type="button" className="csp-music-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'หยุดเพลง' : 'เล่นเพลง'}>{playing ? <Pause /> : <Play />}</button><button type="button" onClick={() => moveTrack(1)} aria-label="เพลงถัดไป"><SkipForward /></button></div>}{music.showDuration && <small>{activeTrack?.duration || '—'}</small>}</div>
    </>}
     {style !== 'mini' && music.type === 'playlist' && music.showTrackList && <div className="csp-music-track-list">{music.tracks.slice(0, style === 'compact' ? 2 : 4).map((track, index) => <button type="button" key={track.id || index} className={index === safeActiveIndex ? 'is-active' : ''} onClick={() => { setActiveIndex(index); setPlaying(true); }}><span>{music.showTrackNumbers ? index + 1 : <Volume2 aria-hidden="true" />}</span><em>{track.title}<small>{track.artist || 'Unknown artist'}</small></em>{music.showTrackDuration && <time>{track.duration || '—'}</time>}</button>)}{music.tracks.length === 0 && <div className="csp-music-empty">ยังไม่มีเพลงใน Playlist</div>}</div>}
    <footer className="csp-music-footer"><button type="button" onClick={openSource} disabled={!isSafeMusicUrl(activeTrack?.url || music.url)}><ExternalLink aria-hidden="true" />เปิดใน {music.source === 'spotify' ? 'Spotify' : 'แหล่งเพลง'}</button><strong>{playing ? 'Now Playing' : 'พร้อมเล่น'}</strong></footer>
  </section>;
}

function GalleryImage({ item, className = '', focusPosition, fit, radius }: { item: GalleryItem; className?: string; focusPosition: string; fit: 'cover' | 'contain' | 'natural'; radius: number }) {
  const [failed, setFailed] = useState(false);
  const style = { objectPosition: focusPosition, objectFit: fit === 'natural' ? 'contain' : fit, borderRadius: `${radius}px` } as React.CSSProperties;
  return <div className={`csp-gallery-image ${className}`} style={{ borderRadius: `${radius}px` }}>{isSafeGallerySource(item.src) && !failed ? <img src={item.src} alt={item.alt || item.caption || 'Gallery image'} style={style} onError={() => setFailed(true)} /> : <span>ภาพนี้โหลดไม่ได้</span>}</div>;
}

function GalleryWidget({ assets, config, size, isOwner, onEditGallery, title }: WidgetContentProps) {
  const publicAssets = assets.filter(isPublicFeedVisibility);
  const availableAssets = isOwner ? assets : publicAssets;
  const legacyItems: GalleryItem[] = availableAssets.flatMap(asset => asset.previewImages?.[0] ? [{ id: `asset-${asset.id}`, src: asset.previewImages[0], alt: asset.title, caption: asset.title, source: 'asset' as const, assetId: asset.id }] : []);
  const publicAssetIds = new Set(publicAssets.map(asset => asset.id));
  const presentationConfig = !isOwner && Array.isArray(config.galleryItems)
    ? { ...config, galleryItems: config.galleryItems.filter(item => item.source !== 'asset' || Boolean(item.assetId && publicAssetIds.has(item.assetId))) }
    : config;
  const gallery = getGalleryPresentation(presentationConfig, title, legacyItems);
  const collageCount = gallery.collageLayout === 'two' ? 2 : gallery.collageLayout === 'four' ? 4 : 3;
  const menu = isOwner && onEditGallery
    ? <button type="button" className="csp-gallery-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditGallery(); }} aria-label="แก้ไข Gallery" title="แก้ไข Gallery"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-gallery-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const galleryStyle = { '--gallery-gap': `${gallery.gap}px`, '--gallery-outer-radius': `${gallery.outerRadius}px`, '--gallery-inner-radius': `${gallery.innerRadius}px` } as React.CSSProperties;
  const empty = <div className="csp-gallery-empty"><ImageIcon aria-hidden="true" /><span>ยังไม่มีภาพใน Gallery</span><small>เพิ่มภาพจากผลงานหรือ Gallery editor</small></div>;
  return <section className={`csp-gallery-surface is-${gallery.type} is-template-${gallery.template} is-layout-${gallery.collageLayout} csp-gallery-size-${size.toLowerCase()}`} style={galleryStyle}>
    <div className="csp-gallery-glow" aria-hidden="true" />
    <header className="csp-gallery-meta"><span>弥散渐变 • ROMANTIC MIST</span>{gallery.showCounter && <b>{gallery.allItems.length} ภาพ</b>}{menu}</header>
    <div className="csp-gallery-heading"><div><h3>{gallery.title}</h3>{gallery.showCaption && <p>{gallery.caption}</p>}</div>{gallery.type === 'gif' && <span className="csp-gallery-live-badge">GIF / LOOP</span>}</div>
    {gallery.type === 'single' && (gallery.items[0] ? <div className="csp-gallery-single"><GalleryImage item={gallery.items[0]} focusPosition={gallery.focusPosition} fit={gallery.imageFit} radius={gallery.innerRadius} />{gallery.showCaption && gallery.items[0].caption && <span>{gallery.items[0].caption}</span>}</div> : empty)}
    {gallery.type === 'template' && (gallery.items.length ? <div className="csp-gallery-template">{gallery.items.slice(0, 5).map((item, index) => <GalleryImage key={item.id || index} item={item} className={`is-template-item-${index + 1}`} focusPosition={gallery.focusPosition} fit={gallery.imageFit} radius={gallery.innerRadius} />)}</div> : empty)}
     {gallery.type === 'collage' && <div className="csp-gallery-collage">{Array.from({ length: collageCount }, (_, index) => { const item = gallery.items[index]; return item ? <GalleryImage key={item.id || index} item={item} className={`is-collage-item-${index + 1}`} focusPosition={gallery.focusPosition} fit={gallery.imageFit} radius={gallery.innerRadius} /> : <div key={`empty-${index}`} className={`csp-gallery-slot-empty is-collage-item-${index + 1}`}>เพิ่มภาพ</div>; })}</div>}
    {gallery.type === 'gif' && (gallery.items[0] ? <div className={`csp-gallery-gif ${gallery.pauseOnHover ? 'is-pause-hover' : ''}`}><GalleryImage item={gallery.items[0]} focusPosition={gallery.focusPosition} fit={gallery.imageFit} radius={gallery.innerRadius} /><span>{gallery.autoplay ? 'เล่นอัตโนมัติ' : 'กดเพื่อเล่น'} · {gallery.loop ? 'วนซ้ำ' : 'ครั้งเดียว'}</span></div> : empty)}
    <footer className="csp-gallery-footer"><span>{gallery.showSourceLabel ? 'Romantic Mist Gallery' : `${gallery.allItems.length} ภาพที่เลือกไว้`}</span><strong>{gallery.type === 'gif' ? 'Ambient loop' : gallery.template === 'magazine' ? 'Magazine layout' : 'Notion ready'}</strong></footer>
  </section>;
}

function ClockAnalogFace({ hour, minute, second, marker, showSeconds }: { hour: number; minute: number; second: number; marker: ClockDialMarker; showSeconds: boolean }) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = (minute + second / 60) * 6;
  const secondAngle = second * 6;
  return <div className={`csp-clock-analog-face is-${marker}`} aria-hidden="true">
    <div className="csp-clock-analog-markers">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ transform: `rotate(${index * 30}deg)` }} />)}</div>
    <span className="csp-clock-hand is-hour" style={{ transform: `rotate(${hourAngle}deg)` }} />
    <span className="csp-clock-hand is-minute" style={{ transform: `rotate(${minuteAngle}deg)` }} />
    {showSeconds && <span className="csp-clock-hand is-second" style={{ transform: `rotate(${secondAngle}deg)` }} />}
    <b className="csp-clock-center-dot" />
  </div>;
}

function ClockWidget({ config, title, isOwner, onEditClock }: CreatorWidgetRendererProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const clock = getClockPresentation(config, title, now);
  const menu = isOwner && onEditClock
    ? <button type="button" className="csp-clock-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditClock(); }} aria-label="แก้ไขนาฬิกา" title="แก้ไขนาฬิกา"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-clock-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const mainLabel = clock.main.name || 'Local Clock';
  const isWorldView = clock.mode === 'world' || clock.style === 'world';
  const styleLabel = clock.style === 'digital' ? 'STYLE 01 • DIGITAL' : clock.style === 'analog' ? 'STYLE 02 • ANALOG' : clock.style === 'flip' ? 'STYLE 03 • RETRO FLIP' : clock.style === 'cute' ? 'STYLE 04 • AURA' : 'STYLE 05 • WORLD DUO';
  const content = clock.style === 'analog'
    ? <div className="csp-clock-analog-wrap"><ClockAnalogFace hour={clock.main.hour} minute={clock.main.minute} second={clock.main.second} marker={clock.dialMarker} showSeconds={clock.showSeconds} />{clock.showTime && <strong>{clock.main.time}</strong>}</div>
    : clock.style === 'flip'
      ? clock.showTime ? <div className="csp-clock-flip-time">{clock.main.time.split(':').map((part, index) => <React.Fragment key={`${part}-${index}`}><span>{part}</span>{index < clock.main.time.split(':').length - 1 && <b>:</b>}</React.Fragment>)}</div> : <span className="csp-clock-time-hidden">— —</span>
      : <div className={`csp-clock-digital-time is-${clock.timeSize}`}><strong>{clock.showTime ? clock.main.time : '— —'}</strong>{clock.style === 'cute' && <Sun aria-hidden="true" />}</div>;
  return <section className={`csp-clock-surface is-${clock.style} is-${clock.mode}`}>
    <div className="csp-clock-glow" aria-hidden="true" />
    <header className="csp-clock-meta"><span>{styleLabel}</span><div>{clock.showTimeZone && <small><Globe2 aria-hidden="true" />{clock.timeZone}</small>}{menu}</div></header>
    <div className="csp-clock-heading"><div><h3>{clock.displayName}</h3>{clock.showCity && <p><MapPin aria-hidden="true" />{mainLabel}</p>}</div>{clock.style === 'cute' && <span className="csp-clock-aura-badge">AURA</span>}</div>
    <div className={`csp-clock-face is-${clock.textAlign}`}>{content}</div>
    {clock.showDate && <div className="csp-clock-date"><Clock3 aria-hidden="true" />{clock.main.date}</div>}
    {clock.showGreeting && <div className="csp-clock-greeting"><Sun aria-hidden="true" />{clock.main.greeting}</div>}
    {isWorldView && clock.showCity && <div className="csp-clock-city-list">{clock.cities.slice(0, 4).map(city => <span key={city.id}><b>{city.name}</b><strong>{city.time}</strong></span>)}</div>}
    <footer className="csp-clock-footer"><span><Clock3 aria-hidden="true" />{clock.timeFormat === '24h' ? '24H' : '12H'} · {clock.caption}</span><strong>{clock.timeZoneMode === 'auto' ? 'Auto Device' : 'Custom Zone'}</strong></footer>
  </section>;
}

const weatherSpritePositions: Record<WeatherCondition, string> = { sunny: '0% 0%', rainy: '100% 0%', 'cozy-night': '0% 100%', thunder: '100% 100%' };
const weatherConditionLabels: Record<WeatherCondition, string> = { sunny: 'Mostly Sunny · แดดอ่อน ๆ สบายตา', rainy: 'Light Rain · ฝนปรอย ๆ ชวนพักใจ', 'cozy-night': 'Cozy Night · ค่ำคืนละมุน', thunder: 'Thunder · ฟ้าคะนองเบา ๆ' };

function WeatherPixelIcon({ condition, small = false }: { condition: WeatherCondition; small?: boolean }) {
  return <span className={`csp-weather-pixel-icon ${small ? 'is-small' : ''}`} style={{ backgroundImage: 'url(/weather/retro-pixel-weather-icons.png)', backgroundPosition: weatherSpritePositions[condition] }} aria-label={weatherConditionLabels[condition]} role="img" />;
}

function WeatherWidget({ config, title, span, isOwner, onEditWeather }: CreatorWidgetRendererProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const weather = getWeatherPresentation(config, title, now);
  const menu = isOwner && onEditWeather
    ? <button type="button" className="csp-weather-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditWeather(); }} aria-label="แก้ไขสภาพอากาศ" title="แก้ไขสภาพอากาศ"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-weather-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const showForecast = span >= 6 && weather.showForecast && weather.forecast.length > 0;
  return <section className={`csp-weather-surface is-${weather.condition}`}>
    <div className="csp-weather-glow" aria-hidden="true" />
    <header className="csp-weather-meta"><span>RETRO PIXEL • WEATHER</span><div><small><MapPin aria-hidden="true" />{weather.timeZone}</small>{menu}</div></header>
    <div className="csp-weather-heading"><div><h3>{weather.displayName}</h3><p><MapPin aria-hidden="true" />{weather.location}</p></div><span className="csp-weather-mode">ตั้งค่าเอง</span></div>
    <div className="csp-weather-hero"><div><strong>{weather.current}</strong><span>H: {weather.high} · L: {weather.low}</span>{weather.showCondition && <p>{weatherConditionLabels[weather.condition]}</p>}</div><WeatherPixelIcon condition={weather.condition} /></div>
    {weather.showMessage && <div className="csp-weather-care"><Sun aria-hidden="true" /><span>{weather.message}</span></div>}
    <div className="csp-weather-metrics">
      {weather.showFeelsLike && <span><Cloud aria-hidden="true" /><small>Feels like</small><b>{weather.feelsLike}</b></span>}
      {weather.showHumidity && <span><Droplets aria-hidden="true" /><small>ความชื้น</small><b>{Math.round(weather.humidity)}%</b></span>}
      {weather.showWind && <span><Wind aria-hidden="true" /><small>ลม</small><b>{Math.round(weather.windKph)} km/h</b></span>}
      {weather.showPrecipitation && <span><Umbrella aria-hidden="true" /><small>ฝน</small><b>{Math.round(weather.precipitation)}%</b></span>}
    </div>
    {showForecast && <div className="csp-weather-forecast">{weather.forecast.map(item => <span key={item.id}><b>{item.day}</b><WeatherPixelIcon condition={item.condition} small /><em>{item.highCelsius}° / {item.lowCelsius}°</em></span>)}</div>}
    <footer className="csp-weather-footer"><span><Cloud aria-hidden="true" />ข้อมูลที่ตั้งค่าไว้</span><strong>{weather.dayNightMode === 'auto' ? 'Auto Day/Night' : 'Manual mood'}</strong></footer>
  </section>;
}

function CalendarWidget({ config, title, span, isOwner, onEditCalendar }: CreatorWidgetRendererProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const visibleMonth = useMemo(() => new Date(Date.UTC(now.getFullYear(), now.getMonth() + monthOffset, 1)), [monthOffset, now]);
  const calendar = getCalendarPresentation(config, title, now, visibleMonth);
  const menu = isOwner && onEditCalendar
    ? <button type="button" className="csp-calendar-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditCalendar(); }} aria-label="แก้ไขปฏิทิน" title="แก้ไขปฏิทิน"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-calendar-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const eventsFor = (date: string) => calendar.eventMap[date] || [];
  const renderEvents = (events: CalendarEvent[]) => {
    if (!calendar.showEvents || !events.length) return null;
    if (calendar.eventMode === 'count') return <span className="csp-calendar-event-count">{events.length}</span>;
    if (calendar.eventMode === 'label') return <span className="csp-calendar-event-label">{events[0].title}{events.length > calendar.maxEventsPerDay && <b>+{events.length - calendar.maxEventsPerDay}</b>}</span>;
    return <span className="csp-calendar-event-dots" aria-label={`${events.length} event`} >{events.slice(0, calendar.maxEventsPerDay).map((event, index) => <i className={`is-${event.color || 'pink'}`} key={`${event.id}-${index}`} />)}{events.length > calendar.maxEventsPerDay && <b>+{events.length - calendar.maxEventsPerDay}</b>}</span>;
  };
  const todayIndex = calendar.grid.findIndex(item => item.isToday);
  const weekStartIndex = todayIndex >= 0 ? Math.floor(todayIndex / 7) * 7 : 0;
  const cells = calendar.view === 'week' ? calendar.grid.slice(weekStartIndex, weekStartIndex + 7) : calendar.view === 'mini' ? calendar.grid.slice(0, 35) : calendar.grid;
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const showInlineAgenda = calendar.view !== 'upcoming' && span >= 8 && calendar.showUpcoming;
  const upcoming = calendar.upcoming;
  const renderCalendarDay = (cell: typeof cells[number]) => {
    const dayEvents = eventsFor(cell.date);
    const isWeekend = new Date(`${cell.date}T00:00:00Z`).getUTCDay() % 6 === 0;
    return <div key={cell.date} className={`csp-calendar-day ${cell.inCurrentMonth ? '' : 'is-muted'} ${isWeekend && calendar.showWeekends ? 'is-weekend' : ''} ${cell.isToday && calendar.showToday ? `is-today is-today-${calendar.todayStyle}` : ''}`}>
      <span className="csp-calendar-day-number">{cell.day}</span>
      {renderEvents(dayEvents)}
    </div>;
  };
  const renderAgenda = () => <div className="csp-calendar-agenda"><div className="csp-calendar-agenda-month">{calendar.monthLabel}</div>{upcoming.length ? upcoming.map(event => <div className="csp-calendar-agenda-row" key={event.id}><i className={`is-${event.color || 'pink'}`} /><time>{event.date.slice(5).replace('-', '/')}</time><strong>{event.icon && <span>{event.icon}</span>}{event.title}</strong>{event.time && <small>{event.time}</small>}</div>) : <div className="csp-calendar-empty">ยังไม่มี event ที่กำลังจะมาถึง</div>}</div>;
  return <section className={`csp-calendar-surface is-view-${calendar.view} is-span-${span >= 8 ? 'wide' : span >= 6 ? 'standard' : 'compact'}`}>
    <div className="csp-calendar-glow" aria-hidden="true" />
    <header className="csp-calendar-meta"><span>CUTE &amp; AESTHETIC NOTION CALENDAR</span><div><b>{calendar.source === 'manual' ? 'MANUAL' : calendar.source}</b>{menu}</div></header>
    <div className="csp-calendar-heading"><div><h3>{calendar.displayName}</h3>{calendar.showMonthYear && <p>{calendar.monthLabel}</p>}</div><div className="csp-calendar-nav"><button type="button" onClick={() => setMonthOffset(value => value - 1)} aria-label="เดือนก่อนหน้า"><ChevronLeft /></button><button type="button" onClick={() => setMonthOffset(0)} className="csp-calendar-today-button">Today</button><button type="button" onClick={() => setMonthOffset(value => value + 1)} aria-label="เดือนถัดไป"><ChevronRight /></button></div></div>
    {calendar.view === 'upcoming' ? renderAgenda() : <div className={`csp-calendar-main ${showInlineAgenda ? 'has-agenda' : ''}`}><div className="csp-calendar-grid-wrap"><div className={`csp-calendar-weekdays ${calendar.showWeekNumbers ? 'has-week-numbers' : ''}`}>{calendar.showWeekNumbers && <span>#</span>}{calendar.weekdayLabels.map(day => <span key={day}>{day}</span>)}</div><div className={`csp-calendar-grid ${calendar.showWeekNumbers ? 'has-week-numbers' : ''}`}>{weeks.map((week, weekIndex) => <React.Fragment key={`week-${weekIndex}`}>{calendar.showWeekNumbers && <span className="csp-calendar-week-number">W{week[0]?.weekNumber}</span>}{week.map(renderCalendarDay)}</React.Fragment>)}</div></div>{showInlineAgenda && renderAgenda()}</div>}
    {calendar.showUpcoming && calendar.view !== 'upcoming' && !showInlineAgenda && span < 8 && <div className="csp-calendar-upcoming-strip">{upcoming.length ? <><span>Next:</span><strong>{upcoming[0].icon} {upcoming[0].title}</strong>{upcoming.length > 1 && <small>+{upcoming.length - 1} events</small>}</> : <span>ยังไม่มี event เพิ่มไว้</span>}</div>}
    {calendar.showCaption && <footer className="csp-calendar-footer"><span><CalendarDays aria-hidden="true" />{calendar.validEvents.length} events · {calendar.caption}</span><strong>ตั้งค่าเอง</strong></footer>}
  </section>;
}

const decorationIcons: Record<DecorationStickerIcon, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  sparkles: Sparkles,
  heart: Heart,
  flower: Flower2,
  cloud: Cloud,
  bow: Ribbon,
  frame: Frame,
  orbit: Orbit
};

function DecorationWidget({ config, title, isOwner, onEditDecoration }: CreatorWidgetRendererProps) {
  const decoration = getDecorationPresentation(config, title);
  const menu = isOwner && onEditDecoration
    ? <button type="button" className="csp-decoration-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditDecoration(); }} aria-label="แก้ไข Decoration" title="แก้ไข Decoration"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-decoration-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const StickerIcon = decorationIcons[decoration.stickerIcon];
  const style = {
    '--decoration-opacity': `${decoration.opacity / 100}`,
    '--decoration-size': `${decoration.size}px`,
    '--decoration-rotation': `${decoration.rotation}deg`,
    '--decoration-align': decoration.align,
    '--decoration-scale': `${decoration.scale / 100}`,
    '--decoration-width': `${decoration.dividerWidth}%`,
    '--decoration-pattern-size': `${Math.round(352 * (decoration.scale / 100))}px`
  } as React.CSSProperties;
  const visual = decoration.type === 'sticker'
    ? <div className="csp-decoration-sticker" style={style}>{decoration.stickerUrl ? <img src={decoration.stickerUrl} alt="Sticker ตกแต่ง" /> : <StickerIcon aria-hidden={true} />}</div>
    : decoration.type === 'text'
      ? <blockquote className={`csp-decoration-text is-${decoration.textStyle} is-${decoration.textSize}`} style={style}>{decoration.text}</blockquote>
      : decoration.type === 'pattern'
        ? <div className={`csp-decoration-pattern is-${decoration.pattern} is-${decoration.density}`} style={style} role="img" aria-label={`ลวดลาย ${decoration.pattern}`} />
        : decoration.type === 'divider'
          ? <div className={`csp-decoration-divider is-${decoration.dividerStyle} is-${decoration.dividerThickness}`} style={style}><span>{decoration.dividerText}</span></div>
          : <div className={`csp-decoration-animation is-${decoration.animation} is-${decoration.animationSpeed} ${decoration.loop ? 'is-looping' : 'is-once'} ${decoration.pauseOnHover ? 'is-pause-hover' : ''}`} style={style}><WandSparkles aria-hidden="true" /><Sparkles aria-hidden="true" /><Sparkles aria-hidden="true" /></div>;
  return <section className={`csp-decoration-surface is-${decoration.type}`} style={style}>
    <div className="csp-decoration-meta"><span>深海標本 · BIOLUMINESCENT</span>{menu}</div>
    {visual}
    <span className="csp-decoration-label">{decoration.displayName}</span>
  </section>;
}

const folderIconMap: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  folder: FolderIcon,
  'folder-open': FolderOpen,
  file: FileText,
  link: Link2,
  archive: FolderIcon,
  briefcase: FolderIcon,
  book: FileText,
  notes: FileText,
};

function FolderSymbol({ value, className = '' }: { value?: string; className?: string }) {
  const key = (value || '').trim().toLowerCase();
  const Icon = folderIconMap[key] || FolderIcon;
  return <Icon className={className} aria-hidden={true} />;
}

function FolderCard({ folder, index, presentation, onOpenFolder, onOpenAsset }: { folder: FolderCardPreview; index: number; presentation: ReturnType<typeof getFolderPresentation>; onOpenFolder?: (folderId: string) => void; onOpenAsset?: (asset: Asset, folderId?: string) => void }) {
  const itemLimit = presentation.showPreviewItems ? (presentation.style === 'list' ? 3 : 4) : 0;
  return <article className={`csp-folder-pocket is-${index % 3}`}>
    <header className="csp-folder-pocket-ribbon"><span>FOLDER {String(index + 1).padStart(2, '0')} · {presentation.style.toUpperCase()}</span><b>{folder.count} items</b></header>
    <button type="button" className="csp-folder-pocket-heading" onClick={() => onOpenFolder?.(folder.id)}><span className="csp-folder-pocket-icon"><FolderSymbol value={folder.icon} /></span><span><strong>{folder.name}</strong>{presentation.showDescription && folder.description && <small>{folder.description}</small>}</span><FolderOpen className="csp-folder-pocket-open" aria-hidden="true" /></button>
    {presentation.showItemCount && <div className="csp-folder-pocket-count"><span>ผลงานในโฟลเดอร์</span><strong>{folder.count}</strong></div>}
    {itemLimit > 0 && <div className="csp-folder-item-list">{folder.items.slice(0, itemLimit).map(item => <button type="button" key={item.id} className="csp-folder-item" onClick={() => onOpenAsset?.(item.asset, folder.id)}><span className="csp-folder-item-icon">{presentation.showItemIcons ? <FolderSymbol value={item.icon} /> : <FileText aria-hidden="true" />}</span><span><strong>{item.title}</strong>{item.description && <small>{item.description}</small>}</span><ExternalLink aria-hidden="true" /></button>)}{folder.count > itemLimit && <small className="csp-folder-more">+{folder.count - itemLimit} รายการเพิ่มเติม</small>}</div>}
    {!folder.count && <div className="csp-folder-empty"><FileText aria-hidden="true" />ยังไม่มีผลงานในโฟลเดอร์นี้</div>}
  </article>;
}

function FolderWidget({ config, title, displayName, folders, assets, span, isOwner, onEditFolder, onOpenFolder, onOpenAsset }: CreatorWidgetRendererProps) {
  const presentation = isOwner ? getFolderPresentation(config, folders, assets, displayName) : getPublicFolderPresentation(config, folders, assets, displayName);
  const widgetDisplayName = title?.trim() || presentation.displayName;
  const menu = isOwner && onEditFolder
    ? <button type="button" className="csp-folder-menu" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onEditFolder(); }} aria-label="แก้ไข Folder Widget" title="แก้ไข Folder Widget"><MoreHorizontal aria-hidden="true" /></button>
    : <span className="csp-folder-menu is-readonly" aria-hidden="true"><MoreHorizontal /></span>;
  const maxFolders = span >= 8 ? 3 : span >= 5 ? 2 : 1;
  const visibleFolders = presentation.folders.slice(0, maxFolders);
  return <section className={`csp-folder-surface is-${presentation.style} is-${span >= 8 ? 'wide' : span >= 5 ? 'standard' : 'compact'} ${presentation.isPublic ? 'is-public' : ''}`}>
    <div className="csp-folder-glow" aria-hidden="true" />
    <header className="csp-folder-meta"><span>SUNSET COASTAL • FOLDER <small>{widgetDisplayName}</small></span><div><b>{presentation.isPublic ? 'READ ONLY' : 'OWNER VIEW'}</b>{menu}</div></header>
    <div className="csp-folder-heading"><div><h3>{presentation.title}</h3><p>{presentation.subtitle}</p></div><span className="csp-folder-heading-icon"><FolderSymbol value={presentation.icon} /></span></div>
    {visibleFolders.length ? <div className="csp-folder-pockets">{visibleFolders.map((folder, index) => <FolderCard key={folder.id} folder={folder} index={index} presentation={presentation} onOpenFolder={onOpenFolder} onOpenAsset={onOpenAsset} />)}</div> : <div className="csp-folder-empty-state"><FolderIcon aria-hidden="true" /><strong>{presentation.isPublic ? 'ยังไม่มีโฟลเดอร์ที่เปิดเผย' : 'ยังไม่มีโฟลเดอร์ที่เลือก'}</strong><span>{presentation.isPublic ? 'เจ้าของโปรไฟล์ยังไม่ได้เลือกโฟลเดอร์สำหรับ public view' : 'เพิ่มโฟลเดอร์จาก Folder editor เพื่อเริ่มจัดกลุ่มผลงาน'}</span></div>}
    <footer className="csp-folder-footer"><span><FolderIcon aria-hidden="true" />{visibleFolders.length} โฟลเดอร์ · {presentation.totalItems} ผลงาน</span><strong>{presentation.isPublic ? 'Public preview' : 'Sunset Coastal'}</strong></footer>
  </section>;
}

export const CreatorWidgetRenderer: React.FC<CreatorWidgetRendererProps> = props => {
  const size = getWidgetRenderSize(props.span);
  const content: Record<CreatorWidgetType, React.ReactNode> = {
    folder: <FolderWidget {...props} onEditFolder={props.onEditFolder} onOpenFolder={props.onOpenFolder} onOpenAsset={props.onOpenAsset} />,
    status: <div className="csp-status-widget"><strong>{props.config.status || 'กำลังสร้างสิ่งใหม่'}</strong><span>{props.config.description || 'สถานะของ Creator ในตอนนี้'}</span></div>,
    note: <NoteWidget {...props} />,
    links: <div className="csp-links-widget"><span>{props.config.description || `ช่องทางของ ${props.displayName}`}</span>{props.config.links?.[0]?.url ? <a className="widget-link" href={props.config.links[0].url} target="_blank" rel="noreferrer">{props.config.links[0].label || 'เปิดลิงก์'} →</a> : <small>{props.isOwner ? 'จัดการลิงก์จาก Edit Profile หรือ Widget editor' : 'ลิงก์สาธารณะที่ Creator เลือกแสดง'}</small>}</div>,
    playlist: <MusicWidget {...props} onEditMusic={props.onEditMusic} />,
    todo: <TodoWidget {...props} onEditTodo={props.onEditTodo} />,
    goal: <GoalWidget {...props} />,
    gallery: <GalleryWidget {...props} size={size} onEditGallery={props.onEditGallery} />,
    clock: <ClockWidget {...props} onEditClock={props.onEditClock} />,
    weather: <WeatherWidget {...props} onEditWeather={props.onEditWeather} />,
    calendar: <CalendarWidget {...props} onEditCalendar={props.onEditCalendar} />,
    single_image: props.config.imageUrl ? <img className="csp-single-image" src={props.config.imageUrl} alt={props.title || 'รูปภาพเดี่ยว'} /> : <WidgetEmpty>เพิ่ม URL รูปภาพใน editor</WidgetEmpty>,
    decoration: <DecorationWidget {...props} onEditDecoration={props.onEditDecoration} />
  };

  // Dedicated renderers keep the existing fixed-density contract for Note/Music/Gallery/Decoration/Clock/Weather/Folder.
  // props.type === 'note' || props.type === 'playlist' || props.type === 'gallery' || props.type === 'decoration' || props.type === 'clock' || props.type === 'weather' ? 'fixed' : size
  const contentClass = props.type === 'note' ? 'csp-widget-content-note' : props.type === 'goal' ? 'csp-widget-content-goal' : props.type === 'playlist' ? 'csp-widget-content-music' : props.type === 'todo' ? 'csp-widget-content-todo' : props.type === 'gallery' ? 'csp-widget-content-gallery' : props.type === 'decoration' ? 'csp-widget-content-decoration' : props.type === 'clock' ? 'csp-widget-content-clock' : props.type === 'weather' ? 'csp-widget-content-weather' : props.type === 'calendar' ? 'csp-widget-content-calendar' : props.type === 'folder' ? 'csp-widget-content-folder' : `csp-widget-content-${size.toLowerCase()}`;
  return <div className={`csp-widget-content ${contentClass}`} data-widget-render-size={['note', 'playlist', 'todo', 'gallery', 'decoration', 'clock', 'weather', 'calendar', 'folder'].includes(props.type) ? 'fixed' : size}>{content[props.type] || <WidgetEmpty>{CREATOR_WIDGET_LABELS[props.type]}</WidgetEmpty>}</div>;
};
