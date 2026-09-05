import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTE_BADGE,
  DEFAULT_NOTE_FOOTER_LEFT,
  DEFAULT_NOTE_ICON,
  DEFAULT_NOTE_KICKER,
  NOTE_FALLBACK_TEXT,
  NOTE_ICON_PRESETS,
  getGoalPresentation,
  getMusicPresentation,
  isSafeMusicUrl,
  validateMusicConfig,
  getGalleryPresentation,
  isSafeGallerySource,
  validateGalleryConfig,
  GALLERY_TYPES,
  GALLERY_TEMPLATES,
  GALLERY_COLLAGE_LAYOUTS,
  DECORATION_TYPES,
  DECORATION_PATTERNS,
  DECORATION_ANIMATIONS,
  getDecorationPresentation,
  isSafeDecorationImage,
  validateDecorationConfig,
  CLOCK_STYLES,
  CLOCK_MODES,
  getClockPresentation,
  isValidClockTimeZone,
  validateClockConfig,
  WEATHER_CONDITIONS,
  formatWeatherTemperature,
  getWeatherPresentation,
  isValidWeatherTimeZone,
  validateWeatherConfig,
  CALENDAR_VIEWS,
  CALENDAR_TODAY_STYLES,
  getCalendarPresentation,
  getCalendarMonthGrid,
  normalizeCalendarConfig,
  parseCalendarDate,
  validateCalendarConfig,
  DEFAULT_FOLDER_DISPLAY_NAME,
  DEFAULT_FOLDER_STYLE,
  DEFAULT_FOLDER_SUBTITLE,
  DEFAULT_FOLDER_TITLE,
  FOLDER_STYLES,
  getFolderPresentation,
  getPublicFolderPresentation,
  normalizeFolderConfig,
  validateFolderConfig,
  TODO_CHECKBOX_STYLES,
  TODO_LIST_STYLES,
  getTodoPresentation,
  validateTodoConfig,
  getNotePresentation,
  getWidgetRenderSize,
  type CreatorWidgetConfig
} from './creatorWidgetModel';

const folderFixtures = [
  { id: 'folder-a', userId: 'owner', name: 'University', icon: 'folder', createdAt: '', updatedAt: '' },
  { id: 'folder-b', userId: 'owner', name: 'Personal Nook', icon: 'folder-open', createdAt: '', updatedAt: '' }
];
const assetFixtures = [
  { id: 'asset-public', userId: 'owner', authorName: 'Owner', title: 'Lecture Notes', shortDescription: 'Notion Page', folderId: 'folder-a', icon: { type: 'emoji', value: 'file' }, isPublic: true, visibility: 'public', status: 'published', category: 'lore', content: '', createdAt: '', updatedAt: '' },
  { id: 'asset-private', userId: 'owner', authorName: 'Owner', title: 'Private Draft', folderId: 'folder-a', icon: { type: 'emoji', value: 'file' }, isPublic: false, visibility: 'private', status: 'draft', category: 'lore', content: '', createdAt: '', updatedAt: '' },
  { id: 'asset-public-2', userId: 'owner', authorName: 'Owner', title: 'Daily Journal', folderId: 'folder-b', icon: { type: 'emoji', value: 'file' }, isPublic: true, visibility: 'public', status: 'published', category: 'lore', content: '', createdAt: '', updatedAt: '' }
] as any;

