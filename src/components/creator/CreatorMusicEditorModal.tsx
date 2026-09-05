import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ExternalLink, ListMusic, Music2, Plus, Trash2, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DEFAULT_MUSIC_ARTIST, DEFAULT_MUSIC_CAPTION, DEFAULT_MUSIC_DISPLAY_NAME, DEFAULT_MUSIC_PLAYLIST_NAME, DEFAULT_MUSIC_TITLE,
  DEFAULT_MUSIC_TRACKS, MUSIC_SOURCES, MUSIC_STYLES, MUSIC_TYPES, getMusicPresentation, validateMusicConfig,
  type CreatorWidgetConfig, type MusicSource, type MusicStyle, type MusicTrack, type MusicType
} from './creatorWidgetModel';

interface CreatorMusicEditorModalProps {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (nextConfig: CreatorWidgetConfig, nextDisplayName: string) => void;
  onCancel: () => void;
}

function createDraft(config: CreatorWidgetConfig, displayName?: string) {
  return {
    displayName: displayName?.trim() || config.title?.trim() || DEFAULT_MUSIC_DISPLAY_NAME,
    config: {
      ...config,
      musicType: MUSIC_TYPES.includes(config.musicType as MusicType) ? config.musicType : 'playlist' as MusicType,
      musicSource: MUSIC_SOURCES.includes(config.musicSource as MusicSource) ? config.musicSource : 'spotify' as MusicSource,
      musicStyle: MUSIC_STYLES.includes(config.musicStyle as MusicStyle) ? config.musicStyle : 'card' as MusicStyle,
      playlistName: config.playlistName?.trim() || DEFAULT_MUSIC_PLAYLIST_NAME,
      musicTitle: config.musicTitle?.trim() || config.title?.trim() || DEFAULT_MUSIC_TITLE,
      musicArtist: config.musicArtist?.trim() || DEFAULT_MUSIC_ARTIST,
      musicCaption: config.musicCaption?.trim() || config.description?.trim() || DEFAULT_MUSIC_CAPTION,
      playlistTracks: Array.isArray(config.playlistTracks) ? config.playlistTracks.map((track, index) => ({ ...track, id: track.id || `track-${index + 1}` })) : DEFAULT_MUSIC_TRACKS.map(track => ({ ...track })),
      musicUrl: config.musicUrl || config.links?.[0]?.url || '',
      showCover: config.showCover !== false,
      showTitle: config.showTitle !== false,
      showArtist: config.showArtist !== false,
      showProgress: config.showProgress !== false,
      showControls: config.showControls !== false,
      showDuration: config.showDuration !== false,
      showTrackList: config.showTrackList !== false,
      showTrackNumbers: config.showTrackNumbers !== false,
      showTrackDuration: config.showTrackDuration !== false,
      autoplay: Boolean(config.autoplay),
      loop: config.loop !== false,
      startMuted: Boolean(config.startMuted)
    } as CreatorWidgetConfig
  };
}

const styleLabel: Record<MusicStyle, string> = { card: 'Card', vinyl: 'Vinyl', compact: 'Compact', mini: 'Mini' };
const sourceLabel: Record<MusicSource, string> = { spotify: 'Spotify', 'apple-music': 'Apple Music', soundcloud: 'SoundCloud', other: 'Other' };

