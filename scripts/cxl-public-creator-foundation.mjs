#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_CREATOR_SCHEMA_VERSION = 1;
export const CREATOR_SETTINGS_VERSION = 1;
export const SOCIAL_LINKS_SOURCE_STATUS = 'UNRECOVERED FROM CURRENT LOCAL BACKUPS';

const WIDGET_TYPES = new Set([
  'folder', 'playlist', 'todo', 'status', 'note', 'links', 'goal', 'gallery', 'clock',
  'weather', 'calendar', 'single_image', 'decoration'
]);
const TOP_LEVEL_FIELDS = new Set([
  'layout', 'lockedPreset', 'widgets', 'widgetRail', 'spans', 'freeOrder', 'freePlacements',
  'portfolioDisplayLimit', 'widgetTitles', 'widgetConfigs', 'widgetInstances'
]);
const CONFIG_FIELDS = {
  status: ['status', 'description'],
  note: ['title', 'text', 'icon', 'noteKicker', 'noteBadge', 'noteFooterLeft', 'noteFooterRight'],
  links: ['description', 'links'],
  goal: ['goal', 'goalType', 'goalStyle', 'goalTitle', 'goalDescription', 'goalIcon', 'goalCurrent', 'goalTarget', 'goalUnit', 'goalItems', 'goalStartDate', 'goalDeadline', 'showPercent', 'showFraction', 'showRemaining'],
  todo: ['todoListTitle', 'todoTasks', 'todoCategories', 'todoListStyle', 'todoCheckboxStyle', 'todoCompletedBehavior', 'todoProgressMode', 'todoShowPriority', 'todoResetSchedule', 'todoLastResetAt', 'todoTransparentBackground'],
  playlist: ['musicType', 'musicSource', 'musicUrl', 'musicCoverUrl', 'musicTitle', 'musicArtist', 'musicCaption', 'playlistName', 'playlistTracks', 'activeTrackIndex', 'musicStyle', 'showCover', 'showTitle', 'showArtist', 'showProgress', 'showControls', 'showDuration', 'showTrackList', 'showTrackNumbers', 'showTrackDuration', 'autoplay', 'loop', 'startMuted'],
  gallery: ['galleryType', 'galleryTitle', 'galleryCaption', 'galleryTemplate', 'galleryCollageLayout', 'galleryGap', 'galleryImageFit', 'galleryOuterRadius', 'galleryInnerRadius', 'galleryFocusPoint', 'galleryAutoplay', 'galleryLoop', 'galleryPauseOnHover', 'galleryShowCaption', 'galleryShowCounter', 'galleryShowSourceLabel'],
  decoration: ['decorationType', 'decorationStickerIcon', 'decorationSize', 'decorationRotation', 'decorationAlign', 'decorationOpacity', 'decorationText', 'decorationTextStyle', 'decorationTextSize', 'decorationPattern', 'decorationDensity', 'decorationScale', 'decorationDividerStyle', 'decorationDividerText', 'decorationDividerWidth', 'decorationDividerThickness', 'decorationAnimation', 'decorationAnimationSpeed', 'decorationLoop', 'decorationPauseOnHover'],
  clock: ['clockMode', 'clockStyle', 'clockTimeZoneMode', 'clockTimeZone', 'clockCities', 'clockTimeFormat', 'clockDateFormat', 'clockShowTime', 'clockShowSeconds', 'clockShowDate', 'clockShowCity', 'clockShowTimeZone', 'clockShowGreeting', 'clockGreetings', 'clockTextAlign', 'clockTimeSize', 'clockDialMarker', 'clockHandStyle', 'clockFlipAnimation', 'clockFlipSound'],
  weather: ['weatherLocation', 'weatherTimeZone', 'weatherUnit', 'weatherCondition', 'weatherDayNightMode', 'weatherCurrentCelsius', 'weatherFeelsLikeCelsius', 'weatherHighCelsius', 'weatherLowCelsius', 'weatherHumidity', 'weatherWindKph', 'weatherPrecipitation', 'weatherMessage', 'weatherMessageMode', 'weatherShowCondition', 'weatherShowFeelsLike', 'weatherShowHumidity', 'weatherShowWind', 'weatherShowPrecipitation', 'weatherShowMessage', 'weatherShowForecast', 'weatherForecast'],
  calendar: ['calendarView', 'calendarStartWeek', 'calendarTodayStyle', 'calendarCaption', 'calendarEvents', 'calendarEventMode', 'calendarMaxEventsPerDay', 'calendarShowMonthYear', 'calendarShowToday', 'calendarShowWeekends', 'calendarShowWeekNumbers', 'calendarShowEvents', 'calendarShowUpcoming', 'calendarShowCaption', 'calendarSource'],
  folder: ['folderTitle', 'folderSubtitle', 'folderIcon', 'folderStyle', 'folderShowItemCount', 'folderShowPreviewItems', 'folderShowDescription', 'folderShowItemIcons']
};
const IMAGE_OR_MEDIA_FIELDS = new Set(['musicUrl', 'musicCoverUrl', 'imageUrl', 'galleryGifUrl', 'decorationStickerUrl']);
const SAFE_SLUG = /^[a-z0-9][a-z0-9_.-]{2,31}$/;
const SAFE_ID = /^[A-Za-z0-9:_-]{1,128}$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined;
}

function safePublicUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /^data:/i.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function compactObject(source, fields) {
  if (!isRecord(source)) return undefined;
  const output = {};
  for (const field of fields) {
    if (!Object.hasOwn(source, field)) continue;
    const value = source[field];
    if (typeof value === 'string') {
      if (IMAGE_OR_MEDIA_FIELDS.has(field)) {
        const url = safePublicUrl(value);
        if (url) output[field] = url;
      } else if (!/^data:/i.test(value)) {
        output[field] = cleanText(value, field.toLowerCase().includes('text') ? 4000 : 1000);
      }
    } else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      output[field] = value;
    }
  }
  return Object.keys(output).length ? output : undefined;
}

function safeItems(value, fields, limit = 100) {
  if (!Array.isArray(value)) return undefined;
  const items = value.slice(0, limit).map(item => compactObject(item, fields)).filter(Boolean);
  return items.length ? items : [];
}

function sanitizeWidgetConfig(type, raw) {
  if (!isRecord(raw) || !WIDGET_TYPES.has(type) || raw.visibility === 'private') return undefined;
  const config = compactObject(raw, CONFIG_FIELDS[type] || []) || {};

  if (type === 'links') {
    config.links = safeItems(raw.links, ['label', 'url'], 20)?.map(link => ({
      label: cleanText(link.label, 120) || '',
      url: safePublicUrl(link.url)
    })).filter(link => link.url) || [];
  }
  if (type === 'todo') {
    if (Object.hasOwn(raw, 'todoTasks')) config.todoTasks = safeItems(raw.todoTasks, ['label', 'done', 'categoryId', 'priority', 'time', 'status'], 100) || [];
    if (Object.hasOwn(raw, 'todoCategories')) config.todoCategories = safeItems(raw.todoCategories, ['label', 'color'], 12) || [];
  }
  if (type === 'goal' && Object.hasOwn(raw, 'goalItems')) config.goalItems = safeItems(raw.goalItems, ['label', 'done'], 50) || [];
  if (type === 'playlist' && Object.hasOwn(raw, 'playlistTracks')) {
    config.playlistTracks = safeItems(raw.playlistTracks, ['title', 'artist', 'duration', 'url'], 50)?.map(track => ({
      ...track,
      ...(track.url ? { url: safePublicUrl(track.url) } : {})
    })).filter(track => !track.url || safePublicUrl(track.url)) || [];
  }
  if (type === 'clock' && Object.hasOwn(raw, 'clockCities')) {
    config.clockCities = safeItems(raw.clockCities, ['name', 'timeZone'], 4) || [];
  }
  if (type === 'clock' && isRecord(raw.clockGreetings)) {
    config.clockGreetings = compactObject(raw.clockGreetings, ['morning', 'afternoon', 'evening', 'night']) || {};
  }
  if (type === 'weather' && Object.hasOwn(raw, 'weatherForecast')) {
    config.weatherForecast = safeItems(raw.weatherForecast, ['date', 'condition', 'highCelsius', 'lowCelsius'], 5) || [];
  }
  if (type === 'calendar' && Object.hasOwn(raw, 'calendarEvents')) {
    config.calendarEvents = safeItems(raw.calendarEvents, ['date', 'title', 'label'], 100) || [];
  }
  // Gallery items and folder references contain media/folder IDs. Those reads
  // are outside this offline foundation and are intentionally not projected.
  return Object.keys(config).length ? config : undefined;
}