describe('Baby’s Breath To-Do presentation model', () => {
  it('maps legacy items without mutating stored config', () => {
    const legacy: CreatorWidgetConfig = { title: 'Legacy list', items: [{ label: 'งานเก่า', done: true }] };
    const snapshot = structuredClone(legacy);
    expect(getTodoPresentation(legacy)).toMatchObject({ displayName: 'Legacy list', listTitle: 'Morning & Daily Focus', completed: 1, total: 1, percent: 100 });
    expect(legacy).toEqual(snapshot);
  });
  it('supports all list and checkbox styles plus completion behaviors', () => {
    expect(TODO_LIST_STYLES).toEqual(['simple', 'today-time', 'categorized', 'cute']);
    expect(TODO_CHECKBOX_STYLES).toEqual(['classic', 'dot', 'heart', 'star', 'tulip']);
    expect(getTodoPresentation({ todoCompletedBehavior: 'hide', todoTasks: [{ id: 'a', label: 'done', done: true }, { id: 'b', label: 'open', done: false }] }).visibleTasks).toHaveLength(1);
    expect(getTodoPresentation({ todoCompletedBehavior: 'move-bottom', todoTasks: [{ id: 'a', label: 'done', done: true }, { id: 'b', label: 'open', done: false }] }).visibleTasks[0].id).toBe('b');
  });
  it('derives daily reset only after a new period and validates empty task labels', () => {
    const before = getTodoPresentation({ todoResetSchedule: 'daily', todoLastResetAt: '2026-09-05T10:00:00.000Z', todoTasks: [{ id: 'a', label: 'x', done: true }] }, undefined, new Date('2026-09-05T15:00:00.000Z'));
    const next = getTodoPresentation({ todoResetSchedule: 'daily', todoLastResetAt: '2026-09-05T10:00:00.000Z', todoTasks: [{ id: 'a', label: 'x', done: true }] }, undefined, new Date('2026-09-06T01:00:00.000Z'));
    expect(before.completed).toBe(1); expect(next.completed).toBe(0); expect(next.needsReset).toBe(true);
    expect(validateTodoConfig({ todoTasks: [{ id: 'a', label: '', done: false }] }, 'Name')).toHaveProperty('todo-task-0');
  });
});

describe('Sunset Coastal Folder presentation model', () => {
  it('normalizes folder defaults and preserves legacy fields', () => {
    const legacy: CreatorWidgetConfig = { title: 'Legacy folders', description: 'Keep it tidy', icon: 'folder-open', showCount: false };
    const snapshot = structuredClone(legacy);
    expect(normalizeFolderConfig(legacy)).toMatchObject({ folderTitle: 'Legacy folders', folderSubtitle: 'Keep it tidy', folderIcon: 'folder-open', folderShowItemCount: false, folderStyle: DEFAULT_FOLDER_STYLE });
    expect(legacy).toEqual(snapshot);
    expect(normalizeFolderConfig({})).toMatchObject({ folderTitle: DEFAULT_FOLDER_TITLE, folderSubtitle: DEFAULT_FOLDER_SUBTITLE, folderStyle: DEFAULT_FOLDER_STYLE });
    expect(DEFAULT_FOLDER_DISPLAY_NAME).toBe('โฟลเดอร์ของฉัน');
  });

  it('derives selected order, item previews and public-only folders without duplicating assets', () => {
    const config: CreatorWidgetConfig = { folderOrder: ['folder-b', 'folder-a', 'folder-a'], folderPublicIds: ['folder-a'], folderStyle: 'open' };
    const owner = getFolderPresentation(config, folderFixtures, assetFixtures, 'Folders');
    expect(owner.selectedFolderIds).toEqual(['folder-b', 'folder-a']);
    expect(owner.folders.map(folder => folder.id)).toEqual(['folder-b', 'folder-a']);
    expect(owner.folders.find(folder => folder.id === 'folder-a')?.count).toBe(2);
    expect(owner.folders.find(folder => folder.id === 'folder-a')?.items).toHaveLength(2);
    const publicView = getPublicFolderPresentation(config, folderFixtures, assetFixtures, 'Folders');
    expect(publicView.folders.map(folder => folder.id)).toEqual(['folder-a']);
    expect(publicView.folders[0].count).toBe(1);
  });

  it('supports all four locked styles and validates unknown folder ids/public subset', () => {
    expect(FOLDER_STYLES).toEqual(['card', 'open', 'list', 'cute']);
    for (const style of FOLDER_STYLES) expect(getFolderPresentation({ folderStyle: style }, folderFixtures, assetFixtures).style).toBe(style);
    expect(validateFolderConfig({ folderOrder: ['missing'], folderPublicIds: ['missing'] }, 'Name', ['folder-a'])).toHaveProperty('folderOrder');
    expect(validateFolderConfig({ folderOrder: ['folder-a'], folderPublicIds: ['folder-b'] }, 'Name', ['folder-a'])).toHaveProperty('folderPublicIds');
  });
});