export const CreatorMusicEditorModal: React.FC<CreatorMusicEditorModalProps> = ({ config, displayName, instanceId, previewSpan = 6, previewDisplayName, onSave, onCancel }) => {
  const initial = useRef(createDraft(config, displayName));
  const [draftTitle, setDraftTitle] = useState(initial.current.displayName);
  const [draftConfig, setDraftConfig] = useState<CreatorWidgetConfig>(initial.current.config);
  const [customTrack, setCustomTrack] = useState<MusicTrack>({ id: '', title: '', artist: '', duration: '', url: '' });
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const initialSerialized = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ displayName: draftTitle, config: draftConfig }) !== initialSerialized.current;
  const presentation = useMemo(() => getMusicPresentation(draftConfig, draftTitle), [draftConfig, draftTitle]);
  const errors = useMemo(() => validateMusicConfig({ ...draftConfig, title: draftTitle }), [draftConfig, draftTitle]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const frame = requestAnimationFrame(() => firstInputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (showDiscardPrompt) setShowDiscardPrompt(false); else if (dirty) setShowDiscardPrompt(true); else onCancel(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); release(); opener?.focus(); };
  }, [dirty, onCancel, showDiscardPrompt]);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraftConfig(previous => ({ ...previous, ...patch }));
  const requestCancel = () => dirty ? setShowDiscardPrompt(true) : onCancel();
  const updateTrack = (index: number, patch: Partial<MusicTrack>) => set({ playlistTracks: (draftConfig.playlistTracks || []).map((track, trackIndex) => trackIndex === index ? { ...track, ...patch } : track) });
  const removeTrack = (index: number) => set({ playlistTracks: (draftConfig.playlistTracks || []).filter((_, trackIndex) => trackIndex !== index) });
  const addTrack = () => { const title = customTrack.title.trim(); if (!title) return; set({ playlistTracks: [...(draftConfig.playlistTracks || []), { ...customTrack, id: `track-${Date.now()}`, title }] }); setCustomTrack({ id: '', title: '', artist: '', duration: '', url: '' }); };

  return <div className="csp-music-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-music-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-music-editor-title" aria-describedby="csp-music-editor-description">
      <div className="csp-music-editor-ribbon"><span><i />การตั้งค่านี้อยู่ใน session เท่านั้น · ยังไม่เขียน database</span><small><Music2 aria-hidden="true" /> Romantic Diffused</small></div>
      <header className="csp-music-editor-header"><div className="csp-music-editor-title-mark"><Music2 aria-hidden="true" /></div><div><div className="csp-music-editor-title-line"><h2 id="csp-music-editor-title">แก้ไข Playlist / Music</h2><span>• 夢境のグラデーション</span></div><p id="csp-music-editor-description">ปรับข้อมูลเพลงและตัวเล่น พร้อมดูผลบนการ์ดแบบเรียลไทม์</p></div><button type="button" className="csp-music-editor-close" onClick={requestCancel} aria-label="ปิด Music editor"><X aria-hidden="true" /></button></header>
      <form onSubmit={event => { event.preventDefault(); if (canSave) onSave(draftConfig, draftTitle.trim() || DEFAULT_MUSIC_DISPLAY_NAME); }} className="csp-music-editor-form">
        <div className="csp-music-editor-body">
          <section className="csp-music-editor-column csp-music-editor-core" aria-label="ข้อมูลเพลง">
            <div className="csp-music-section-title"><ListMusic aria-hidden="true" />1. CONTENT <small>SESSION ONLY</small></div>
            <label className="csp-music-field"><span>Display Name <small>ชื่อวิดเจ็ตแสดงผล</small></span><input ref={firstInputRef} maxLength={48} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} /></label>
            <div className="csp-music-field"><span>Music Type <small>ประเภท</small></span><div className="csp-music-segmented">{MUSIC_TYPES.map(type => <button type="button" key={type} className={presentation.type === type ? 'is-selected' : ''} onClick={() => set({ musicType: type })} aria-pressed={presentation.type === type}>{type === 'single' ? '♫ Single Song' : '☷ Playlist'}</button>)}</div></div>
            <div className="csp-music-source-grid"><label className="csp-music-field"><span>แหล่งที่มา</span><select value={presentation.source} onChange={event => set({ musicSource: event.target.value as MusicSource })}>{MUSIC_SOURCES.map(source => <option key={source} value={source}>{sourceLabel[source]}</option>)}</select></label><label className="csp-music-field"><span>Music URL / Track ID</span><input value={draftConfig.musicUrl || ''} onChange={event => set({ musicUrl: event.target.value })} placeholder="https://..." />{errors.musicUrl && <em role="alert">{errors.musicUrl}</em>}</label></div>
            <label className="csp-music-field"><span>Album Cover URL <small>ภาพปก</small></span><input value={draftConfig.musicCoverUrl || ''} onChange={event => set({ musicCoverUrl: event.target.value })} placeholder="https://...jpg" />{errors.musicCoverUrl && <em role="alert">{errors.musicCoverUrl}</em>}</label>
            <div className="csp-music-cover-preview">{presentation.coverUrl ? <img src={presentation.coverUrl} alt="ตัวอย่างภาพปก" /> : <Music2 aria-hidden="true" />}<span>{presentation.coverUrl ? 'แสดงภาพปกจาก URL' : 'ยังไม่ได้เพิ่มภาพปก'}</span></div>
            <div className="csp-music-divider" />
            <div className="csp-music-section-title"><Music2 aria-hidden="true" />2. {presentation.type === 'playlist' ? 'PLAYLIST INFO' : 'SONG INFO'} <small>{presentation.type.toUpperCase()}</small></div>
            {presentation.type === 'playlist' ? <><label className="csp-music-field"><span>Playlist Name</span><input maxLength={80} value={draftConfig.playlistName || ''} onChange={event => set({ playlistName: event.target.value })} /></label><div className="csp-music-track-editor"><div className="csp-music-track-heading"><strong>Track list</strong><small>{presentation.tracks.length} เพลง</small></div>{(draftConfig.playlistTracks || []).map((track, index) => <div className={`csp-music-track-row ${presentation.activeTrackIndex === index ? 'is-active' : ''}`} key={track.id || index}><button type="button" className="csp-music-track-select" onClick={() => set({ activeTrackIndex: index })} aria-label={`เลือกเพลงที่ ${index + 1}`}><span>{index + 1}</span></button><input value={track.title} onChange={event => updateTrack(index, { title: event.target.value })} placeholder="ชื่อเพลง" /><input value={track.artist || ''} onChange={event => updateTrack(index, { artist: event.target.value })} placeholder="ศิลปิน" /><input value={track.duration || ''} onChange={event => updateTrack(index, { duration: event.target.value })} placeholder="3:24" /><button type="button" onClick={() => removeTrack(index)} aria-label={`ลบเพลงที่ ${index + 1}`}><Trash2 aria-hidden="true" /></button></div>)}{presentation.tracks.length === 0 && <p className="csp-music-empty">ยังไม่มีเพลงใน Playlist เพิ่มเพลงแรกด้านล่าง</p>}<div className="csp-music-add-track"><input value={customTrack.title} onChange={event => setCustomTrack(previous => ({ ...previous, title: event.target.value }))} placeholder="ชื่อเพลงใหม่" /><input value={customTrack.artist || ''} onChange={event => setCustomTrack(previous => ({ ...previous, artist: event.target.value }))} placeholder="ศิลปิน" /><input value={customTrack.duration || ''} onChange={event => setCustomTrack(previous => ({ ...previous, duration: event.target.value }))} placeholder="3:24" /><button type="button" onClick={addTrack}><Plus aria-hidden="true" />เพิ่ม</button></div></div></> : <><label className="csp-music-field"><span>Song Title</span><input maxLength={80} value={draftConfig.musicTitle || ''} onChange={event => set({ musicTitle: event.target.value })} />{errors.musicTitle && <em role="alert">{errors.musicTitle}</em>}</label><label className="csp-music-field"><span>Artist</span><input maxLength={64} value={draftConfig.musicArtist || ''} onChange={event => set({ musicArtist: event.target.value })} /></label></>}
            <label className="csp-music-field"><span>Caption / Subtitle</span><input maxLength={120} value={draftConfig.musicCaption || ''} onChange={event => set({ musicCaption: event.target.value })} /></label>
          </section>
          <section className="csp-music-editor-column csp-music-editor-options" aria-label="รูปแบบตัวเล่น">
            <div className="csp-music-section-title"><Music2 aria-hidden="true" />3. APPEARANCE <small>ROMANTIC DIFFUSED</small></div>
            <div className="csp-music-locked-theme"><span />ธีมที่ใช้งาน: <strong>夢境 (Pastel Dream)</strong><small>FIXED</small></div>
            <div className="csp-music-field"><span>Player Style <small>4 แบบหลัก</small></span><div className="csp-music-style-grid">{MUSIC_STYLES.map(style => <button type="button" key={style} className={presentation.style === style ? 'is-selected' : ''} onClick={() => set({ musicStyle: style })} aria-pressed={presentation.style === style}><span className={`csp-music-style-sample is-${style}`}>{style === 'vinyl' ? '◉' : style === 'mini' ? '—' : style === 'compact' ? '▤' : '▣'}</span><strong>{styleLabel[style]}</strong></button>)}</div></div>
            <fieldset className="csp-music-options"><legend>องค์ประกอบที่ต้องการแสดงผล</legend>{[['showCover','Album cover'],['showTitle','Song title'],['showArtist','Artist'],['showProgress','Progress bar'],['showControls','Player controls'],['showDuration','Duration']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draftConfig[key as keyof CreatorWidgetConfig] ?? true)} onChange={event => set({ [key]: event.target.checked })} />{label}</label>)}</fieldset>
            {presentation.type === 'playlist' && <fieldset className="csp-music-options"><legend>Playlist display</legend>{[['showTrackList','Show track list'],['showTrackNumbers','Track numbers'],['showTrackDuration','Duration in list']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draftConfig[key as keyof CreatorWidgetConfig] ?? true)} onChange={event => set({ [key]: event.target.checked })} />{label}</label>)}</fieldset>}
            <fieldset className="csp-music-options csp-music-playback"><legend>Playback options</legend><label><input type="checkbox" checked={Boolean(draftConfig.autoplay)} onChange={event => set({ autoplay: event.target.checked })} />Autoplay</label><label><input type="checkbox" checked={draftConfig.loop !== false} onChange={event => set({ loop: event.target.checked })} />Loop</label><label><input type="checkbox" checked={Boolean(draftConfig.startMuted)} onChange={event => set({ startMuted: event.target.checked })} />Start muted</label></fieldset>
            <div className="csp-music-option-note"><ExternalLink aria-hidden="true" /><span>ปุ่มเล่นเป็น preview state ในเว็บ และเปิดเพลงจริงผ่านลิงก์แหล่งภายนอก</span></div>
          </section>
          <aside className="csp-music-editor-column csp-music-editor-preview" aria-label="Live Music Widget Preview"><div className="csp-music-preview-heading"><span><i />Live Notion Simulation</span><small>{previewSpan} / 12 Col</small></div><div className="csp-music-preview-frame"><div className="csp-music-preview-topbar"><span>●</span><span>notion.so/workspace/music</span><b>Live Sync</b></div><div className="csp-music-preview-page"><span>🎧</span><strong>Daily Focus &amp; Ambient Dashboard</strong><small>Updated just now · {presentation.playlistName}</small><div className="csp-music-preview-widget"><CreatorWidgetRenderer type="playlist" config={draftConfig} title={draftTitle} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div></div></div><div className="csp-music-preview-tip"><strong>Live preview</strong><p>เปลี่ยนชื่อเพลง ภาพปก style และ track list แล้วดูผลบนการ์ดได้ทันที</p></div></aside>
        </div>
        <footer className="csp-music-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestCancel}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check aria-hidden="true" />เสร็จสิ้น (บันทึกการแก้ไข)</button></div></footer>
      </form>
      {showDiscardPrompt && <div className="csp-music-discard-dialog" role="alertdialog" aria-modal="true" aria-label="ยืนยันการทิ้งการเปลี่ยนแปลง"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>การแก้ไข Playlist / Music ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setShowDiscardPrompt(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
