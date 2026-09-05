import type { Asset, Folder } from '../../types';
import { isPublicFeedVisibility } from '../../lib/assetVisibility';

/** Content and presentation data owned by one Widget instance/config. */
export interface CreatorWidgetConfig {
  title?: string;
  description?: string;
  text?: string;
  status?: string;
  visibility?: 'public' | 'private';
  showCount?: boolean;
  showCompleted?: boolean;
  items?: Array<{ label: string; done: boolean }>;
  todoListTitle?: string;
  todoTasks?: TodoTask[];
  todoCategories?: TodoCategory[];
  todoListStyle?: TodoListStyle;
  todoCheckboxStyle?: TodoCheckboxStyle;
  todoCompletedBehavior?: TodoCompletedBehavior;
  todoProgressMode?: TodoProgressMode;
  todoShowPriority?: boolean;
  todoResetSchedule?: TodoResetSchedule;
  todoLastResetAt?: string;
  todoTransparentBackground?: boolean;
  links?: Array<{ label: string; url: string }>;
  goal?: number;
  imageUrl?: string;
  icon?: string;
  noteKicker?: string;
  noteBadge?: string;
  noteFooterLeft?: string;
  noteFooterRight?: string;
  goalType?: GoalType;
  goalStyle?: GoalStyle;
  goalTitle?: string;
  goalDescription?: string;
  goalIcon?: string;
  goalCurrent?: number;
  goalTarget?: number;
  goalUnit?: string;
  goalItems?: Array<{ label: string; done: boolean }>;
  goalStartDate?: string;
  goalDeadline?: string;
  showPercent?: boolean;
  showFraction?: boolean;
  showRemaining?: boolean;
  musicType?: MusicType;
  musicSource?: MusicSource;
  musicUrl?: string;
  musicCoverUrl?: string;
  musicTitle?: string;
  musicArtist?: string;
  musicCaption?: string;
  playlistName?: string;
  playlistTracks?: MusicTrack[];
  activeTrackIndex?: number;
  musicStyle?: MusicStyle;
  showCover?: boolean;
  showTitle?: boolean;
  showArtist?: boolean;
  showProgress?: boolean;
  showControls?: boolean;
  showDuration?: boolean;
  showTrackList?: boolean;
  showTrackNumbers?: boolean;
  showTrackDuration?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  startMuted?: boolean;
  galleryType?: GalleryType;
  galleryTitle?: string;
  galleryCaption?: string;
  galleryItems?: GalleryItem[];
  galleryTemplate?: GalleryTemplate;
  galleryCollageLayout?: GalleryCollageLayout;
  galleryGap?: GalleryGap;
  galleryImageFit?: GalleryImageFit;
  galleryOuterRadius?: number;
  galleryInnerRadius?: number;
  galleryFocusPoint?: GalleryFocusPoint;
  galleryGifUrl?: string;
  galleryAutoplay?: boolean;
  galleryLoop?: boolean;
  galleryPauseOnHover?: boolean;
  galleryShowCaption?: boolean;
  galleryShowCounter?: boolean;
  galleryShowSourceLabel?: boolean;
  decorationType?: DecorationType;
  decorationStickerIcon?: DecorationStickerIcon;
  decorationStickerUrl?: string;
  decorationSize?: number;
  decorationRotation?: number;
  decorationAlign?: DecorationAlign;
  decorationOpacity?: number;
  decorationText?: string;
  decorationTextStyle?: DecorationTextStyle;
  decorationTextSize?: DecorationTextSize;
  decorationPattern?: DecorationPattern;
  decorationDensity?: DecorationDensity;
  decorationScale?: number;
  decorationDividerStyle?: DecorationDividerStyle;
  decorationDividerText?: string;
  decorationDividerWidth?: DecorationDividerWidth;
  decorationDividerThickness?: DecorationDividerThickness;
  decorationAnimation?: DecorationAnimation;
  decorationAnimationSpeed?: DecorationAnimationSpeed;
  decorationLoop?: boolean;
  decorationPauseOnHover?: boolean;
  clockMode?: ClockMode;
  clockStyle?: ClockStyle;
  clockTimeZoneMode?: ClockTimeZoneMode;
  clockTimeZone?: string;
  clockCities?: ClockCity[];
  clockTimeFormat?: ClockTimeFormat;
  clockDateFormat?: ClockDateFormat;
  clockShowTime?: boolean;
  clockShowSeconds?: boolean;
  clockShowDate?: boolean;
  clockShowCity?: boolean;
  clockShowTimeZone?: boolean;
  clockShowGreeting?: boolean;
  clockGreetings?: ClockGreetings;
  clockTextAlign?: ClockTextAlign;
  clockTimeSize?: ClockTimeSize;
  clockDialMarker?: ClockDialMarker;
  clockHandStyle?: ClockHandStyle;
  clockFlipAnimation?: ClockFlipAnimation;
  clockFlipSound?: boolean;
  weatherLocation?: string;
  weatherTimeZone?: string;
  weatherUnit?: WeatherUnit;
  weatherCondition?: WeatherCondition;
  weatherDayNightMode?: WeatherDayNightMode;
  weatherCurrentCelsius?: number;
  weatherFeelsLikeCelsius?: number;
  weatherHighCelsius?: number;
  weatherLowCelsius?: number;
  weatherHumidity?: number;
  weatherWindKph?: number;
  weatherPrecipitation?: number;
  weatherMessage?: string;
  weatherMessageMode?: WeatherMessageMode;
  weatherShowCondition?: boolean;
  weatherShowFeelsLike?: boolean;
  weatherShowHumidity?: boolean;
  weatherShowWind?: boolean;
  weatherShowPrecipitation?: boolean;
  weatherShowMessage?: boolean;
  weatherShowForecast?: boolean;
  weatherForecast?: WeatherForecastItem[];
  calendarView?: CalendarView;
  calendarStartWeek?: CalendarStartWeek;
  calendarTodayStyle?: CalendarTodayStyle;
  calendarCaption?: string;
  calendarEvents?: CalendarEvent[];
  calendarEventMode?: CalendarEventMode;
  calendarMaxEventsPerDay?: 1 | 2 | 3 | 4;
  calendarShowMonthYear?: boolean;
  calendarShowToday?: boolean;
  calendarShowWeekends?: boolean;
  calendarShowWeekNumbers?: boolean;
  calendarShowEvents?: boolean;
  calendarShowUpcoming?: boolean;
  calendarShowCaption?: boolean;
  calendarSource?: 'manual';
  folderTitle?: string;
  folderSubtitle?: string;
  folderIcon?: string;
  folderStyle?: FolderStyle;
  folderOrder?: string[];
  folderPublicIds?: string[];
  folderShowItemCount?: boolean;
  folderShowPreviewItems?: boolean;
  folderShowDescription?: boolean;
  folderShowItemIcons?: boolean;
}

export type WidgetRenderSize = 'S' | 'M' | 'L';

export const DEFAULT_NOTE_ICON = '🔮';
export const DEFAULT_NOTE_KICKER = 'STATUS // CURRENT';
export const DEFAULT_NOTE_BADGE = 'FLOW';
export const DEFAULT_NOTE_FOOTER_LEFT = 'Updated just now';
export const NOTE_FALLBACK_TITLE = 'โน้ตของฉัน';
export const NOTE_FALLBACK_TEXT = 'พื้นที่ส่วนตัวไม่จำเป็นต้องสมบูรณ์ แค่ช่วยให้เราอยากกลับมาก็พอ';

export const NOTE_ICON_PRESETS = ['🔮', '🌿', '💡', '🍵', '☕', '✨', '📌', '✏️'] as const;

export type MusicType = 'playlist' | 'single';
export type MusicSource = 'spotify' | 'apple-music' | 'soundcloud' | 'other';
export type MusicStyle = 'card' | 'vinyl' | 'compact' | 'mini';
export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: string;
  url?: string;
}
export const MUSIC_TYPES: readonly MusicType[] = ['playlist', 'single'];
export const MUSIC_SOURCES: readonly MusicSource[] = ['spotify', 'apple-music', 'soundcloud', 'other'];
export const MUSIC_STYLES: readonly MusicStyle[] = ['card', 'vinyl', 'compact', 'mini'];
export const DEFAULT_MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'track-1', title: '弥散渐变 (Diffused Twilight)', artist: 'Chilled Romantic', duration: '3:24' },
  { id: 'track-2', title: 'Sakura Milk Cloud', artist: 'Dept feat. Yurie', duration: '3:05' },
  { id: 'track-3', title: 'Peace and Joy (平安喜乐)', artist: 'HYBS Acoustic', duration: '2:48' },
  { id: 'track-4', title: 'Iris Rain & Tokyo Walk', artist: 'Origami Chill', duration: '3:12' }
];
export const DEFAULT_MUSIC_DISPLAY_NAME = 'เพลงของฉัน';
export const DEFAULT_MUSIC_PLAYLIST_NAME = 'late night playlist';
export const DEFAULT_MUSIC_TITLE = 'เพลงที่เลือก';
export const DEFAULT_MUSIC_ARTIST = 'ศิลปินของฉัน';
export const DEFAULT_MUSIC_CAPTION = 'เพลงสำหรับโหมดสร้างงาน';