describe('single-theme Note presentation model', () => {
  it('keeps S/M/L density only for non-Note widgets', () => {
    expect(getWidgetRenderSize(2)).toBe('S');
    expect(getWidgetRenderSize(4)).toBe('M');
    expect(getWidgetRenderSize(12)).toBe('L');
  });

  it('supplies the confirmed Note fallbacks without mutating stored data', () => {
    const stored: CreatorWidgetConfig = { title: 'ชื่อเดิม', text: 'ข้อความเดิม' };
    const snapshot = structuredClone(stored);
    expect(getNotePresentation(stored, 'Ari Studio')).toEqual({
      icon: DEFAULT_NOTE_ICON,
      kicker: DEFAULT_NOTE_KICKER,
      badge: DEFAULT_NOTE_BADGE,
      footerLeft: DEFAULT_NOTE_FOOTER_LEFT,
      footerRight: 'Ari Studio',
      text: 'ข้อความเดิม'
    });
    expect(stored).toEqual(snapshot);
  });

  it('uses safe text and creator fallbacks only when fields are empty', () => {
    expect(getNotePresentation({ text: '   ', noteFooterRight: '   ' }, '  ')).toMatchObject({
      text: NOTE_FALLBACK_TEXT,
      footerRight: 'Creator'
    });
  });

  it('keeps exactly the seven editable Note values in the active config contract', () => {
    const config: CreatorWidgetConfig = {
      title: 'Deep Creative Flow',
      text: 'กำลังร่าง Wireframe แอปใหม่',
      icon: '🔮',
      noteKicker: 'STATUS // CURRENT',
      noteBadge: 'FLOW',
      noteFooterLeft: 'Updated 10m ago',
      noteFooterRight: 'Ari Studio'
    };
    expect(Object.keys(config)).toHaveLength(7);
    expect(NOTE_ICON_PRESETS).toContain(config.icon as (typeof NOTE_ICON_PRESETS)[number]);
  });

  it('ignores legacy theme data passed through persisted records', () => {
    const legacy = { text: 'ยังอยู่', theme: 'paper-memo', align: 'right', tags: ['เก่า'] } as unknown as CreatorWidgetConfig;
    expect(getNotePresentation(legacy, 'Ari').text).toBe('ยังอยู่');
    expect(getNotePresentation(legacy, 'Ari')).not.toHaveProperty('theme');
  });
});

describe('Goal Studio presentation model', () => {
  it('calculates Number and Money progress from current and target values', () => {
    expect(getGoalPresentation({ goalType: 'number', goalCurrent: 8, goalTarget: 12, goalUnit: 'books' }).percent).toBe(67);
    expect(getGoalPresentation({ goalType: 'money', goalCurrent: 1400, goalTarget: 1000, goalUnit: '฿' })).toMatchObject({ percent: 100, remaining: 0, unit: '฿' });
  });

  it('derives Checklist progress from completed items instead of stale numeric inputs', () => {
    const result = getGoalPresentation({ goalType: 'checklist', goalCurrent: 99, goalTarget: 99, goalItems: [{ label: 'เริ่ม', done: true }, { label: 'จบ', done: false }] });
    expect(result).toMatchObject({ current: 1, target: 2, percent: 50, remaining: 1 });
  });

  it('derives Date progress before start, in range, and after deadline', () => {
    const config: CreatorWidgetConfig = { goalType: 'date', goalStartDate: '2026-09-01', goalDeadline: '2026-09-11' };
    expect(getGoalPresentation(config, undefined, new Date('2026-08-31T12:00:00Z')).percent).toBe(0);
    expect(getGoalPresentation(config, undefined, new Date('2026-09-06T12:00:00Z')).percent).toBe(50);
    expect(getGoalPresentation(config, undefined, new Date('2026-09-14T12:00:00Z')).percent).toBe(100);
  });

  it('flags an invalid Date range without dividing by zero', () => {
    const result = getGoalPresentation({ goalType: 'date', goalStartDate: '2026-09-12', goalDeadline: '2026-09-11' }, undefined, new Date('2026-09-10T12:00:00Z'));
    expect(result).toMatchObject({ validDateRange: false, percent: 0, current: 0, target: 1 });
  });

  it('keeps legacy percentage-only Goal configurations visible', () => {
    expect(getGoalPresentation({ goal: 35 })).toMatchObject({ type: 'number', current: 35, target: 100, unit: '%', percent: 35 });
  });
});