function sanitizePlacement(item, publicWorkIds) {
  if (!isRecord(item) || !['widget', 'portfolio', 'work'].includes(item.kind)) return null;
  if (!Number.isInteger(item.x) || !Number.isInteger(item.y) || !Number.isInteger(item.w) || !Number.isInteger(item.h)) return null;
  if (item.x < 0 || item.x > 11 || item.y < 0 || item.y > 239 || item.w < 1 || item.w > 12 || item.h < 1 || item.h > 8) return null;
  if (item.kind === 'work' && !publicWorkIds.has(item.refId)) return null;
  if (item.kind === 'folder') return null;
  if (typeof item.refId !== 'string' || !SAFE_ID.test(item.refId)) return null;
  const placement = { id: `${item.kind}:${item.refId}`, kind: item.kind, refId: item.refId, x: item.x, y: item.y, w: item.w, h: item.h };
  if (item.heightMode === 'auto') placement.heightMode = 'auto';
  return placement;
}

/** Returns null for missing settings so the existing Creator Space defaults apply. */
export function sanitizeCreatorSettings(raw, { publicWorkIds = new Set() } = {}) {
  if (!isRecord(raw)) return null;
  const result = {};
  if (raw.layout === 'locked' || raw.layout === 'free') result.layout = raw.layout;
  if (['left', 'right', 'split'].includes(raw.lockedPreset)) result.lockedPreset = raw.lockedPreset;
  if ([3, 6, 9, 12, 'all'].includes(raw.portfolioDisplayLimit)) result.portfolioDisplayLimit = raw.portfolioDisplayLimit;

  const widgets = Array.isArray(raw.widgets) ? raw.widgets.filter(type => WIDGET_TYPES.has(type)) : [];
  if (Array.isArray(raw.widgets)) result.widgets = [...new Set(widgets)];

  const placements = Array.isArray(raw.freePlacements)
    ? raw.freePlacements.map(item => sanitizePlacement(item, publicWorkIds)).filter(Boolean)
    : [];
  if (Array.isArray(raw.freePlacements)) result.freePlacements = placements;
  const placementIds = new Set(placements.map(item => item.id));
  for (const field of ['widgets', 'widgetRail', 'spans', 'widgetTitles']) {
    if (!isRecord(raw[field])) continue;
    const target = {};
    for (const [key, value] of Object.entries(raw[field])) {
      const keyIsPublicWidget = WIDGET_TYPES.has(key) || (field !== 'widgets' && placementIds.has(key));
      if (!keyIsPublicWidget || key === 'folder') continue;
      if (field === 'widgetRail' && ['left', 'right'].includes(value)) target[key] = value;
      else if (field === 'spans' && Number.isFinite(value) && value >= 1 && value <= 12) target[key] = Math.trunc(value);
      else if (field === 'widgetTitles' && typeof value === 'string') target[key] = cleanText(value, 120);
    }
    if (Object.keys(target).length) result[field] = target;
  }
  if (Array.isArray(raw.freeOrder)) {
    result.freeOrder = [...new Set(raw.freeOrder.filter(id => typeof id === 'string' && placementIds.has(id)))];
  }
  if (isRecord(raw.widgetConfigs)) {
    const configs = {};
    for (const [type, value] of Object.entries(raw.widgetConfigs)) {
      const safe = sanitizeWidgetConfig(type, value);
      if (safe) configs[type] = safe;
    }
    if (Object.keys(configs).length) result.widgetConfigs = configs;
  }
  if (Array.isArray(raw.widgetInstances)) {
    result.widgetInstances = raw.widgetInstances.slice(0, 100).flatMap(instance => {
      if (!isRecord(instance) || !SAFE_ID.test(instance.id || '') || !WIDGET_TYPES.has(instance.widgetType)) return [];
      const config = sanitizeWidgetConfig(instance.widgetType, instance.config);
      return [{ id: instance.id, widgetType: instance.widgetType,
        ...(typeof instance.title === 'string' ? { title: cleanText(instance.title, 120) } : {}),
        ...(config ? { config } : {}) }];
    });
  }

  // schemaVersion is metadata for this projection; unknown input fields never pass through.
  return { settingsVersion: CREATOR_SETTINGS_VERSION, ...result };
}