export type GalleryType = 'single' | 'template' | 'collage' | 'gif';
export type GalleryTemplate = 'minimal' | 'magazine' | 'polaroid' | 'film-strip' | 'grid';
export type GalleryCollageLayout = 'two' | 'three' | 'four';
export type GalleryGap = 0 | 4 | 8 | 12;
export type GalleryImageFit = 'cover' | 'contain' | 'natural';
export type GalleryFocusPoint = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export interface GalleryItem {
  id: string;
  src: string;
  alt?: string;
  caption?: string;
  source: 'asset' | 'upload' | 'url';
  assetId?: string;
  mimeType?: string;
}
export const GALLERY_TYPES: readonly GalleryType[] = ['single', 'template', 'collage', 'gif'];
export const GALLERY_TEMPLATES: readonly GalleryTemplate[] = ['minimal', 'magazine', 'polaroid', 'film-strip', 'grid'];
export const GALLERY_COLLAGE_LAYOUTS: readonly GalleryCollageLayout[] = ['two', 'three', 'four'];
export const GALLERY_GAPS: readonly GalleryGap[] = [0, 4, 8, 12];
export const GALLERY_IMAGE_FITS: readonly GalleryImageFit[] = ['cover', 'contain', 'natural'];
export const GALLERY_FOCUS_POINTS: readonly GalleryFocusPoint[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
export const DEFAULT_GALLERY_DISPLAY_NAME = 'summer memories';
export const DEFAULT_GALLERY_CAPTION = 'คัดสรรภาพและบรรยากาศที่อยากกลับมาดูอีกครั้ง';

export type DecorationType = 'sticker' | 'text' | 'pattern' | 'divider' | 'animated';
export type DecorationStickerIcon = 'sparkles' | 'heart' | 'flower' | 'cloud' | 'bow' | 'frame' | 'orbit';
export type DecorationAlign = 'left' | 'center' | 'right';
export type DecorationTextStyle = 'serif' | 'handwritten' | 'mono' | 'sans';
export type DecorationTextSize = 'small' | 'medium' | 'large';
export type DecorationPattern = 'stars' | 'dots' | 'grid' | 'fluid';
export type DecorationDensity = 'low' | 'medium' | 'high';
export type DecorationDividerStyle = 'line' | 'dots' | 'stars' | 'tape';
export type DecorationDividerWidth = 50 | 75 | 100;
export type DecorationDividerThickness = 'thin' | 'medium' | 'thick';
export type DecorationAnimation = 'drift' | 'pulse' | 'sparkle' | 'falling-stars';
export type DecorationAnimationSpeed = 'slow' | 'normal' | 'fast';
export const DECORATION_TYPES: readonly DecorationType[] = ['sticker', 'text', 'pattern', 'divider', 'animated'];
export const DECORATION_STICKER_ICONS: readonly DecorationStickerIcon[] = ['sparkles', 'heart', 'flower', 'cloud', 'bow', 'frame', 'orbit'];
export const DECORATION_ALIGNS: readonly DecorationAlign[] = ['left', 'center', 'right'];
export const DECORATION_TEXT_STYLES: readonly DecorationTextStyle[] = ['serif', 'handwritten', 'mono', 'sans'];
export const DECORATION_TEXT_SIZES: readonly DecorationTextSize[] = ['small', 'medium', 'large'];
export const DECORATION_PATTERNS: readonly DecorationPattern[] = ['stars', 'dots', 'grid', 'fluid'];
export const DECORATION_DENSITIES: readonly DecorationDensity[] = ['low', 'medium', 'high'];
export const DECORATION_DIVIDER_STYLES: readonly DecorationDividerStyle[] = ['line', 'dots', 'stars', 'tape'];
export const DECORATION_DIVIDER_WIDTHS: readonly DecorationDividerWidth[] = [50, 75, 100];
export const DECORATION_DIVIDER_THICKNESSES: readonly DecorationDividerThickness[] = ['thin', 'medium', 'thick'];
export const DECORATION_ANIMATIONS: readonly DecorationAnimation[] = ['drift', 'pulse', 'sparkle', 'falling-stars'];
export const DECORATION_ANIMATION_SPEEDS: readonly DecorationAnimationSpeed[] = ['slow', 'normal', 'fast'];
export const DEFAULT_DECORATION_DISPLAY_NAME = 'Abyssal Specimen Sparkle';
export const DEFAULT_DECORATION_TEXT = 'romanticize your life ♡';
export const DEFAULT_DECORATION_DIVIDER_TEXT = '✦ daily life · abyssal calm ✦';

export type ClockMode = 'local' | 'world';
export type ClockStyle = 'digital' | 'analog' | 'flip' | 'cute' | 'world';
export type ClockTimeZoneMode = 'auto' | 'custom';
export type ClockTimeFormat = '12h' | '24h';
export type ClockDateFormat = 'weekday-date' | 'long' | 'short' | 'hidden';
export type ClockTextAlign = 'left' | 'center' | 'right';
export type ClockTimeSize = 'small' | 'medium' | 'large';
export type ClockDialMarker = 'dots' | 'ticks' | 'roman';
export type ClockHandStyle = 'rounded' | 'classic';
export type ClockFlipAnimation = 'smooth' | 'drop';
export interface ClockCity {
  id: string;
  name: string;
  timeZone: string;
}
export interface ClockGreetings {
  morning?: string;
  afternoon?: string;
  evening?: string;
  night?: string;
}
export const CLOCK_MODES: readonly ClockMode[] = ['local', 'world'];
export const CLOCK_STYLES: readonly ClockStyle[] = ['digital', 'analog', 'flip', 'cute', 'world'];
export const CLOCK_TIMEZONE_MODES: readonly ClockTimeZoneMode[] = ['auto', 'custom'];
export const CLOCK_TIME_FORMATS: readonly ClockTimeFormat[] = ['12h', '24h'];
export const CLOCK_DATE_FORMATS: readonly ClockDateFormat[] = ['weekday-date', 'long', 'short', 'hidden'];
export const CLOCK_TEXT_ALIGNS: readonly ClockTextAlign[] = ['left', 'center', 'right'];
export const CLOCK_TIME_SIZES: readonly ClockTimeSize[] = ['small', 'medium', 'large'];
export const CLOCK_DIAL_MARKERS: readonly ClockDialMarker[] = ['dots', 'ticks', 'roman'];
export const CLOCK_HAND_STYLES: readonly ClockHandStyle[] = ['rounded', 'classic'];
export const CLOCK_FLIP_ANIMATIONS: readonly ClockFlipAnimation[] = ['smooth', 'drop'];
export const DEFAULT_CLOCK_DISPLAY_NAME = 'นาฬิกาของฉัน';
export const DEFAULT_CLOCK_TIMEZONE = 'Asia/Bangkok';
export const DEFAULT_CLOCK_GREETINGS: Required<ClockGreetings> = {
  morning: 'อรุณสวัสดิ์ · ขอให้วันนี้เป็นวันที่ดี ☀️',
  afternoon: 'พักสายตาสักนิด แล้วค่อยไปต่อ 🌤️',
  evening: 'ช่วงเย็นของคุณกำลังเริ่มต้นขึ้น ✦',
  night: 'ค่ำคืนแสนสงบ · ได้เวลาพักผ่อน 🌙'
};
export const DEFAULT_CLOCK_CITIES: readonly ClockCity[] = [
  { id: 'bangkok', name: 'Bangkok', timeZone: 'Asia/Bangkok' },
  { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { id: 'london', name: 'London', timeZone: 'Europe/London' }
];

export type WeatherUnit = 'c' | 'f';
export type WeatherCondition = 'sunny' | 'rainy' | 'cozy-night' | 'thunder';
export type WeatherDayNightMode = 'auto' | 'manual';
export type WeatherMessageMode = 'auto' | 'custom';
export interface WeatherForecastItem {
  id: string;
  day: string;
  condition: WeatherCondition;
  highCelsius: number;
  lowCelsius: number;
}

export type CalendarView = 'mini' | 'month' | 'week' | 'upcoming';
export type CalendarStartWeek = 'monday' | 'sunday';
export type CalendarTodayStyle = 'circle' | 'fill' | 'outline' | 'underline';
export type CalendarEventMode = 'dot' | 'label' | 'count';
export type CalendarEventColor = 'pink' | 'blue' | 'lavender' | 'cream';
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  time?: string;
  icon?: string;
  color?: CalendarEventColor;
}
export const CALENDAR_VIEWS: readonly CalendarView[] = ['mini', 'month', 'week', 'upcoming'];
export const CALENDAR_START_WEEKS: readonly CalendarStartWeek[] = ['monday', 'sunday'];
export const CALENDAR_TODAY_STYLES: readonly CalendarTodayStyle[] = ['circle', 'fill', 'outline', 'underline'];
export const CALENDAR_EVENT_MODES: readonly CalendarEventMode[] = ['dot', 'label', 'count'];
export const CALENDAR_EVENT_COLORS: readonly CalendarEventColor[] = ['pink', 'blue', 'lavender', 'cream'];
export const CALENDAR_MAX_EVENTS: readonly [1, 2, 3, 4] = [1, 2, 3, 4];
export const DEFAULT_CALENDAR_DISPLAY_NAME = 'ปฏิทินของฉัน';
export const DEFAULT_CALENDAR_CAPTION = 'stay cozy & organized';
export const DEFAULT_CALENDAR_EVENTS: readonly CalendarEvent[] = [
  { id: 'calendar-demo-1', date: '2026-05-14', title: 'วางแผนสัปดาห์', time: '09:30', icon: '✦', color: 'pink' },
  { id: 'calendar-demo-2', date: '2026-05-20', title: 'ส่งงาน Notion', time: '15:00', icon: '✎', color: 'blue' },
  { id: 'calendar-demo-3', date: '2026-05-25', title: 'พักและรีเซ็ต', color: 'lavender' }
];

export type FolderStyle = 'card' | 'open' | 'list' | 'cute';
export const FOLDER_STYLES: readonly FolderStyle[] = ['card', 'open', 'list', 'cute'];
export const DEFAULT_FOLDER_DISPLAY_NAME = 'โฟลเดอร์ของฉัน';
export const DEFAULT_FOLDER_TITLE = 'โฟลเดอร์ของฉัน';
export const DEFAULT_FOLDER_SUBTITLE = 'จัดระเบียบผลงานให้ค้นหาได้ง่าย';
export const DEFAULT_FOLDER_ICON = 'folder';
export const DEFAULT_FOLDER_STYLE: FolderStyle = 'card';
export const FOLDER_MAX_VISIBLE = 6;
export const FOLDER_MAX_PREVIEW_ITEMS = 4;
export const WEATHER_UNITS: readonly WeatherUnit[] = ['c', 'f'];
export const WEATHER_CONDITIONS: readonly WeatherCondition[] = ['sunny', 'rainy', 'cozy-night', 'thunder'];
export const WEATHER_DAY_NIGHT_MODES: readonly WeatherDayNightMode[] = ['auto', 'manual'];
export const WEATHER_MESSAGE_MODES: readonly WeatherMessageMode[] = ['auto', 'custom'];
export const DEFAULT_WEATHER_DISPLAY_NAME = 'สภาพอากาศของฉัน';
export const DEFAULT_WEATHER_LOCATION = 'Bangkok, Thailand';
export const DEFAULT_WEATHER_TIME_ZONE = 'Asia/Bangkok';
export const DEFAULT_WEATHER_MESSAGE = 'อย่าลืมดื่มน้ำและทาครีมกันแดดนะ';

export type TodoPriority = 'low' | 'medium' | 'high';
export type TodoStatus = 'todo' | 'in-progress' | 'completed';
export type TodoCategoryColor = 'coffee' | 'blush' | 'blue' | 'lavender';
export type TodoListStyle = 'simple' | 'today-time' | 'categorized' | 'cute';
export type TodoCheckboxStyle = 'classic' | 'dot' | 'heart' | 'star' | 'tulip';
export type TodoCompletedBehavior = 'strike-fade' | 'move-bottom' | 'hide';
export type TodoProgressMode = 'bar' | 'number' | 'percent';
export type TodoResetSchedule = 'daily' | 'weekly' | 'manual';
export interface TodoCategory { id: string; label: string; color: TodoCategoryColor; }
export interface TodoTask { id: string; label: string; done: boolean; categoryId?: string; priority?: TodoPriority; time?: string; status?: TodoStatus; }
export const TODO_LIST_STYLES: readonly TodoListStyle[] = ['simple', 'today-time', 'categorized', 'cute'];
export const TODO_CHECKBOX_STYLES: readonly TodoCheckboxStyle[] = ['classic', 'dot', 'heart', 'star', 'tulip'];
export const TODO_COMPLETED_BEHAVIORS: readonly TodoCompletedBehavior[] = ['strike-fade', 'move-bottom', 'hide'];
export const TODO_PROGRESS_MODES: readonly TodoProgressMode[] = ['bar', 'number', 'percent'];
export const TODO_RESET_SCHEDULES: readonly TodoResetSchedule[] = ['daily', 'weekly', 'manual'];
export const DEFAULT_TODO_DISPLAY_NAME = 'สิ่งที่ต้องทำของฉัน';
export const DEFAULT_TODO_LIST_TITLE = 'Morning & Daily Focus';
export const DEFAULT_TODO_CATEGORIES: readonly TodoCategory[] = [
  { id: 'work', label: 'Work', color: 'coffee' }, { id: 'personal', label: 'Personal', color: 'blush' }, { id: 'study', label: 'Study', color: 'blue' }
];
export const DEFAULT_TODO_TASKS: readonly TodoTask[] = [
  { id: 'todo-1', label: 'สรุปไอเดีย Notion Presentation', done: true, categoryId: 'personal', priority: 'medium', time: '07:30', status: 'completed' },
  { id: 'todo-2', label: 'จัดสไลด์ Notion Presentation', done: false, categoryId: 'work', priority: 'high', time: '10:00', status: 'todo' },
  { id: 'todo-3', label: 'อ่านหนังสือ Atomic Habits 20 หน้า', done: false, categoryId: 'study', priority: 'low', time: '20:30', status: 'in-progress' },
  { id: 'todo-4', label: 'ยืดเส้น 15 นาที Sunset Yoga', done: false, categoryId: 'personal', priority: 'low', time: '17:45', status: 'todo' }
];

const todoChoice = <T,>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const todoClean = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() || fallback : fallback;
export function normalizeTodoTask(task: unknown, index: number): TodoTask {
  const value = task && typeof task === 'object' ? task as Record<string, unknown> : {};
  const done = Boolean(value.done);
  return { id: todoClean(value.id, `todo-${index + 1}`), label: todoClean(value.label), done, categoryId: todoClean(value.categoryId), priority: todoChoice(value.priority, ['low', 'medium', 'high'] as const, 'medium'), time: todoClean(value.time), status: done ? 'completed' : todoChoice(value.status, ['todo', 'in-progress', 'completed'] as const, 'todo') };
}
export function normalizeTodoCategory(category: unknown, index: number): TodoCategory {
  const value = category && typeof category === 'object' ? category as Record<string, unknown> : {};
  return { id: todoClean(value.id, `category-${index + 1}`), label: todoClean(value.label, `Category ${index + 1}`), color: todoChoice(value.color, ['coffee', 'blush', 'blue', 'lavender'] as const, 'lavender') };
}
function todoPeriodStart(schedule: TodoResetSchedule, date: Date) {
  const current = new Date(date); current.setHours(0, 0, 0, 0);
  if (schedule === 'weekly') { const offset = (current.getDay() + 6) % 7; current.setDate(current.getDate() - offset); }
  return current.getTime();
}
export function getTodoPresentation(config: CreatorWidgetConfig, displayName?: string, now = new Date()) {
  const explicitTasks = Array.isArray(config.todoTasks);
  const rawTasks = explicitTasks ? config.todoTasks! : Array.isArray(config.items) && config.items.length ? config.items.map((item, index) => ({ ...item, id: `legacy-${index}`, status: item.done ? 'completed' : 'todo' })) : DEFAULT_TODO_TASKS;
  const schedule = todoChoice(config.todoResetSchedule, TODO_RESET_SCHEDULES, 'daily');
  const lastReset = new Date(config.todoLastResetAt || 0);
  const needsReset = explicitTasks && schedule !== 'manual' && Boolean(config.todoLastResetAt) && Number.isFinite(lastReset.getTime()) && todoPeriodStart(schedule, lastReset) < todoPeriodStart(schedule, now);
  const tasks = rawTasks.map(normalizeTodoTask).slice(0, 40).map(task => needsReset ? { ...task, done: false, status: 'todo' as TodoStatus } : task);
  const categories = (Array.isArray(config.todoCategories) && config.todoCategories.length ? config.todoCategories : DEFAULT_TODO_CATEGORIES).map(normalizeTodoCategory).slice(0, 12);
  const behavior = todoChoice(config.todoCompletedBehavior, TODO_COMPLETED_BEHAVIORS, 'strike-fade');
  const ordered = behavior === 'move-bottom' ? [...tasks].sort((a, b) => Number(a.done) - Number(b.done)) : tasks;
  const visibleTasks = behavior === 'hide' ? ordered.filter(task => !task.done) : ordered;
  const completed = tasks.filter(task => task.done).length;
  return { displayName: todoClean(displayName, todoClean(config.title, DEFAULT_TODO_DISPLAY_NAME)), listTitle: todoClean(config.todoListTitle, DEFAULT_TODO_LIST_TITLE), tasks, visibleTasks, categories, style: todoChoice(config.todoListStyle, TODO_LIST_STYLES, 'today-time'), checkboxStyle: todoChoice(config.todoCheckboxStyle, TODO_CHECKBOX_STYLES, 'heart'), behavior, progressMode: todoChoice(config.todoProgressMode, TODO_PROGRESS_MODES, 'bar'), showPriority: config.todoShowPriority !== false, resetSchedule: schedule, lastResetAt: config.todoLastResetAt || '', needsReset, transparent: Boolean(config.todoTransparentBackground), completed, total: tasks.length, percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 };
}
export function validateTodoConfig(config: CreatorWidgetConfig, displayName?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!todoClean(displayName, todoClean(config.title))) errors.displayName = 'กรุณาใส่ชื่อวิดเจ็ต';
  if (!todoClean(config.todoListTitle, DEFAULT_TODO_LIST_TITLE)) errors.todoListTitle = 'กรุณาใส่ชื่อรายการ';
  (config.todoTasks || []).forEach((task, index) => { if (!todoClean(task.label)) errors[`todo-task-${index}`] = 'กรุณาใส่ชื่องาน'; });
  return errors;
}

