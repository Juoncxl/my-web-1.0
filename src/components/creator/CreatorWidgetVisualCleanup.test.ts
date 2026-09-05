import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const creatorSource = readFileSync(new URL('../../pages/CreatorSpacePage.tsx', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('./CreatorWidgetRenderer.tsx', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('./creatorWidgetModel.ts', import.meta.url), 'utf8');
const customizeSource = readFileSync(new URL('./CreatorCustomizePanel.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./CreatorWidgetEditor.tsx', import.meta.url), 'utf8');
const noteEditorSource = readFileSync(new URL('./CreatorNoteEditorModal.tsx', import.meta.url), 'utf8');
const goalEditorSource = readFileSync(new URL('./CreatorGoalEditorModal.tsx', import.meta.url), 'utf8');
const galleryEditorSource = readFileSync(new URL('./CreatorGalleryEditorModal.tsx', import.meta.url), 'utf8');
const decorationEditorSource = readFileSync(new URL('./CreatorDecorationEditorModal.tsx', import.meta.url), 'utf8');
const clockEditorSource = readFileSync(new URL('./CreatorClockEditorModal.tsx', import.meta.url), 'utf8');
const weatherEditorSource = readFileSync(new URL('./CreatorWeatherEditorModal.tsx', import.meta.url), 'utf8');
const calendarEditorSource = readFileSync(new URL('./CreatorCalendarEditorModal.tsx', import.meta.url), 'utf8');
const folderEditorSource = readFileSync(new URL('./CreatorFolderEditorModal.tsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('./CreatorCompactItemControls.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('Creator Widget UI visual contracts', () => {
  it('keeps one WidgetCard frame and every existing widget renderer', () => {
    expect(creatorSource).toContain('const WidgetCard: React.FC<WidgetCardProps>');
    expect(creatorSource).toContain('<CreatorWidgetControls');
    expect(creatorSource).toContain('<CreatorWidgetRenderer');
    for (const widgetType of ['folder', 'playlist', 'todo', 'status', 'note', 'links', 'goal', 'gallery', 'clock', 'weather', 'calendar', 'single_image', 'decoration']) {
      expect(rendererSource).toContain(`${widgetType}:`);
    }
  });

  it('uses a dedicated Folder renderer/editor with explicit public selection', () => {
    expect(rendererSource).toContain('function FolderWidget');
    expect(rendererSource).toContain('getPublicFolderPresentation');
    expect(rendererSource).toContain('SUNSET COASTAL • FOLDER');
    expect(folderEditorSource).toContain('CreatorFolderEditorModal');
    expect(folderEditorSource).toContain('folderPublicIds');
    expect(folderEditorSource).toContain('folderOrder');
    expect(folderEditorSource).toContain('acquireViewportScrollLock');
    expect(folderEditorSource).toContain('aria-modal="true"');
    expect(folderEditorSource).toContain("event.key === 'Escape'");
    expect(folderEditorSource).not.toContain('Embed URL');
    expect(creatorSource).toContain("type === 'folder' ? 'is-folder-widget-shell'");
    expect(creatorSource).toContain("editingWidget.type) && <CreatorWidgetEditor");
    expect(creatorSource).toContain('saveEditingFolder');
    expect(styles).toContain('.csp-folder-surface');
    expect(styles).toContain('.csp-folder-editor-modal');
  });

  it('preserves Customize Mode, layout choices, placement and Add Item categories', () => {
    expect(customizeSource).toContain('CUSTOMIZE MODE');
    expect(customizeSource).toContain('Free Layout');
    expect(creatorSource).toContain('gridColumn: `${placement.x + 1} / span ${placement.w}`');
    expect(creatorSource).toContain('gridRow: `${placement.y + 1} / span ${placement.h}`');
    expect(creatorSource).toContain('writePersistedCreatorSpaceSettings');
    expect(creatorSource).toContain('readPersistedCreatorSpaceSettings');
    expect(creatorSource).toContain('canAddFreePlacement');
    for (const category of ['Portfolio', 'Widget', 'Work', 'Folder']) expect(creatorSource).toContain(`>${category}</button>`);
    expect(styles).toMatch(/\.csp-add-item-dialog\s*\{/);
  });

  it('keeps the original editor route for widgets other than dedicated editors', () => {
    expect(controlsSource).toContain('ความกว้าง');
    expect(editorSource).toContain('ชื่อแสดง Widget');
    expect(editorSource).toContain("type === 'gallery'");
    expect(creatorSource).toContain("!['note', 'goal', 'playlist', 'gallery', 'decoration', 'clock', 'weather'].includes(editingWidget.type)");
  });

  it('uses one fixed Note renderer rather than S/M/L or theme branches', () => {
    expect(rendererSource).toContain('function NoteWidget');
    expect(rendererSource).toContain("props.type === 'note' || props.type === 'playlist' || props.type === 'gallery' || props.type === 'decoration' || props.type === 'clock' || props.type === 'weather' ? 'fixed' : size");
    expect(rendererSource).not.toMatch(/Note[ SML]Renderer|NoteSRenderer|NoteMRenderer|NoteLRenderer/);
    expect(modelSource).not.toContain('CreatorWidgetTheme');
    expect(modelSource).not.toContain('getNoteVariant');
    expect(creatorSource).not.toContain('data-widget-theme');
    expect(styles).not.toContain('data-widget-theme');
    expect(styles).toContain('.csp-note-surface');
    expect(styles).toContain('@container (max-width: 17rem)');
  });

  it('limits the dedicated Note editor to the seven confirmed values', () => {
    for (const field of ['draftTitle', 'text:', 'icon:', 'noteKicker:', 'noteBadge:', 'noteFooterLeft:', 'noteFooterRight:']) expect(noteEditorSource).toContain(field);
    for (const removedControl of ['Theme', 'Accent', 'Note Style', 'Alignment', 'Font Size', 'noteTags', 'noteDetails', 'NOTE_ACCENT_OPTIONS']) expect(noteEditorSource).not.toContain(removedControl);
    expect(noteEditorSource).toContain('maxLength={30}');
    expect(noteEditorSource).toContain('maxLength={280}');
    expect(noteEditorSource).toContain('maxLength={42}');
    expect(noteEditorSource).toContain('maxLength={28}');
    expect(noteEditorSource.match(/maxLength=\{48\}/g)).toHaveLength(2);
  });

  it('keeps draft preview, discard and atomic save paths explicit', () => {
    expect(noteEditorSource).toContain('const [draftConfig');
    expect(noteEditorSource).toContain('config={draftConfig}');
    expect(noteEditorSource).toContain('onSave(draftConfig, draftTitle.trim()');
    expect(noteEditorSource).toContain("event.key === 'Escape'");
    expect(noteEditorSource).toContain('acquireViewportScrollLock');
    expect(noteEditorSource).toContain('aria-modal="true"');
    expect(creatorSource).toContain('const saveEditingNote');
    expect(creatorSource).toContain('updateFreeWidgetInstance(previous, editingWidget.instanceId!, config as Record<string, unknown>, displayName)');
    expect(creatorSource).toContain('onCancel={() => setEditingWidget(null)}');
  });

  it('gives Goal its own studio renderer and editor while preserving Gallery', () => {
    expect(rendererSource).toContain('function GoalWidget');
    expect(rendererSource).toContain('function GoalProgressVisual');
    expect(rendererSource).toContain('onEditGoal?: () => void');
    expect(goalEditorSource).toContain('CreatorGoalEditorModal');
    expect(goalEditorSource).toContain("GOAL_TYPES");
    expect(goalEditorSource).toContain("GOAL_STYLES");
    expect(goalEditorSource).toContain('goalItems');
    expect(goalEditorSource).toContain('goalStartDate');
    expect(goalEditorSource).toContain('goalDeadline');
    expect(goalEditorSource).toContain('aria-modal="true"');
    expect(creatorSource).toContain('const saveEditingGoal');
    expect(creatorSource).toContain('<CreatorGoalEditorModal');
    expect(creatorSource).toContain("type === 'goal' ? 'is-goal-widget-shell'");
    expect(styles).toContain('.csp-goal-surface');
    expect(styles).toContain('.csp-goal-editor-modal');
    expect(modelSource).toContain("export type GoalType = 'number' | 'money' | 'checklist' | 'date'");
    expect(modelSource).toContain("export type GoalStyle = 'bar' | 'ring' | 'counter' | 'cute'");
    expect(rendererSource).toContain('<GalleryWidget {...props} size={size} onEditGallery={props.onEditGallery} />');
    expect(styles).not.toContain('.csp-goal-widget[data-widget-theme');
    expect(styles).not.toContain('.csp-gallery-widget[data-widget-theme');
    expect(creatorSource).toContain('renderPortfolio');
    expect(creatorSource).toContain('<AssetCard asset={asset}');
  });

  it('gives Playlist its own renderer and editor without bringing Embed controls back', () => {
    const musicEditorSource = readFileSync(new URL('./CreatorMusicEditorModal.tsx', import.meta.url), 'utf8');
    expect(rendererSource).toContain('function MusicWidget');
    expect(rendererSource).toContain('onEditMusic?: () => void');
    expect(musicEditorSource).toContain('CreatorMusicEditorModal');
    expect(musicEditorSource).toContain('MUSIC_TYPES');
    expect(musicEditorSource).toContain('MUSIC_STYLES');
    expect(musicEditorSource).toContain('playlistTracks');
    expect(musicEditorSource).toContain('acquireViewportScrollLock');
    expect(creatorSource).toContain('const saveEditingMusic');
    expect(creatorSource).toContain('<CreatorMusicEditorModal');
    expect(styles).toContain('.csp-music-surface');
    expect(styles).toContain('.csp-music-editor-modal');
    expect(musicEditorSource).not.toContain('คัดลอกโค้ด Embed');
  });

  it('gives Gallery its own Romantic Mist renderer and editor without Embed controls', () => {
    expect(rendererSource).toContain('function GalleryWidget');
    expect(rendererSource).toContain('onEditGallery?: () => void');
    expect(galleryEditorSource).toContain('CreatorGalleryEditorModal');
    expect(galleryEditorSource).toContain('GALLERY_TYPES');
    expect(galleryEditorSource).toContain('GALLERY_TEMPLATES');
    expect(galleryEditorSource).toContain('galleryCollageLayout');
    expect(galleryEditorSource).toContain('galleryFocusPoint');
    expect(galleryEditorSource).toContain('FileReader');
    expect(galleryEditorSource).toContain('acquireViewportScrollLock');
    expect(galleryEditorSource).toContain('aria-modal="true"');
    expect(creatorSource).toContain('const saveEditingGallery');
    expect(creatorSource).toContain('<CreatorGalleryEditorModal');
    expect(creatorSource).toContain("type === 'gallery' ? 'is-gallery-widget-shell'");
    expect(styles).toContain('.csp-gallery-surface');
    expect(styles).toContain('.csp-gallery-editor-modal');
    expect(galleryEditorSource).not.toContain('คัดลอกโค้ด Embed');
  });

  it('gives Decoration its own transparent Bioluminescent renderer and Lilac editor', () => {
    expect(rendererSource).toContain('function DecorationWidget');
    expect(rendererSource).toContain('onEditDecoration?: () => void');
    expect(rendererSource).toContain('csp-decoration-surface');
    expect(decorationEditorSource).toContain('CreatorDecorationEditorModal');
    expect(decorationEditorSource).toContain('DECORATION_TYPES');
    expect(decorationEditorSource).toContain('FileReader');
    expect(decorationEditorSource).toContain('acquireViewportScrollLock');
    expect(decorationEditorSource).toContain('aria-modal="true"');
    expect(decorationEditorSource).toContain('showDiscardPrompt');
    expect(creatorSource).toContain('const saveEditingDecoration');
    expect(creatorSource).toContain('<CreatorDecorationEditorModal');
    expect(creatorSource).toContain("type === 'decoration' ? 'is-decoration-widget-shell'");
    expect(styles).toContain('.csp-decoration-surface');
    expect(styles).toContain('.csp-decoration-editor-modal');
    expect(styles).toContain("bioluminescent-pattern-atlas.png");
    expect(decorationEditorSource).not.toContain('Embed Code');
  });

  it('gives Clock its own live renderer and Dreamy Pastel editor without Embed controls', () => {
    expect(rendererSource).toContain('function ClockWidget');
    expect(rendererSource).toContain('onEditClock?: () => void');
    expect(rendererSource).toContain('csp-clock-surface');
    expect(clockEditorSource).toContain('CreatorClockEditorModal');
    expect(clockEditorSource).toContain('CLOCK_STYLES');
    expect(clockEditorSource).toContain('clockCities');
    expect(clockEditorSource).toContain('clockGreetings');
    expect(clockEditorSource).toContain('acquireViewportScrollLock');
    expect(clockEditorSource).toContain('aria-modal="true"');
    expect(clockEditorSource).toContain('showDiscardPrompt');
    expect(clockEditorSource).not.toContain('Embed Code');
    expect(creatorSource).toContain('const saveEditingClock');
    expect(creatorSource).toContain('<CreatorClockEditorModal');
    expect(creatorSource).toContain("type === 'clock' ? 'is-clock-widget-shell'");
    expect(styles).toContain('.csp-clock-surface');
    expect(styles).toContain('.csp-clock-editor-modal');
  });

  it('gives Weather a dedicated Retro Pixel renderer and inspector without live/API or Embed claims', () => {
    expect(rendererSource).toContain('function WeatherWidget');
    expect(rendererSource).toContain('onEditWeather?: () => void');
    expect(rendererSource).toContain('ข้อมูลที่ตั้งค่าไว้');
    expect(weatherEditorSource).toContain('CreatorWeatherEditorModal');
    expect(weatherEditorSource).toContain('WEATHER_CONDITIONS');
    expect(weatherEditorSource).toContain('weatherForecast');
    expect(weatherEditorSource).toContain('acquireViewportScrollLock');
    expect(weatherEditorSource).toContain('aria-modal="true"');
    expect(weatherEditorSource).not.toContain('Embed URL');
    expect(weatherEditorSource).not.toContain('navigator.geolocation');
    expect(creatorSource).toContain('const saveEditingWeather');
    expect(creatorSource).toContain('<CreatorWeatherEditorModal');
    expect(creatorSource).toContain("type === 'weather' ? 'is-weather-widget-body'");
    expect(styles).toContain('.csp-weather-surface');
    expect(styles).toContain('.csp-weather-editor-modal');
  });

  it('gives Calendar a dedicated Cherry Blossom renderer and inspector without Embed/API controls', () => {
    expect(rendererSource).toContain('function CalendarWidget');
    expect(rendererSource).toContain('onEditCalendar?: () => void');
    expect(rendererSource).toContain('getCalendarPresentation');
    expect(rendererSource).toContain('calendar.view === \'upcoming\'');
    expect(calendarEditorSource).toContain('CreatorCalendarEditorModal');
    expect(calendarEditorSource).toContain('CALENDAR_VIEWS');
    expect(calendarEditorSource).toContain('CALENDAR_TODAY_STYLES');
    expect(calendarEditorSource).toContain('calendarEvents');
    expect(calendarEditorSource).toContain('validateCalendarConfig');
    expect(calendarEditorSource).toContain('acquireViewportScrollLock');
    expect(calendarEditorSource).toContain('aria-modal="true"');
    expect(calendarEditorSource).toContain('event.key === \'Escape\'');
    expect(calendarEditorSource).not.toContain('Embed URL');
    expect(calendarEditorSource).not.toContain('Google Calendar');
    expect(creatorSource).toContain('const saveEditingCalendar');
    expect(creatorSource).toContain('<CreatorCalendarEditorModal');
    expect(creatorSource).toContain("type === 'calendar' ? 'is-calendar-widget-shell'");
    expect(creatorSource).toContain("!['note', 'goal', 'playlist', 'todo', 'gallery', 'decoration', 'clock', 'weather', 'calendar'].includes(editingWidget.type)");
    expect(styles).toContain('.csp-calendar-surface');
    expect(styles).toContain('.csp-calendar-editor-modal');
    expect(modelSource).toContain("export type CalendarView = 'mini' | 'month' | 'week' | 'upcoming'");
    expect(modelSource).toContain('getCalendarMonthGrid');
    expect(modelSource).toContain('validateCalendarConfig');
  });
});