function normalizeSlug(value) {
  if (typeof value !== 'string') return null;
  const slug = value.trim().replace(/^@+/, '').toLowerCase();
  return SAFE_SLUG.test(slug) ? slug : null;
}

function sanitizeProfile(profile, publicCreatorId) {
  const slug = normalizeSlug(profile.username);
  if (!slug) return null;
  const avatarValue = typeof profile.avatar_url === 'string' ? profile.avatar_url : '';
  const coverValue = typeof profile.cover_url === 'string' ? profile.cover_url : '';
  return {
    publicCreatorId,
    slug,
    displayName: cleanText(profile.display_name, 160) || 'Creator',
    bio: cleanText(profile.bio, 4000) || '',
    avatarRef: /^data:/i.test(avatarValue) ? null : safePublicUrl(avatarValue),
    coverRef: /^data:/i.test(coverValue) ? null : safePublicUrl(coverValue),
    // null means the source is unrecovered; it must not be interpreted as an
    // authoritative empty social-link collection.
    visibleSocialLinksJson: null,
    settingsRef: `creator-settings:${publicCreatorId}`,
    active: true,
    updatedAt: typeof profile.updated_at === 'string' ? profile.updated_at : '',
    schemaVersion: PUBLIC_CREATOR_SCHEMA_VERSION
  };
}