const clockChoice = <T,>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const clockClean = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() || fallback : fallback;

export function isValidClockTimeZone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeClockCity(city: unknown, index: number): ClockCity {
  const value = city && typeof city === 'object' ? city as Record<string, unknown> : {};
  return {
    id: clockClean(value.id, `city-${index + 1}`),
    name: clockClean(value.name, `City ${index + 1}`),
    timeZone: clockClean(value.timeZone, DEFAULT_CLOCK_TIMEZONE)
  };
}

function clockTimeZone(config: CreatorWidgetConfig): { value: string; valid: boolean; mode: ClockTimeZoneMode } {
  const mode = clockChoice(config.clockTimeZoneMode, CLOCK_TIMEZONE_MODES, 'auto');
  const deviceZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_CLOCK_TIMEZONE; } catch { return DEFAULT_CLOCK_TIMEZONE; }
  })();
  const raw = clockClean(config.clockTimeZone);
  const requested = mode === 'auto' ? deviceZone : (raw || DEFAULT_CLOCK_TIMEZONE);
  const valid = mode === 'custom' ? isValidClockTimeZone(raw) : isValidClockTimeZone(requested);
  return { value: valid ? requested : DEFAULT_CLOCK_TIMEZONE, valid, mode };
}

function getClockGreeting(hour: number, greetings: Required<ClockGreetings>): string {
  if (hour < 12) return greetings.morning;
  if (hour < 17) return greetings.afternoon;
  if (hour < 21) return greetings.evening;
  return greetings.night;
}