describe('Romantic Diffused Music presentation model', () => {
  it('normalizes Playlist defaults and keeps legacy URL compatibility', () => {
    const result = getMusicPresentation({ title: 'เพลงเก่า', description: 'คำโปรยเก่า', links: [{ label: 'เปิด', url: 'https://open.spotify.com/playlist/demo' }] });
    expect(result).toMatchObject({ type: 'playlist', displayName: 'เพลงเก่า', playlistName: 'เพลงเก่า', caption: 'คำโปรยเก่า', url: 'https://open.spotify.com/playlist/demo', tracks: [] });
  });

  it('clamps active track and exposes all four styles without changing the shell data', () => {
    const result = getMusicPresentation({ musicType: 'playlist', musicStyle: 'vinyl', playlistTracks: [{ id: 'a', title: 'A' }], activeTrackIndex: 99 });
    expect(result).toMatchObject({ type: 'playlist', style: 'vinyl', activeTrackIndex: 0, activeTrack: { title: 'A' } });
    expect(getMusicPresentation({ musicType: 'single', musicStyle: 'mini' }).style).toBe('mini');
  });

  it('maps Single Song fields and rejects unsafe URLs', () => {
    const result = getMusicPresentation({ musicType: 'single', musicTitle: 'Blue', musicArtist: 'yung kai', musicUrl: 'https://open.spotify.com/track/demo' });
    expect(result).toMatchObject({ type: 'single', title: 'Blue', artist: 'yung kai' });
    expect(isSafeMusicUrl('https://example.com/cover.jpg')).toBe(true);
    expect(isSafeMusicUrl('javascript:alert(1)')).toBe(false);
    expect(validateMusicConfig({ musicType: 'single', musicTitle: 'Blue', musicUrl: 'javascript:bad' })).toHaveProperty('musicUrl');
  });

  it('reports missing Playlist track titles while allowing an empty-list empty state', () => {
    expect(validateMusicConfig({ musicType: 'playlist', playlistTracks: [{ id: '1', title: '' }] })).toHaveProperty('track-0');
    expect(validateMusicConfig({ musicType: 'playlist', playlistTracks: [] })).toEqual({});
  });
});