export function buildCandidates({ profiles, settingsRows, works, privateMapping }) {
  const profileById = new Map();
  for (const profile of profiles) {
    if (!profile?.id || profileById.has(profile.id)) throw new Error('Duplicate or missing profile primary key in snapshot');
    profileById.set(profile.id, profile);
  }
  const workIds = new Set();
  const ownerIds = new Set();
  const publicWorkIds = new Set();
  const workOwners = new Map();
  const publicWorks = [];
  for (const work of works) {
    if (!work.id || workIds.has(work.id)) throw new Error('Duplicate or missing Work primary key in snapshot');
    workIds.add(work.id);
    ownerIds.add(work.user_id);
    workOwners.set(work.id, work.user_id);
    const active = !work.deleted_at || work.deleted_at === 'null';
    const isPublic = String(work.is_public).toLowerCase() === 'true' && work.visibility === 'public' && active;
    if (isPublic) {
      publicWorkIds.add(work.id);
      publicWorks.push({ workId: work.id, internalProfileId: work.user_id });
    }
  }

  const mappingEntries = new Map();
  const usedPublicIds = new Set();
  for (const entry of privateMapping) {
    if (!entry?.internalProfileId || !/^cxlc_[a-f0-9]{32}$/i.test(entry.publicCreatorId || '')) {
      throw new Error('Private mapping contains an invalid entry');
    }
    if (mappingEntries.has(entry.internalProfileId)) throw new Error('Duplicate internal profile key in private mapping');
    mappingEntries.set(entry.internalProfileId, entry.publicCreatorId);
    const publicId = entry.publicCreatorId;
    if (usedPublicIds.has(publicId)) throw new Error('Duplicate publicCreatorId in private mapping');
    usedPublicIds.add(publicId);
  }
  const newMappings = [];
  const skippedProfiles = [];
  const creatorProfileIds = new Set();
  for (const profile of profiles) {
    if (!normalizeSlug(profile.username) && !ownerIds.has(profile.id)) {
      skippedProfiles.push({ reason: 'non-addressable: missing valid username/slug; no Works' });
    }
  }
  for (const ownerId of ownerIds) {
    const profile = profileById.get(ownerId);
    if (!profile) throw new Error('Work owner does not match a profile in the verified snapshot');
    const slug = normalizeSlug(profile.username);
    if (!slug) {
      skippedProfiles.push({ reason: 'non-addressable: missing valid username/slug' });
      continue;
    }
    creatorProfileIds.add(ownerId);
    if (!mappingEntries.has(ownerId)) {
      let publicCreatorId;
      do { publicCreatorId = `cxlc_${randomUUID().replaceAll('-', '')}`; } while (usedPublicIds.has(publicCreatorId));
      mappingEntries.set(ownerId, publicCreatorId);
      usedPublicIds.add(publicCreatorId);
      newMappings.push({ internalProfileId: ownerId, publicCreatorId });
    }
  }

  const privateMap = new Map([...mappingEntries].map(([internalProfileId, publicCreatorId]) => [internalProfileId, publicCreatorId]));
  const publicCreatorIndex = [];
  for (const internalProfileId of creatorProfileIds) {
    const row = sanitizeProfile(profileById.get(internalProfileId), privateMap.get(internalProfileId));
    if (row) publicCreatorIndex.push(row);
  }
  const slugSet = new Set();
  for (const row of publicCreatorIndex) {
    if (slugSet.has(row.slug)) throw new Error('Duplicate public creator slug in snapshot');
    slugSet.add(row.slug);
  }

  const settingsByProfile = new Map();
  for (const row of settingsRows) {
    if (!row.profile_id || settingsByProfile.has(row.profile_id)) throw new Error('Duplicate or missing Creator Settings profile key');
    settingsByProfile.set(row.profile_id, row);
  }
  const publicSettings = [];
  let settingsUnmatched = 0;
  for (const [internalProfileId, publicCreatorId] of privateMap) {
    if (!creatorProfileIds.has(internalProfileId)) continue;
    const row = settingsByProfile.get(internalProfileId);
    if (!row) continue;
    publicSettings.push({ publicCreatorId, settings: sanitizeCreatorSettings(row.settings, { publicWorkIds }) });
  }
  for (const internalProfileId of settingsByProfile.keys()) {
    if (!privateMap.has(internalProfileId)) settingsUnmatched++;
  }

  const publicWorkMap = publicWorks.map(work => {
    const publicCreatorId = privateMap.get(work.internalProfileId);
    if (!publicCreatorId) throw new Error('Active public Work owner has no addressable publicCreatorId');
    return { schemaVersion: 1, workId: work.workId, publicCreatorId };
  });
  const allWorksMapped = [...workOwners.values()].filter(ownerId => privateMap.has(ownerId)).length;
  const activePublicWorks = publicWorkMap.length;
  const dataUriAvatarCount = [...creatorProfileIds].filter(id => /^data:/i.test(profileById.get(id)?.avatar_url || '')).length;

  return {
    privateMapping: {
      mappingVersion: 1,
      entries: [...privateMap].map(([internalProfileId, publicCreatorId]) => ({ internalProfileId, publicCreatorId }))
    },
    public: { publicCreatorIndex, publicSettings, publicWorkMap },
    report: {
      reportVersion: 1,
      snapshotLabel: 'supabase-full-backup-2026-09-25',
      creatorsMapped: publicCreatorIndex.length,
      profilesWithWorks: ownerIds.size,
      skippedNonAddressableProfiles: skippedProfiles.length,
      skippedProfileReasons: skippedProfiles.map(item => item.reason),
      worksTotal: works.length,
      worksMapped: allWorksMapped,
      activePublicWorks: activePublicWorks,
      activePublicWorksMapped: activePublicWorks,
      settingsRows: settingsRows.length,
      settingsMapped: publicSettings.length,
      settingsUnmatched,
      socialLinksSourceStatus: SOCIAL_LINKS_SOURCE_STATUS,
      visibleSocialLinksRecovered: false,
      avatarDataUriReferencesRemoved: dataUriAvatarCount,
      duplicateProfileIds: 0,
      duplicateWorkIds: 0,
      duplicateSlugs: 0,
      orphanWorks: 0,
      publicCandidateContainsInternalIds: false
    },
    newMappings
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  if (rows.length < 2) throw new Error('Work CSV snapshot is empty');
  const [headers, ...data] = rows;
  return data.filter(cells => cells.some(Boolean)).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

async function readJsonl(file) {
  const text = await readFile(file, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, file);
}

function assertPublicOutputSafe(value, internalIds) {
  const forbiddenKey = /^(?:profile_?id|internalprofileid|user_?id|owner_?id|drive(file)?id)$/i;
  const visit = current => {
    if (Array.isArray(current)) { current.forEach(visit); return; }
    if (!isRecord(current)) {
      if (typeof current === 'string') {
        if (/^data:/i.test(current)) throw new Error('Public candidate contains a data URI');
        if (internalIds.has(current)) throw new Error('Public candidate contains an internal profile ID');
      }
      return;
    }
    for (const [key, child] of Object.entries(current)) {
      if (forbiddenKey.test(key)) throw new Error('Public candidate contains an internal identifier field');
      visit(child);
    }
  };
  visit(value);
}

export async function runFoundationDryRun({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../output'), outputDir } = {}) {
  const snapshotDir = path.join(root, 'supabase-full-backup-2026-09-25', 'database');
  const assetExport = path.join(root, 'cxl-gas-bridge-2026-09-25', 'backup', 'assets-original.csv');
  const manifestPath = path.join(root, 'cxl-assets-recovery-2026-09-25', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const assetCsv = await readFile(assetExport, 'utf8');
  const assetHash = createHash('sha256').update(assetCsv).digest('hex');
  if (manifest.source_sha256 !== assetHash) throw new Error('Work CSV does not match the verified recovery manifest');
  const [profiles, settingsRows] = await Promise.all([
    readJsonl(path.join(snapshotDir, 'public.profiles.jsonl')),
    readJsonl(path.join(snapshotDir, 'public.creator_space_settings.jsonl'))
  ]);
  const works = parseCsv(assetCsv);
  if (manifest.asset_count !== works.length) throw new Error('Work CSV row count does not match the recovery manifest');

  const destination = outputDir || path.join(root, 'cxl-public-creator-foundation-dry-run');
  const privateMappingPath = path.join(destination, 'private', 'internal-profile-map.json');
  let previousMapping = { mappingVersion: 1, entries: [] };
  try { previousMapping = JSON.parse(await readFile(privateMappingPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previousMapping.mappingVersion !== 1 || !Array.isArray(previousMapping.entries)) throw new Error('Private mapping artifact version is unsupported');
  const candidates = buildCandidates({ profiles, settingsRows, works, privateMapping: previousMapping.entries });
  const internalIds = new Set(profiles.map(profile => profile.id));
  assertPublicOutputSafe(candidates.public, internalIds);

  const publicDirectory = path.join(destination, 'public-candidates');
  await mkdir(publicDirectory, { recursive: true });
  await writeJson(privateMappingPath, candidates.privateMapping);
  await writeJson(path.join(publicDirectory, 'PublicCreatorIndex.json'), candidates.public.publicCreatorIndex);
  await writeJson(path.join(publicDirectory, 'CreatorSettings.json'), candidates.public.publicSettings);
  await writeJson(path.join(publicDirectory, 'WorkCreatorMap.json'), candidates.public.publicWorkMap);
  await writeJson(path.join(publicDirectory, 'validation-report.json'), candidates.report);
  return { outputDirectory: destination, report: candidates.report, publicCreatorIds: candidates.public.publicCreatorIndex.map(profile => profile.publicCreatorId) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runFoundationDryRun();
    console.log(JSON.stringify({ outputDirectory: result.outputDirectory, ...result.report }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Public creator dry-run failed');
    process.exitCode = 1;
  }
}