function formatClockTime(date: Date, timeZone: string, timeFormat: ClockTimeFormat, showSeconds: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
    hour12: timeFormat === '12h'
  }).format(date);
}

function formatClockDate(date: Date, timeZone: string, dateFormat: ClockDateFormat): string {
  if (dateFormat === 'hidden') return '';
  const options: Intl.DateTimeFormatOptions = dateFormat === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : dateFormat === 'short'
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { weekday: 'long', day: 'numeric', month: 'long' };
  return new Intl.DateTimeFormat('th-TH', { ...options, timeZone }).format(date);
}

function getClockParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  return {
    hour: Number(parts.find(part => part.type === 'hour')?.value || 0),
    minute: Number(parts.find(part => part.type === 'minute')?.value || 0),
    second: Number(parts.find(part => part.type === 'second')?.value || 0)
  };
}

export function getClockPresentation(config: CreatorWidgetConfig, displayName?: string, now = new Date()) {
  const mode = clockChoice(config.clockMode, CLOCK_MODES, 'local');
  const style = clockChoice(config.clockStyle, CLOCK_STYLES, 'digital');
  const timeFormat = clockChoice(config.clockTimeFormat, CLOCK_TIME_FORMATS, '24h');
  const dateFormat = clockChoice(config.clockDateFormat, CLOCK_DATE_FORMATS, 'weekday-date');
  const alignment = clockChoice(config.clockTextAlign, CLOCK_TEXT_ALIGNS, 'center');
  const timeSize = clockChoice(config.clockTimeSize, CLOCK_TIME_SIZES, 'medium');
  const dialMarker = clockChoice(config.clockDialMarker, CLOCK_DIAL_MARKERS, 'dots');
  const handStyle = clockChoice(config.clockHandStyle, CLOCK_HAND_STYLES, 'rounded');
  const flipAnimation = clockChoice(config.clockFlipAnimation, CLOCK_FLIP_ANIMATIONS, 'smooth');
  const zone = clockTimeZone(config);
  const greetings: Required<ClockGreetings> = {
    ...DEFAULT_CLOCK_GREETINGS,
    ...(config.clockGreetings || {})
  };
  const configuredCities = Array.isArray(config.clockCities)
    ? config.clockCities.map(normalizeClockCity).slice(0, 4)
    : [];
  const cities = (configuredCities.length ? configuredCities : DEFAULT_CLOCK_CITIES.slice(0, 3).map(normalizeClockCity))
    .map(city => ({ ...city, validTimeZone: isValidClockTimeZone(city.timeZone), timeZone: isValidClockTimeZone(city.timeZone) ? city.timeZone : DEFAULT_CLOCK_TIMEZONE }))
    .filter(city => city.name.trim());
  const mainCity = cities[0] || { ...DEFAULT_CLOCK_CITIES[0], validTimeZone: true };
  const showSeconds = config.clockShowSeconds !== false;
  const showDate = config.clockShowDate !== false && dateFormat !== 'hidden';
  const numeric = getClockParts(now, zone.value);
  const clockTitle = displayName?.trim() || config.title?.trim() || DEFAULT_CLOCK_DISPLAY_NAME;
  const main = {
    ...mainCity,
    name: zone.mode === 'custom' ? zone.value.split('/').pop()?.replace(/_/g, ' ') || zone.value : mainCity.name,
    timeZone: zone.value,
    time: formatClockTime(now, zone.value, timeFormat, showSeconds),
    date: showDate ? formatClockDate(now, zone.value, dateFormat) : '',
    hour: numeric.hour,
    minute: numeric.minute,
    second: numeric.second,
    greeting: getClockGreeting(numeric.hour, greetings)
  };
  const cityTimes = cities.slice(0, mode === 'world' || style === 'world' ? 4 : 1).map(city => ({
    ...city,
    time: formatClockTime(now, city.timeZone, timeFormat, false),
    date: showDate ? formatClockDate(now, city.timeZone, dateFormat) : ''
  }));
  return {
    mode,
    style,
    timeZoneMode: zone.mode,
    timeZone: zone.value,
    timeZoneValid: zone.valid,
    displayName: clockTitle,
    timeFormat,
    dateFormat,
    textAlign: alignment,
    timeSize,
    dialMarker,
    handStyle,
    flipAnimation,
    flipSound: Boolean(config.clockFlipSound),
    showTime: config.clockShowTime !== false,
    showSeconds,
    showDate,
    showCity: config.clockShowCity !== false,
    showTimeZone: config.clockShowTimeZone !== false,
    showGreeting: config.clockShowGreeting !== false,
    greetings,
    caption: clockClean(config.description, 'เวลาท้องถิ่น · Asia/Bangkok'),
    main,
    cities: cityTimes
  };
}

export function validateClockConfig(config: CreatorWidgetConfig): Record<string, string> {
  const clock = getClockPresentation(config);
  const errors: Record<string, string> = {};
  if (!clock.displayName.trim()) errors.displayName = 'กรุณาใส่ชื่อวิดเจ็ต';
  if (clock.timeZoneMode === 'custom' && !clock.timeZoneValid) errors.clockTimeZone = 'กรุณาใช้ IANA timezone ที่ถูกต้อง เช่น Asia/Bangkok';
  (config.clockCities || []).forEach((city, index) => {
    const normalized = normalizeClockCity(city, index);
    if (!normalized.name.trim()) errors[`clock-city-${index}`] = 'กรุณาใส่ชื่อเมือง';
    if (!isValidClockTimeZone(normalized.timeZone)) errors[`clock-city-${index}`] = 'กรุณาใช้ timezone ที่ถูกต้อง';
  });
  return errors;
}

const weatherChoice = <T>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const weatherNumber = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function isValidWeatherTimeZone(value: string): boolean {
  return isValidClockTimeZone(value);
}

export function formatWeatherTemperature(celsius: number, unit: WeatherUnit): string {
  const value = unit === 'f' ? (celsius * 9 / 5) + 32 : celsius;
  return `${Math.round(value)}°${unit === 'f' ? 'F' : 'C'}`;
}

export function normalizeWeatherForecastItem(item: unknown, index: number): WeatherForecastItem {
  const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  return {
    id: clockClean(value.id, `forecast-${index + 1}`),
    day: clockClean(value.day, `Day ${index + 1}`),
    condition: weatherChoice(value.condition, WEATHER_CONDITIONS, 'sunny'),
    highCelsius: weatherNumber(value.highCelsius, 30),
    lowCelsius: weatherNumber(value.lowCelsius, 24)
  };
}

function getWeatherHour(now: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(now).find(part => part.type === 'hour')?.value || 12);
}

function getAutomaticWeatherMessage(condition: WeatherCondition, hour: number): string {
  if (condition === 'rainy') return 'พกร่มไว้ใกล้ตัวนะ · วันนี้อาจมีฝนปรอย ๆ';
  if (condition === 'thunder') return 'ฟ้าคะนองเบา ๆ · อยู่ในที่ปลอดภัยและพักสายตานะ';
  if (condition === 'cozy-night' || hour >= 18 || hour < 6) return 'ค่ำคืนนี้อากาศนุ่ม ๆ · เปิดเพลงเบา ๆ แล้วพักผ่อนนะ';
  return 'อย่าลืมดื่มน้ำและทาครีมกันแดดนะ';
}