describe('Romantic Mist Gallery presentation model', () => {
  const items = [
    { id: 'one', src: 'https://images.example/one.webp', source: 'url' as const },
    { id: 'two', src: 'https://images.example/two.webp', source: 'url' as const },
    { id: 'three', src: 'https://images.example/three.webp', source: 'url' as const },
    { id: 'four', src: 'https://images.example/four.webp', source: 'url' as const }
  ];

  it('normalizes the four gallery modes and five template presets', () => {
    expect(GALLERY_TYPES).toEqual(['single', 'template', 'collage', 'gif']);
    expect(GALLERY_TEMPLATES).toHaveLength(5);
    expect(getGalleryPresentation({ galleryType: 'template', galleryTemplate: 'polaroid', galleryItems: items }, 'summer memories')).toMatchObject({ type: 'template', template: 'polaroid', title: 'summer memories' });
  });

  it('maps legacy imageUrl/description without mutating the old config', () => {
    const legacy: CreatorWidgetConfig = { title: 'Old gallery', description: 'Old caption', imageUrl: 'https://images.example/old.jpg', goal: 1 };
    const snapshot = structuredClone(legacy);
    expect(getGalleryPresentation(legacy)).toMatchObject({ title: 'Old gallery', caption: 'Old caption', allItems: [{ src: 'https://images.example/old.jpg' }] });
    expect(legacy).toEqual(snapshot);
  });

  it('uses a legacy goal count as a temporary image limit until Gallery config is saved', () => {
    const legacyItems = items.map(item => ({ ...item }));
    expect(getGalleryPresentation({ goal: 2 }, undefined, legacyItems).allItems).toHaveLength(2);
  });

  it('preserves an explicitly saved empty list instead of repopulating legacy assets', () => {
    expect(getGalleryPresentation({ galleryType: 'single', galleryItems: [] }, undefined, items).allItems).toHaveLength(0);
  });

  it('supports collage two/three/four layouts and validates the required image count', () => {
    expect(GALLERY_COLLAGE_LAYOUTS).toEqual(['two', 'three', 'four']);
    expect(getGalleryPresentation({ galleryType: 'collage', galleryCollageLayout: 'two', galleryItems: items }).items).toHaveLength(2);
    expect(getGalleryPresentation({ galleryType: 'collage', galleryCollageLayout: 'four', galleryItems: items }).items).toHaveLength(4);
    expect(validateGalleryConfig({ galleryType: 'collage', galleryCollageLayout: 'three', galleryItems: items.slice(0, 2) })).toHaveProperty('galleryLayout');
    expect(validateGalleryConfig({ galleryType: 'collage', galleryCollageLayout: 'two', galleryItems: items.slice(0, 2) })).not.toHaveProperty('galleryLayout');
  });

  it('keeps safe HTTPS/data image sources and rejects unsafe or missing sources', () => {
    expect(isSafeGallerySource('https://images.example/art.webp')).toBe(true);
    expect(isSafeGallerySource('data:image/png;base64,AAAA')).toBe(true);
    expect(isSafeGallerySource('http://images.example/art.webp')).toBe(false);
    expect(isSafeGallerySource('javascript:alert(1)')).toBe(false);
    expect(validateGalleryConfig({ galleryType: 'single', galleryItems: [{ id: 'bad', src: 'javascript:bad', source: 'url' }] })).toHaveProperty('gallery-item-0');
  });

  it('uses GIF source fallback and reports an empty GIF clearly', () => {
    expect(getGalleryPresentation({ galleryType: 'gif', galleryGifUrl: 'https://cdn.example/loop.gif' }).items[0]).toMatchObject({ src: 'https://cdn.example/loop.gif', mimeType: 'image/gif' });
    expect(validateGalleryConfig({ galleryType: 'gif' })).toHaveProperty('galleryGifUrl');
    expect(validateGalleryConfig({ galleryType: 'gif', galleryGifUrl: 'https://cdn.example/not-an-animation.jpg' })).toHaveProperty('galleryGifUrl');
  });
});