export function getWeatherPresentation(config: CreatorWidgetConfig, displayName?: string, now = new Date()) {
  const unit = weatherChoice(config.weatherUnit, WEATHER_UNITS, 'c');
  const timeZoneRaw = clockClean(config.weatherTimeZone, DEFAULT_WEATHER_TIME_ZONE);
  const timeZoneValid = isValidWeatherTimeZone(timeZoneRaw);
  const timeZone = timeZoneValid ? timeZoneRaw : DEFAULT_WEATHER_TIME_ZONE;
  const dayNightMode = weatherChoice(config.weatherDayNightMode, WEATHER_DAY_NIGHT_MODES, 'auto');
  const manualCondition = weatherChoice(config.weatherCondition, WEATHER_CONDITIONS, 'sunny');
  const hour = getWeatherHour(now, timeZone);
  const condition: WeatherCondition = dayNightMode === 'auto' && (hour >= 18 || hour < 6) ? 'cozy-night' : manualCondition;
  const currentCelsius = weatherNumber(config.weatherCurrentCelsius, 30);
  const feelsLikeCelsius = weatherNumber(config.weatherFeelsLikeCelsius, 37);
  const highCelsius = weatherNumber(config.weatherHighCelsius, 34);
  const lowCelsius = weatherNumber(config.weatherLowCelsius, 27);
  const humidity = Math.max(0, Math.min(100, weatherNumber(config.weatherHumidity, 70)));
  const windKph = Math.max(0, weatherNumber(config.weatherWindKph, 12));
  const precipitation = Math.max(0, Math.min(100, weatherNumber(config.weatherPrecipitation, 30)));
  const forecast = Array.isArray(config.weatherForecast) ? config.weatherForecast.map(normalizeWeatherForecastItem).slice(0, 5) : [];
  const messageMode = weatherChoice(config.weatherMessageMode, WEATHER_MESSAGE_MODES, 'auto');
  return {
    displayName: clockClean(displayName, clockClean(config.title, DEFAULT_WEATHER_DISPLAY_NAME)),
    location: clockClean(config.weatherLocation, DEFAULT_WEATHER_LOCATION),
    timeZone,
    timeZoneValid,
    unit,
    condition,
    dayNightMode,
    currentCelsius,
    feelsLikeCelsius,
    highCelsius,
    lowCelsius,
    humidity,
    windKph,
    precipitation,
    current: formatWeatherTemperature(currentCelsius, unit),
    feelsLike: formatWeatherTemperature(feelsLikeCelsius, unit),
    high: formatWeatherTemperature(highCelsius, unit),
    low: formatWeatherTemperature(lowCelsius, unit),
    messageMode,
    message: messageMode === 'custom' ? clockClean(config.weatherMessage, DEFAULT_WEATHER_MESSAGE) : getAutomaticWeatherMessage(condition, hour),
    showCondition: config.weatherShowCondition !== false,
    showFeelsLike: config.weatherShowFeelsLike !== false,
    showHumidity: config.weatherShowHumidity !== false,
    showWind: config.weatherShowWind !== false,
    showPrecipitation: config.weatherShowPrecipitation !== false,
    showMessage: config.weatherShowMessage !== false,
    showForecast: Boolean(config.weatherShowForecast),
    forecast,
    hour
  };
}

export function validateWeatherConfig(config: CreatorWidgetConfig, displayName?: string): Record<string, string> {
  const weather = getWeatherPresentation(config, displayName);
  const errors: Record<string, string> = {};
  if (displayName !== undefined && !displayName.trim()) errors.displayName = 'กรุณาใส่ชื่อวิดเจ็ต';
  if (config.weatherLocation !== undefined && !config.weatherLocation.trim()) errors.weatherLocation = 'กรุณาใส่ตำแหน่งที่ตั้ง';
  if (!weather.timeZoneValid) errors.weatherTimeZone = 'กรุณาใช้ IANA timezone ที่ถูกต้อง เช่น Asia/Bangkok';
  const humidityRaw = Number(config.weatherHumidity);
  if (config.weatherHumidity !== undefined && (!Number.isFinite(humidityRaw) || humidityRaw < 0 || humidityRaw > 100)) errors.weatherHumidity = 'ความชื้นต้องอยู่ระหว่าง 0–100';
  const numericFields: Array<keyof CreatorWidgetConfig> = ['weatherCurrentCelsius', 'weatherFeelsLikeCelsius', 'weatherHighCelsius', 'weatherLowCelsius', 'weatherWindKph', 'weatherPrecipitation'];
  numericFields.forEach(key => { if (config[key] !== undefined && !Number.isFinite(Number(config[key]))) errors[String(key)] = 'กรุณาใช้ตัวเลขที่ถูกต้อง'; });
  (config.weatherForecast || []).forEach((item, index) => {
    const normalized = normalizeWeatherForecastItem(item, index);
    if (!normalized.day.trim()) errors[`weatherForecast-${index}`] = 'กรุณาใส่วันของ forecast';
    if (!Number.isFinite(normalized.highCelsius) || !Number.isFinite(normalized.lowCelsius)) errors[`weatherForecast-${index}`] = 'อุณหภูมิ forecast ต้องเป็นตัวเลข';
  });
  return errors;
}

export type GoalType = 'number' | 'money' | 'checklist' | 'date';
export type GoalStyle = 'bar' | 'ring' | 'counter' | 'cute';

export const GOAL_TYPES: readonly GoalType[] = ['number', 'money', 'checklist', 'date'];
export const GOAL_STYLES: readonly GoalStyle[] = ['bar', 'ring', 'counter', 'cute'];
export const GOAL_ICON_PRESETS = ['🎯', '📚', '✨', '🌿', '🧘', '💧', '💸', '☕'] as const;
export const DEFAULT_GOAL_DISPLAY_NAME = 'MONTHLY GOAL';
export const DEFAULT_GOAL_TITLE = 'เป้าหมายของฉัน';
export const DEFAULT_GOAL_DESCRIPTION = 'ค่อย ๆ เดินไปตามจังหวะของตัวเอง';

const toFiniteNonNegative = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const parseGoalDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : time;
};

export function getGoalPresentation(config: CreatorWidgetConfig, displayName?: string, now = new Date()) {
  const goalType: GoalType = GOAL_TYPES.includes(config.goalType as GoalType) ? config.goalType as GoalType : 'number';
  const goalStyle: GoalStyle = GOAL_STYLES.includes(config.goalStyle as GoalStyle) ? config.goalStyle as GoalStyle : 'bar';
  const items = (config.goalItems || []).map(item => ({ label: item.label || '', done: Boolean(item.done) }));
  const startTime = parseGoalDate(config.goalStartDate);
  const deadlineTime = parseGoalDate(config.goalDeadline);
  const legacyCurrent = toFiniteNonNegative(config.goal, 0);
  let current = toFiniteNonNegative(config.goalCurrent, legacyCurrent);
  let target = Math.max(1, toFiniteNonNegative(config.goalTarget, goalType === 'number' && config.goalCurrent === undefined ? 100 : 1));
  let validDateRange = true;

  if (goalType === 'checklist') {
    current = items.filter(item => item.done).length;
    target = items.length;
  }
  if (goalType === 'date') {
    validDateRange = startTime !== null && deadlineTime !== null && deadlineTime >= startTime;
    if (validDateRange && startTime !== null && deadlineTime !== null) {
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      current = Math.max(0, today - startTime);
      target = Math.max(1, deadlineTime - startTime);
    } else {
      current = 0;
      target = 1;
    }
  }

  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const unit = config.goalUnit?.trim() || (goalType === 'money' ? '฿' : goalType === 'date' ? 'days' : goalType === 'checklist' ? 'items' : config.goalCurrent === undefined && config.goal !== undefined ? '%' : 'items');
  return {
    type: goalType,
    style: goalStyle,
    displayName: displayName?.trim() || config.title?.trim() || DEFAULT_GOAL_DISPLAY_NAME,
    title: config.goalTitle?.trim() || DEFAULT_GOAL_TITLE,
    description: config.goalDescription?.trim() || config.description?.trim() || DEFAULT_GOAL_DESCRIPTION,
    icon: config.goalIcon?.trim() || '🎯',
    current,
    target,
    unit,
    items,
    percent,
    remaining: Math.max(0, target - current),
    deadline: config.goalDeadline?.trim() || '',
    startDate: config.goalStartDate?.trim() || '',
    validDateRange,
    showPercent: config.showPercent !== false,
    showFraction: config.showFraction !== false,
    showRemaining: config.showRemaining !== false
  };
}

export function getNotePresentation(config: CreatorWidgetConfig, displayName: string) {
  return {
    icon: config.icon?.trim() || DEFAULT_NOTE_ICON,
    kicker: config.noteKicker?.trim() || DEFAULT_NOTE_KICKER,
    badge: config.noteBadge?.trim() || DEFAULT_NOTE_BADGE,
    footerLeft: config.noteFooterLeft?.trim() || DEFAULT_NOTE_FOOTER_LEFT,
    footerRight: config.noteFooterRight?.trim() || displayName.trim() || 'Creator',
    text: config.text?.trim() || NOTE_FALLBACK_TEXT
  };
}

const cleanText = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() || fallback : fallback;

export function isSafeMusicUrl(value: string): boolean {
  if (!value.trim()) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function normalizeMusicTrack(track: unknown, index: number): MusicTrack {
  const value = track && typeof track === 'object' ? track as Record<string, unknown> : {};
  return {
    id: cleanText(value.id, `track-${index + 1}`),
    title: cleanText(value.title),
    artist: cleanText(value.artist),
    duration: cleanText(value.duration),
    url: cleanText(value.url)
  };
}

export function getMusicPresentation(config: CreatorWidgetConfig, displayName?: string) {
  const musicType: MusicType = MUSIC_TYPES.includes(config.musicType as MusicType) ? config.musicType as MusicType : 'playlist';
  const musicSource: MusicSource = MUSIC_SOURCES.includes(config.musicSource as MusicSource) ? config.musicSource as MusicSource : 'spotify';
  const musicStyle: MusicStyle = MUSIC_STYLES.includes(config.musicStyle as MusicStyle) ? config.musicStyle as MusicStyle : 'card';
  const tracks = Array.isArray(config.playlistTracks) ? config.playlistTracks.map(normalizeMusicTrack) : (config.musicType ? DEFAULT_MUSIC_TRACKS.map(normalizeMusicTrack) : []);
  const legacyUrl = config.musicUrl || config.links?.[0]?.url || '';
  const name = cleanText(displayName, cleanText(config.title, DEFAULT_MUSIC_DISPLAY_NAME));
  const playlistName = cleanText(config.playlistName, cleanText(config.musicTitle, cleanText(config.title, DEFAULT_MUSIC_PLAYLIST_NAME)));
  const songTitle = cleanText(config.musicTitle, cleanText(config.title, DEFAULT_MUSIC_TITLE));
  const artist = cleanText(config.musicArtist, DEFAULT_MUSIC_ARTIST);
  const caption = cleanText(config.musicCaption, cleanText(config.description, DEFAULT_MUSIC_CAPTION));
  const activeTrackIndex = musicType === 'playlist' && tracks.length > 0
    ? Math.min(Math.max(0, Number.isFinite(Number(config.activeTrackIndex)) ? Math.floor(Number(config.activeTrackIndex)) : 0), tracks.length - 1)
    : 0;
  const activeTrack = musicType === 'playlist' ? tracks[activeTrackIndex] : { id: 'single', title: songTitle, artist, duration: '', url: legacyUrl };
  return {
    type: musicType,
    source: musicSource,
    style: musicStyle,
    displayName: name,
    playlistName,
    title: songTitle,
    artist,
    caption,
    coverUrl: cleanText(config.musicCoverUrl),
    url: legacyUrl,
    tracks,
    activeTrackIndex,
    activeTrack,
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
  };
}

export function validateMusicConfig(config: CreatorWidgetConfig): Record<string, string> {
  const music = getMusicPresentation(config);
  const errors: Record<string, string> = {};
  if (!music.displayName) errors.displayName = 'กรุณาใส่ชื่อวิดเจ็ต';
  if (music.url && !isSafeMusicUrl(music.url)) errors.musicUrl = 'ใช้ลิงก์ HTTPS เท่านั้น';
  if (music.coverUrl && !isSafeMusicUrl(music.coverUrl)) errors.musicCoverUrl = 'ใช้ URL ภาพแบบ HTTPS เท่านั้น';
  if (music.type === 'single' && !music.title) errors.musicTitle = 'กรุณาใส่ชื่อเพลง';
  if (music.type === 'playlist') {
    music.tracks.forEach((track, index) => { if (!track.title) errors[`track-${index}`] = 'กรุณาใส่ชื่อเพลง'; });
  }
  return errors;
}

const galleryFocusToPosition: Record<GalleryFocusPoint, string> = {
  'top-left': 'left top', top: 'center top', 'top-right': 'right top', left: 'left center', center: 'center center', right: 'right center',
  'bottom-left': 'left bottom', bottom: 'center bottom', 'bottom-right': 'right bottom'
};

export function isSafeGallerySource(value: string): boolean {
  if (!value.trim()) return false;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function isSafeGalleryGifSource(value: string): boolean {
  if (!isSafeGallerySource(value)) return false;
  if (/^data:image\/gif;base64,/i.test(value)) return true;
  try { return new URL(value).pathname.toLowerCase().endsWith('.gif'); } catch { return false; }
}

export function normalizeGalleryItem(item: unknown, index: number): GalleryItem {
  const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const source = value.source === 'asset' || value.source === 'upload' || value.source === 'url' ? value.source : 'url';
  return {
    id: cleanText(value.id, `gallery-${index + 1}`),
    src: cleanText(value.src),
    alt: cleanText(value.alt),
    caption: cleanText(value.caption),
    source,
    assetId: cleanText(value.assetId),
    mimeType: cleanText(value.mimeType)
  };
}

export function getGalleryPresentation(config: CreatorWidgetConfig, displayName?: string, legacyItems: GalleryItem[] = []) {
  const type: GalleryType = GALLERY_TYPES.includes(config.galleryType as GalleryType) ? config.galleryType as GalleryType : 'collage';
  const template: GalleryTemplate = GALLERY_TEMPLATES.includes(config.galleryTemplate as GalleryTemplate) ? config.galleryTemplate as GalleryTemplate : 'magazine';
  const collageLayout: GalleryCollageLayout = GALLERY_COLLAGE_LAYOUTS.includes(config.galleryCollageLayout as GalleryCollageLayout) ? config.galleryCollageLayout as GalleryCollageLayout : 'three';
  const gap: GalleryGap = GALLERY_GAPS.includes(config.galleryGap as GalleryGap) ? config.galleryGap as GalleryGap : 8;
  const imageFit: GalleryImageFit = GALLERY_IMAGE_FITS.includes(config.galleryImageFit as GalleryImageFit) ? config.galleryImageFit as GalleryImageFit : 'cover';
  const focusPoint: GalleryFocusPoint = GALLERY_FOCUS_POINTS.includes(config.galleryFocusPoint as GalleryFocusPoint) ? config.galleryFocusPoint as GalleryFocusPoint : 'center';
  const hasGalleryItems = Array.isArray(config.galleryItems);
  const configuredItems = hasGalleryItems ? config.galleryItems!.map(normalizeGalleryItem) : [];
  const legacyImage = cleanText(config.imageUrl);
  const sourceItems = hasGalleryItems
    ? configuredItems
    : legacyImage
      ? [{ id: 'legacy-image', src: legacyImage, alt: cleanText(config.galleryTitle, DEFAULT_GALLERY_DISPLAY_NAME), source: 'url' as const }]
      : legacyItems;
  const seenIds = new Set<string>();
  const legacyLimit = !hasGalleryItems && Number.isFinite(Number(config.goal))
    ? Math.min(12, Math.max(1, Math.floor(Number(config.goal))))
    : 12;
  const items = sourceItems.filter(item => isSafeGallerySource(item.src)).filter(item => {
    const id = cleanText(item.id, `gallery-${seenIds.size + 1}`);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  }).slice(0, legacyLimit);
  const maxCollageItems = collageLayout === 'two' ? 2 : collageLayout === 'four' ? 4 : 3;
  const visibleItems = type === 'single' ? items.slice(0, 1) : type === 'collage' ? items.slice(0, maxCollageItems) : type === 'gif' && config.galleryGifUrl ? [{ id: 'gif-source', src: config.galleryGifUrl, alt: cleanText(config.galleryTitle, DEFAULT_GALLERY_DISPLAY_NAME), source: 'url' as const, mimeType: 'image/gif' }] : items;
  const title = cleanText(displayName, cleanText(config.galleryTitle, cleanText(config.title, DEFAULT_GALLERY_DISPLAY_NAME)));
  const caption = cleanText(config.galleryCaption, cleanText(config.description, title || DEFAULT_GALLERY_CAPTION));
  return {
    type,
    title,
    caption,
    items: visibleItems,
    allItems: items,
    template,
    collageLayout,
    gap,
    imageFit,
    outerRadius: Math.max(8, Math.min(32, Number(config.galleryOuterRadius) || 16)),
    innerRadius: Math.max(0, Math.min(24, Number(config.galleryInnerRadius) || 8)),
    focusPoint,
    focusPosition: galleryFocusToPosition[focusPoint],
    gifUrl: cleanText(config.galleryGifUrl),
    autoplay: config.galleryAutoplay !== false,
    loop: config.galleryLoop !== false,
    pauseOnHover: Boolean(config.galleryPauseOnHover),
    showCaption: config.galleryShowCaption !== false,
    showCounter: config.galleryShowCounter !== false,
    showSourceLabel: Boolean(config.galleryShowSourceLabel)
  };
}

export function validateGalleryConfig(config: CreatorWidgetConfig): Record<string, string> {
  const gallery = getGalleryPresentation(config);
  const errors: Record<string, string> = {};
  if (!gallery.title.trim()) errors.galleryTitle = 'กรุณาใส่ชื่อแกลเลอรี';
  if (gallery.type === 'gif') {
    const hasGifItem = gallery.items.some(item => isSafeGalleryGifSource(item.src) || item.mimeType?.toLowerCase() === 'image/gif');
    if (!gallery.gifUrl && !hasGifItem) errors.galleryGifUrl = 'กรุณาเพิ่ม GIF URL หรือไฟล์ GIF';
    if (gallery.gifUrl && !isSafeGalleryGifSource(gallery.gifUrl)) errors.galleryGifUrl = 'ใช้ URL HTTPS หรือไฟล์ GIF ที่ถูกต้อง';
  } else if (gallery.items.length === 0) {
    errors.galleryItems = 'กรุณาเพิ่มภาพอย่างน้อย 1 ภาพ';
  }
  if (gallery.type === 'collage') {
    const required = gallery.collageLayout === 'two' ? 2 : gallery.collageLayout === 'four' ? 4 : 3;
    if (gallery.items.length < required) errors.galleryLayout = `Collage แบบนี้ต้องการ ${required} ภาพ`;
  }
  (config.galleryItems || []).forEach((item, index) => {
    if (!item.src) errors[`gallery-item-${index}`] = 'ภาพนี้ยังไม่มีแหล่งที่มา';
    else if (!isSafeGallerySource(item.src)) errors[`gallery-item-${index}`] = 'URL ภาพต้องเป็น HTTPS หรือ data URL ของรูปภาพ';
  });
  return errors;
}

const decorationChoice = <T>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const decorationNumber = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

export function isSafeDecorationImage(value: string): boolean {
  if (!value.trim()) return false;
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);
}

export function getDecorationPresentation(config: CreatorWidgetConfig, displayName?: string) {
  const hasExplicitType = DECORATION_TYPES.includes(config.decorationType as DecorationType);
  const type = decorationChoice(config.decorationType, DECORATION_TYPES, hasExplicitType ? 'sticker' : config.text?.trim() ? 'text' : 'sticker');
  const name = cleanText(displayName, cleanText(config.title, DEFAULT_DECORATION_DISPLAY_NAME));
  return {
    type,
    displayName: name,
    stickerIcon: decorationChoice(config.decorationStickerIcon, DECORATION_STICKER_ICONS, 'sparkles'),
    stickerUrl: isSafeDecorationImage(cleanText(config.decorationStickerUrl)) ? cleanText(config.decorationStickerUrl) : '',
    size: decorationNumber(config.decorationSize, 64, 32, 120),
    rotation: decorationNumber(config.decorationRotation, -8, -30, 30),
    align: decorationChoice(config.decorationAlign, DECORATION_ALIGNS, 'center'),
    opacity: decorationNumber(config.decorationOpacity, 90, 20, 100),
    text: cleanText(config.decorationText, cleanText(config.text, DEFAULT_DECORATION_TEXT)),
    textStyle: decorationChoice(config.decorationTextStyle, DECORATION_TEXT_STYLES, 'serif'),
    textSize: decorationChoice(config.decorationTextSize, DECORATION_TEXT_SIZES, 'medium'),
    pattern: decorationChoice(config.decorationPattern, DECORATION_PATTERNS, 'fluid'),
    density: decorationChoice(config.decorationDensity, DECORATION_DENSITIES, 'medium'),
    scale: decorationNumber(config.decorationScale, 100, 60, 160),
    dividerStyle: decorationChoice(config.decorationDividerStyle, DECORATION_DIVIDER_STYLES, 'tape'),
    dividerText: cleanText(config.decorationDividerText, DEFAULT_DECORATION_DIVIDER_TEXT),
    dividerWidth: decorationChoice(config.decorationDividerWidth, DECORATION_DIVIDER_WIDTHS, 100),
    dividerThickness: decorationChoice(config.decorationDividerThickness, DECORATION_DIVIDER_THICKNESSES, 'medium'),
    animation: decorationChoice(config.decorationAnimation, DECORATION_ANIMATIONS, 'drift'),
    animationSpeed: decorationChoice(config.decorationAnimationSpeed, DECORATION_ANIMATION_SPEEDS, 'normal'),
    loop: config.decorationLoop !== false,
    pauseOnHover: Boolean(config.decorationPauseOnHover),
    isLegacyText: !hasExplicitType && Boolean(config.text?.trim())
  };
}

export function validateDecorationConfig(config: CreatorWidgetConfig, displayName?: string): Record<string, string> {
  const decoration = getDecorationPresentation(config, displayName);
  const errors: Record<string, string> = {};
  if (!decoration.displayName.trim()) errors.displayName = 'กรุณาใส่ชื่อ Decoration';
  if (decoration.type === 'text' && !cleanText(config.decorationText, cleanText(config.text))) errors.decorationText = 'กรุณาใส่ข้อความตกแต่ง';
  if (config.decorationStickerUrl && !isSafeDecorationImage(config.decorationStickerUrl)) errors.decorationStickerUrl = 'รองรับเฉพาะไฟล์ PNG, JPG, WebP หรือ GIF ที่อัปโหลดในเครื่อง';
  return errors;
}

const calendarChoice = <T,>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const calendarClean = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() || fallback : fallback;

/** Parse a strict calendar date without accepting JavaScript's rollover dates. */
export function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeCalendarEvent(event: unknown, index: number): CalendarEvent {
  const value = event && typeof event === 'object' ? event as Record<string, unknown> : {};
  const color = CALENDAR_EVENT_COLORS.includes(value.color as CalendarEventColor) ? value.color as CalendarEventColor : 'pink';
  return {
    id: calendarClean(value.id, `calendar-event-${index + 1}`),
    date: typeof value.date === 'string' ? value.date.trim() : '',
    title: typeof value.title === 'string' ? value.title.trim() : '',
    time: calendarClean(value.time),
    icon: calendarClean(value.icon),
    color
  };
}

/**
 * Return a non-mutating, storage-safe Calendar config while retaining unknown
 * legacy fields for compatibility. Presentation still supplies demo events
 * when the owner has not configured an explicit event list.
 */
export function normalizeCalendarConfig(config: CreatorWidgetConfig = {}): CreatorWidgetConfig {
  const normalized: CreatorWidgetConfig = { ...config };
  normalized.calendarView = calendarChoice(config.calendarView, CALENDAR_VIEWS, 'month');
  normalized.calendarStartWeek = calendarChoice(config.calendarStartWeek, CALENDAR_START_WEEKS, 'monday');
  normalized.calendarTodayStyle = calendarChoice(config.calendarTodayStyle, CALENDAR_TODAY_STYLES, 'circle');
  normalized.calendarEventMode = calendarChoice(config.calendarEventMode, CALENDAR_EVENT_MODES, 'dot');
  normalized.calendarMaxEventsPerDay = calendarChoice(config.calendarMaxEventsPerDay, CALENDAR_MAX_EVENTS, 2);
  normalized.calendarCaption = calendarClean(config.calendarCaption, calendarClean(config.description, DEFAULT_CALENDAR_CAPTION));
  normalized.calendarShowMonthYear = config.calendarShowMonthYear !== false;
  normalized.calendarShowToday = config.calendarShowToday !== false;
  normalized.calendarShowWeekends = config.calendarShowWeekends !== false;
  normalized.calendarShowWeekNumbers = Boolean(config.calendarShowWeekNumbers);
  normalized.calendarShowEvents = config.calendarShowEvents !== false;
  normalized.calendarShowUpcoming = config.calendarShowUpcoming !== false;
  normalized.calendarShowCaption = config.calendarShowCaption !== false;
  normalized.calendarSource = 'manual';
  if (Array.isArray(config.calendarEvents)) normalized.calendarEvents = config.calendarEvents.map(normalizeCalendarEvent).slice(0, 50);
  else delete normalized.calendarEvents;
  return normalized;
}

export interface CalendarGridCell {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  weekNumber: number;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(date.getTime());
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Returns a stable 6-row month grid (42 cells), including adjacent-month days. */
export function getCalendarMonthGrid(monthDate: Date, startWeek: CalendarStartWeek = 'monday', today = new Date()): CalendarGridCell[] {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const offset = startWeek === 'monday' ? (first.getUTCDay() + 6) % 7 : first.getUTCDay();
  const todayKey = formatCalendarDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index - offset + 1));
    return { date: formatCalendarDate(date), day: date.getUTCDate(), inCurrentMonth: date.getUTCMonth() === month, isToday: formatCalendarDate(date) === todayKey, weekNumber: isoWeekNumber(date) };
  });
}

function calendarMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function getCalendarPresentation(config: CreatorWidgetConfig, displayName?: string, now = new Date(), visibleMonth = now) {
  const normalized = normalizeCalendarConfig(config);
  const view = normalized.calendarView!;
  const startWeek = normalized.calendarStartWeek!;
  const todayStyle = normalized.calendarTodayStyle!;
  const eventMode = normalized.calendarEventMode!;
  const maxEventsPerDay = normalized.calendarMaxEventsPerDay!;
  const hasExplicitEvents = Array.isArray(normalized.calendarEvents);
  const fallbackEvents = DEFAULT_CALENDAR_EVENTS.map((event, index) => ({ ...event, date: `${visibleMonth.getUTCFullYear()}-${String(visibleMonth.getUTCMonth() + 1).padStart(2, '0')}-${String([6, 14, 24][index] || 6).padStart(2, '0')}` }));
  const events = (hasExplicitEvents ? normalized.calendarEvents! : fallbackEvents).map(normalizeCalendarEvent).slice(0, 50);
  const validEvents = events.filter(event => parseCalendarDate(event.date) && event.title);
  const eventMap = validEvents.reduce<Record<string, CalendarEvent[]>>((map, event) => { (map[event.date] ||= []).push(event); return map; }, {});
  const safeDisplayName = calendarClean(displayName, calendarClean(normalized.title, DEFAULT_CALENDAR_DISPLAY_NAME));
  const caption = normalized.calendarCaption || DEFAULT_CALENDAR_CAPTION;
  const month = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 1));
  const grid = getCalendarMonthGrid(month, startWeek, now);
  const upcoming = validEvents.filter(event => event.date >= formatCalendarDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)).slice(0, 6);
  const weekdayLabels = startWeek === 'monday' ? ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'] : ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return {
    displayName: safeDisplayName,
    title: safeDisplayName,
    caption,
    view,
    startWeek,
    todayStyle,
    eventMode,
    maxEventsPerDay,
    events,
    validEvents,
    eventMap,
    grid,
    month,
    monthLabel: calendarMonthLabel(month),
    weekdayLabels,
    upcoming,
    currentMonthKey: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`,
    showMonthYear: normalized.calendarShowMonthYear !== false,
    showToday: normalized.calendarShowToday !== false,
    showWeekends: normalized.calendarShowWeekends !== false,
    showWeekNumbers: Boolean(normalized.calendarShowWeekNumbers),
    showEvents: normalized.calendarShowEvents !== false,
    showUpcoming: normalized.calendarShowUpcoming !== false,
    showCaption: normalized.calendarShowCaption !== false,
    source: 'manual' as const,
    legacyEvents: !hasExplicitEvents,
    today: now
  };
}

export function validateCalendarConfig(config: CreatorWidgetConfig, displayName?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = displayName !== undefined ? displayName : config.title;
  if (!calendarClean(title)) errors.displayName = 'กรุณาใส่ชื่อปฏิทิน';
  if (config.calendarCaption !== undefined && !calendarClean(config.calendarCaption)) errors.calendarCaption = 'กรุณาใส่คำบรรยาย';
  (config.calendarEvents || []).forEach((event, index) => {
    const normalized = normalizeCalendarEvent(event, index);
    if (!parseCalendarDate(normalized.date)) errors[`calendar-event-${index}-date`] = 'วันที่ต้องเป็น YYYY-MM-DD ที่ถูกต้อง';
    if (!normalized.title) errors[`calendar-event-${index}-title`] = 'กรุณาใส่ชื่อ event';
    if (normalized.time && normalized.time.length > 32) errors[`calendar-event-${index}-time`] = 'เวลา/ข้อความสั้นเกินไป';
  });
  return errors;
}

const folderChoice = <T,>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const folderClean = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() || fallback : fallback;
const uniqueFolderIds = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map(id => id.trim())))
  : [];

export interface FolderItemPreview {
  id: string;
  title: string;
  description: string;
  icon: string;
  asset: Asset;
}

export interface FolderCardPreview {
  id: string;
  name: string;
  icon: string;
  description: string;
  count: number;
  publicCount: number;
  items: FolderItemPreview[];
}

export interface FolderPresentation {
  displayName: string;
  title: string;
  subtitle: string;
  icon: string;
  style: FolderStyle;
  folders: FolderCardPreview[];
  selectedFolderIds: string[];
  publicFolderIds: string[];
  showItemCount: boolean;
  showPreviewItems: boolean;
  showDescription: boolean;
  showItemIcons: boolean;
  totalItems: number;
  isPublic: boolean;
  hasPublicSelection: boolean;
}

/** Normalize Folder-only fields while retaining all unknown legacy config keys. */
export function normalizeFolderConfig(config: CreatorWidgetConfig = {}): CreatorWidgetConfig {
  const normalized: CreatorWidgetConfig = { ...config };
  normalized.folderStyle = folderChoice(config.folderStyle, FOLDER_STYLES, DEFAULT_FOLDER_STYLE);
  normalized.folderTitle = folderClean(config.folderTitle, folderClean(config.title, DEFAULT_FOLDER_TITLE));
  normalized.folderSubtitle = folderClean(config.folderSubtitle, folderClean(config.description, DEFAULT_FOLDER_SUBTITLE));
  normalized.folderIcon = folderClean(config.folderIcon, folderClean(config.icon, DEFAULT_FOLDER_ICON));
  if (Array.isArray(config.folderOrder)) normalized.folderOrder = uniqueFolderIds(config.folderOrder);
  if (Array.isArray(config.folderPublicIds)) normalized.folderPublicIds = uniqueFolderIds(config.folderPublicIds);
  normalized.folderShowItemCount = config.folderShowItemCount !== undefined ? Boolean(config.folderShowItemCount) : config.showCount !== false;
  normalized.folderShowPreviewItems = config.folderShowPreviewItems !== false;
  normalized.folderShowDescription = config.folderShowDescription !== false;
  normalized.folderShowItemIcons = config.folderShowItemIcons !== false;
  return normalized;
}

function folderAssetItems(folder: Folder, assets: Asset[], publicOnly: boolean): FolderItemPreview[] {
  return assets
    .filter(asset => asset.folderId === folder.id && !asset.deletedAt && (!publicOnly || isPublicFeedVisibility(asset)))
    .slice(0, FOLDER_MAX_PREVIEW_ITEMS)
    .map(asset => ({
      id: asset.id,
      title: asset.title,
      description: asset.shortDescription || asset.contentTypeLabels?.join(' · ') || '',
      icon: asset.icon?.value || 'file',
      asset
    }));
}

export function getFolderItems(folder: Folder, assets: Asset[], publicOnly = false): FolderItemPreview[] {
  return folderAssetItems(folder, assets, publicOnly);
}

export function getFolderPresentation(config: CreatorWidgetConfig, folders: Folder[], assets: Asset[], displayName?: string, publicOnly = false): FolderPresentation {
  const normalized = normalizeFolderConfig(config);
  const availableIds = folders.map(folder => folder.id);
  const configuredOrder = Array.isArray(normalized.folderOrder) && normalized.folderOrder.length > 0
    ? normalized.folderOrder
    : availableIds;
  const selectedFolderIds = configuredOrder.filter(id => availableIds.includes(id)).slice(0, FOLDER_MAX_VISIBLE);
  const publicFolderIds = uniqueFolderIds(normalized.folderPublicIds).filter(id => selectedFolderIds.includes(id));
  const visibleIds = publicOnly ? selectedFolderIds.filter(id => publicFolderIds.includes(id)) : selectedFolderIds;
  const sourceAssets = publicOnly ? assets.filter(isPublicFeedVisibility) : assets;
  const cards = visibleIds.map(id => {
    const folder = folders.find(candidate => candidate.id === id);
    if (!folder) return null;
    const folderAssets = sourceAssets.filter(asset => asset.folderId === folder.id && !asset.deletedAt);
    const items = folderAssetItems(folder, sourceAssets, publicOnly);
    return {
      id: folder.id,
      name: folder.name,
      icon: folder.icon || normalized.folderIcon || DEFAULT_FOLDER_ICON,
      description: folderAssets[0]?.shortDescription || '',
      count: folderAssets.length,
      publicCount: assets.filter(asset => asset.folderId === folder.id && !asset.deletedAt && isPublicFeedVisibility(asset)).length,
      items
    } satisfies FolderCardPreview;
  }).filter((folder): folder is FolderCardPreview => Boolean(folder && (!publicOnly || folder.publicCount > 0)));
  return {
    displayName: folderClean(displayName, folderClean(normalized.title, DEFAULT_FOLDER_DISPLAY_NAME)),
    title: normalized.folderTitle || DEFAULT_FOLDER_TITLE,
    subtitle: normalized.folderSubtitle || DEFAULT_FOLDER_SUBTITLE,
    icon: normalized.folderIcon || DEFAULT_FOLDER_ICON,
    style: normalized.folderStyle || DEFAULT_FOLDER_STYLE,
    folders: cards,
    selectedFolderIds,
    publicFolderIds,
    showItemCount: normalized.folderShowItemCount !== false,
    showPreviewItems: normalized.folderShowPreviewItems !== false,
    showDescription: normalized.folderShowDescription !== false,
    showItemIcons: normalized.folderShowItemIcons !== false,
    totalItems: cards.reduce((sum, folder) => sum + folder.count, 0),
    isPublic: publicOnly,
    hasPublicSelection: publicFolderIds.length > 0
  };
}

export function getPublicFolderPresentation(config: CreatorWidgetConfig, folders: Folder[], assets: Asset[], displayName?: string): FolderPresentation {
  return getFolderPresentation(config, folders, assets, displayName, true);
}

export function validateFolderConfig(config: CreatorWidgetConfig, displayName?: string, availableFolderIds: string[] = []): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = folderClean(displayName !== undefined ? displayName : config.title);
  const folderTitle = folderClean(config.folderTitle, folderClean(config.title, DEFAULT_FOLDER_TITLE));
  const subtitle = folderClean(config.folderSubtitle, folderClean(config.description, DEFAULT_FOLDER_SUBTITLE));
  if (!title) errors.displayName = 'กรุณาใส่ชื่อ Folder';
  if (title.length > 48) errors.displayName = 'ชื่อ Folder ยาวเกิน 48 ตัวอักษร';
  if (!folderTitle) errors.folderTitle = 'กรุณาใส่ชื่อโฟลเดอร์หลัก';
  if (folderTitle.length > 64) errors.folderTitle = 'ชื่อโฟลเดอร์ยาวเกิน 64 ตัวอักษร';
  if (subtitle.length > 120) errors.folderSubtitle = 'คำอธิบายยาวเกิน 120 ตัวอักษร';
  const order = uniqueFolderIds(config.folderOrder);
  const publicIds = uniqueFolderIds(config.folderPublicIds);
  if (availableFolderIds.length) {
    if (order.some(id => !availableFolderIds.includes(id))) errors.folderOrder = 'มีโฟลเดอร์ที่ไม่พบในโปรไฟล์';
    if (publicIds.some(id => !order.includes(id))) errors.folderPublicIds = 'โฟลเดอร์ public ต้องอยู่ในรายการที่เลือกแสดง';
  }
  return errors;
}

/** Non-Note widgets may still tune content density without changing theme. */
export function getWidgetRenderSize(span: number): WidgetRenderSize {
  if (span <= 3) return 'S';
  if (span <= 6) return 'M';
  return 'L';
}