describe('Bioluminescent Decoration presentation model', () => {
  it('normalizes all five decoration roles into one transparent accent system', () => {
    expect(DECORATION_TYPES).toEqual(['sticker', 'text', 'pattern', 'divider', 'animated']);
    expect(DECORATION_PATTERNS).toEqual(['stars', 'dots', 'grid', 'fluid']);
    expect(DECORATION_ANIMATIONS).toEqual(['drift', 'pulse', 'sparkle', 'falling-stars']);
    expect(getDecorationPresentation({ decorationType: 'sticker', decorationStickerIcon: 'flower', decorationSize: 999, decorationRotation: -99, decorationOpacity: 2 })).toMatchObject({ type: 'sticker', stickerIcon: 'flower', size: 120, rotation: -30, opacity: 20 });
  });

  it('keeps legacy text visible as Text without mutating stored config', () => {
    const legacy: CreatorWidgetConfig = { text: '静かな波の底に漂う時間' };
    const snapshot = structuredClone(legacy);
    expect(getDecorationPresentation(legacy)).toMatchObject({ type: 'text', text: legacy.text, isLegacyText: true });
    expect(legacy).toEqual(snapshot);
  });

  it('accepts only safe uploaded raster images and validates required text', () => {
    expect(isSafeDecorationImage('data:image/png;base64,AAAA')).toBe(true);
    expect(isSafeDecorationImage('https://example.com/sticker.png')).toBe(false);
    expect(isSafeDecorationImage('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(validateDecorationConfig({ decorationType: 'text', decorationText: '  ' })).toHaveProperty('decorationText');
    expect(validateDecorationConfig({ decorationType: 'sticker', decorationStickerUrl: 'javascript:alert(1)' })).toHaveProperty('decorationStickerUrl');
  });
});

describe('Dreamy Pastel Clock presentation model', () => {
  it('provides the confirmed defaults without mutating legacy config', () => {
    const legacy: CreatorWidgetConfig = { title: 'Desk clock', description: 'เวลาทำงานของฉัน' };
    const snapshot = structuredClone(legacy);
    const result = getClockPresentation(legacy);
    expect(result).toMatchObject({ mode: 'local', style: 'digital', timeZone: expect.any(String), timeFormat: '24h', dateFormat: 'weekday-date', caption: 'เวลาทำงานของฉัน' });
    expect(legacy).toEqual(snapshot);
  });

  it('supports Local/World modes and all five styles', () => {
    expect(CLOCK_MODES).toEqual(['local', 'world']);
    expect(CLOCK_STYLES).toEqual(['digital', 'analog', 'flip', 'cute', 'world']);
    expect(getClockPresentation({ clockMode: 'world', clockStyle: 'world', clockCities: [{ id: 'bkk', name: 'Bangkok', timeZone: 'Asia/Bangkok' }, { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo' }] }).cities).toHaveLength(2);
  });

  it('formats 12h/24h time and derives a time-of-day greeting', () => {
    const morning = new Date('2026-09-05T02:08:51.000Z');
    expect(getClockPresentation({ clockTimeZoneMode: 'custom', clockTimeZone: 'Asia/Bangkok', clockTimeFormat: '24h' }, undefined, morning).main.time).toContain('09:08');
    expect(getClockPresentation({ clockTimeZoneMode: 'custom', clockTimeZone: 'America/New_York' }, undefined, morning).main.name).toBe('New York');
    expect(getClockPresentation({ clockTimeZoneMode: 'custom', clockTimeZone: 'Asia/Bangkok', clockTimeFormat: '12h', clockShowSeconds: false }, undefined, morning).main.time).toMatch(/09:08/);
    expect(getClockPresentation({ clockTimeZoneMode: 'custom', clockTimeZone: 'Asia/Bangkok', clockGreetings: { morning: 'Good morning' } }, undefined, morning).main.greeting).toBe('Good morning');
  });

  it('falls back invalid custom timezone and validates the original input', () => {
    expect(isValidClockTimeZone('Asia/Bangkok')).toBe(true);
    expect(isValidClockTimeZone('Not/AZone')).toBe(false);
    expect(getClockPresentation({ clockTimeZoneMode: 'custom', clockTimeZone: 'Not/AZone' }).timeZone).toBe('Asia/Bangkok');
    expect(validateClockConfig({ clockTimeZoneMode: 'custom', clockTimeZone: 'Not/AZone' })).toHaveProperty('clockTimeZone');
    expect(validateClockConfig({ clockTimeZoneMode: 'custom', clockTimeZone: '' })).toHaveProperty('clockTimeZone');
    expect(getClockPresentation({ clockTimeZoneMode: 'auto', clockTimeZone: 'Not/AZone' }).timeZoneValid).toBe(true);
  });

  it('normalizes and validates world cities without allowing malformed timezones', () => {
    const result = getClockPresentation({ clockMode: 'world', clockCities: Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: `City ${index}`, timeZone: index === 1 ? 'Not/AZone' : 'Asia/Bangkok' })) });
    expect(result.cities).toHaveLength(4);
    expect(validateClockConfig({ clockCities: [{ id: 'bad', name: 'Bad', timeZone: 'Not/AZone' }] })).toHaveProperty('clock-city-0');
  });

  it('honors display toggles in the shared renderer presentation model', () => {
    const result = getClockPresentation({ clockShowTime: false, clockShowSeconds: false, clockShowDate: false, clockShowCity: false, clockShowTimeZone: false, clockShowGreeting: false, clockDateFormat: 'hidden' });
    expect(result).toMatchObject({ showTime: false, showSeconds: false, showDate: false, showCity: false, showTimeZone: false, showGreeting: false });
  });
});

describe('Retro Pixel Weather presentation model', () => {
  it('normalizes the four reference conditions and safe manual fallbacks without mutating legacy config', () => {
    const legacy: CreatorWidgetConfig = { title: 'Weather desk', description: 'คำอธิบายเก่า' };
    const snapshot = structuredClone(legacy);
    expect(WEATHER_CONDITIONS).toEqual(['sunny', 'rainy', 'cozy-night', 'thunder']);
    expect(getWeatherPresentation(legacy, undefined, new Date('2026-09-05T04:00:00.000Z'))).toMatchObject({ displayName: 'Weather desk', location: 'Bangkok, Thailand', unit: 'c', condition: 'sunny', current: '30°C' });
    expect(legacy).toEqual(snapshot);
  });

  it('stores canonical Celsius values and formats Fahrenheit only at presentation time', () => {
    expect(formatWeatherTemperature(30, 'c')).toBe('30°C');
    expect(formatWeatherTemperature(30, 'f')).toBe('86°F');
    expect(getWeatherPresentation({ weatherUnit: 'f', weatherCurrentCelsius: 30 }).current).toBe('86°F');
  });

  it('uses night mood only when auto day/night is enabled', () => {
    const evening = new Date('2026-09-05T13:00:00.000Z');
    expect(getWeatherPresentation({ weatherTimeZone: 'Asia/Bangkok', weatherCondition: 'sunny', weatherDayNightMode: 'auto' }, undefined, evening).condition).toBe('cozy-night');
    expect(getWeatherPresentation({ weatherTimeZone: 'Asia/Bangkok', weatherCondition: 'thunder', weatherDayNightMode: 'manual' }, undefined, evening).condition).toBe('thunder');
  });

  it('switches automatic and custom care messages and only shows configured forecast data', () => {
    expect(getWeatherPresentation({ weatherCondition: 'rainy', weatherMessageMode: 'auto' }, undefined, new Date('2026-09-05T04:00:00.000Z')).message).toContain('ร่ม');
    expect(getWeatherPresentation({ weatherMessageMode: 'custom', weatherMessage: 'พักผ่อนนะ' }).message).toBe('พักผ่อนนะ');
    expect(getWeatherPresentation({ weatherShowForecast: true, weatherForecast: [{ id: 'd1', day: 'Mon', condition: 'rainy', highCelsius: 28, lowCelsius: 23 }] }).forecast).toHaveLength(1);
    expect(getWeatherPresentation({ weatherShowForecast: true }).forecast).toHaveLength(0);
  });

  it('validates a real location/timezone and invalid manual numbers without an API dependency', () => {
    expect(isValidWeatherTimeZone('Asia/Bangkok')).toBe(true);
    expect(isValidWeatherTimeZone('No/Zone')).toBe(false);
    expect(validateWeatherConfig({ weatherLocation: ' ', weatherTimeZone: 'No/Zone', weatherHumidity: 101, weatherWindKph: Number.NaN })).toMatchObject({ weatherLocation: expect.any(String), weatherTimeZone: expect.any(String), weatherHumidity: expect.any(String), weatherWindKph: expect.any(String) });
  });
});

describe('Cherry Blossom Calendar presentation model', () => {
  it('normalizes Calendar values without mutating legacy fields or exceeding the event cap', () => {
    const legacy: CreatorWidgetConfig = { title: 'Legacy', description: 'caption', calendarView: 'invalid' as never, calendarEvents: Array.from({ length: 55 }, (_, index) => ({ id: String(index), date: '2026-05-14', title: `Event ${index}` })) };
    const normalized = normalizeCalendarConfig(legacy);
    expect(normalized.calendarView).toBe('month');
    expect(normalized.calendarSource).toBe('manual');
    expect(normalized.calendarCaption).toBe('caption');
    expect(normalized.calendarEvents).toHaveLength(50);
    expect(legacy.calendarView).toBe('invalid');
    expect(legacy.calendarEvents).toHaveLength(55);
  });

  it('normalizes defaults and legacy title/description without mutating config', () => {
    const legacy: CreatorWidgetConfig = { title: 'My planner', description: 'stay focused' };
    const snapshot = structuredClone(legacy);
    const result = getCalendarPresentation(legacy, undefined, new Date('2026-05-16T12:00:00Z'));
    expect(CALENDAR_VIEWS).toEqual(['mini', 'month', 'week', 'upcoming']);
    expect(result).toMatchObject({ displayName: 'My planner', caption: 'stay focused', view: 'month', startWeek: 'monday', eventMode: 'dot', maxEventsPerDay: 2 });
    expect(result.validEvents.length).toBeGreaterThan(0);
    expect(legacy).toEqual(snapshot);
  });

  it('builds Monday and Sunday month grids and handles leap years', () => {
    const monday = getCalendarMonthGrid(new Date(Date.UTC(2024, 1, 1)), 'monday', new Date('2024-02-10T00:00:00Z'));
    const sunday = getCalendarMonthGrid(new Date(Date.UTC(2024, 1, 1)), 'sunday', new Date('2024-02-10T00:00:00Z'));
    expect(monday).toHaveLength(42);
    expect(monday.filter(cell => cell.inCurrentMonth)).toHaveLength(29);
    expect(monday[0].date).toBe('2024-01-29');
    expect(sunday[0].date).toBe('2024-01-28');
  });

  it('maps event modes, duplicate dates and max-per-day without renderer errors', () => {
    const events = [
      { id: 'a', date: '2026-05-14', title: 'A', color: 'pink' as const },
      { id: 'b', date: '2026-05-14', title: 'B', color: 'blue' as const },
      { id: 'c', date: '2026-05-14', title: 'C', color: 'lavender' as const }
    ];
    const result = getCalendarPresentation({ calendarEvents: events, calendarEventMode: 'count', calendarMaxEventsPerDay: 2 }, undefined, new Date('2026-05-01T00:00:00Z'), new Date('2026-05-01T00:00:00Z'));
    expect(result.eventMap['2026-05-14']).toHaveLength(3);
    expect(result.eventMode).toBe('count');
    expect(result.maxEventsPerDay).toBe(2);
  });

  it('filters malformed events in presentation and blocks save with readable errors', () => {
    expect(parseCalendarDate('2026-02-29')).toBeNull();
    expect(parseCalendarDate('2024-02-29')).not.toBeNull();
    const errors = validateCalendarConfig({ calendarEvents: [{ id: 'bad', date: '2026-02-31', title: '' }] });
    expect(errors).toHaveProperty('calendar-event-0-date');
    expect(errors).toHaveProperty('calendar-event-0-title');
    expect(getCalendarPresentation({ calendarEvents: [{ id: 'bad', date: 'nope', title: '' }] }).validEvents).toHaveLength(0);
  });

  it('applies all today styles and supports transient view modes', () => {
    expect(CALENDAR_TODAY_STYLES).toEqual(['circle', 'fill', 'outline', 'underline']);
    for (const style of CALENDAR_TODAY_STYLES) expect(getCalendarPresentation({ calendarTodayStyle: style }).todayStyle).toBe(style);
    expect(getCalendarPresentation({ calendarView: 'week' }).view).toBe('week');
    expect(getCalendarPresentation({ calendarView: 'upcoming' }).view).toBe('upcoming');
  });
});
