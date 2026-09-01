import type { Asset, Folder, User } from '../types';

const STORAGE_KEY = 'cxl_creator_space_qa_sandbox_v1';
const PROFILE_STORAGE_KEY = 'cxl_creator_space_qa_profiles_v1';

export interface MockProfileWriteResult {
  success: boolean;
  storage: 'localStorage' | 'sessionStorage' | null;
  error: string | null;
}

export interface CreatorSpaceSettings {
  layout?: 'locked' | 'free';
  lockedPreset?: 'left' | 'right' | 'split';
  widgets?: string[];
  widgetRail?: Record<string, 'left' | 'right'>;
  spans?: Record<string, number>;
  freeOrder?: string[];
  widgetTitles?: Record<string, string>;
  widgetConfigs?: Record<string, Record<string, unknown>>;
}

interface CreatorSandboxState {
  assets: Asset[];
  folders: Folder[];
  removedAssetIds: string[];
  removedFolderIds: string[];
  profiles: Record<string, User>;
  settings: Record<string, CreatorSpaceSettings>;
  bookmarks: Record<string, string[]>;
  likes: Record<string, string[]>;
}

const emptyState = (): CreatorSandboxState => ({
  assets: [],
  folders: [],
  removedAssetIds: [],
  removedFolderIds: [],
  profiles: {},
  settings: {},
  bookmarks: {},
  likes: {}
});

let memoryState = emptyState();
let cachedSandboxRaw: string | null | undefined;
let cachedLocalProfilesRaw: string | null | undefined;
let cachedSessionProfilesRaw: string | null | undefined;
let cachedLocalProfiles: Record<string, User> = {};
let cachedSessionProfiles: Record<string, User> = {};

function parseStoredProfiles(raw: string | null): Record<string, User> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, User> : {};
  } catch {
    return {};
  }
}

function readProfilesFrom(storage: Storage | undefined, kind: 'localStorage' | 'sessionStorage'): Record<string, User> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (kind === 'localStorage') {
      if (raw !== cachedLocalProfilesRaw) {
        cachedLocalProfilesRaw = raw;
        cachedLocalProfiles = parseStoredProfiles(raw);
      }
      return cachedLocalProfiles;
    }
    if (raw !== cachedSessionProfilesRaw) {
      cachedSessionProfilesRaw = raw;
      cachedSessionProfiles = parseStoredProfiles(raw);
    }
    return cachedSessionProfiles;
  } catch {
    return {};
  }
}

function getBrowserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

function readStoredProfiles(): Record<string, User> {
  if (typeof window === 'undefined') return {};
  const localProfiles = readProfilesFrom(getBrowserStorage('localStorage'), 'localStorage');
  const sessionProfiles = readProfilesFrom(getBrowserStorage('sessionStorage'), 'sessionStorage');
  // A session fallback represents the newest accepted write when localStorage
  // was unavailable, so it intentionally wins for the lifetime of this tab.
  return { ...localProfiles, ...sessionProfiles };
}

function notifyQaDataListeners(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event('creator-vault-qa-data-changed'));
  } catch (error) {
    // Notification failure must not turn an already-persisted Profile save
    // into a false failure. Auth/Profile state updates still render instantly.
    console.warn('[creatorPersistence] QA data notification failed', error);
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return /quota/i.test(String(error));
  const record = error as Record<string, unknown>;
  return record.name === 'QuotaExceededError' || record.code === 22 || record.code === 1014 || /quota/i.test(String(record.message || ''));
}

function readState(): CreatorSandboxState {
  if (typeof window === 'undefined') return memoryState;
  const storedProfiles = readStoredProfiles();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedSandboxRaw = raw;
      memoryState = { ...memoryState, profiles: { ...memoryState.profiles, ...storedProfiles } };
      return memoryState;
    }
    if (raw === cachedSandboxRaw) {
      memoryState = { ...memoryState, profiles: { ...memoryState.profiles, ...storedProfiles } };
      return memoryState;
    }
    const parsed = JSON.parse(raw) as Partial<CreatorSandboxState>;
    cachedSandboxRaw = raw;
    memoryState = {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      removedAssetIds: Array.isArray(parsed.removedAssetIds) ? parsed.removedAssetIds : [],
      removedFolderIds: Array.isArray(parsed.removedFolderIds) ? parsed.removedFolderIds : [],
      profiles: {
        ...(parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {}),
        ...storedProfiles
      },
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
      bookmarks: parsed.bookmarks && typeof parsed.bookmarks === 'object' ? parsed.bookmarks : {},
      likes: parsed.likes && typeof parsed.likes === 'object' ? parsed.likes : {}
    };
  } catch {
    // Keep the in-memory state if storage is unavailable or corrupted.
  }
  return memoryState;
}

function writeState(next: CreatorSandboxState, notifyDataListeners = true): boolean {
  if (typeof window === 'undefined') {
    memoryState = next;
    return true;
  }
  try {
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedSandboxRaw = serialized;
    memoryState = next;
  } catch (error) {
    console.warn('[creatorPersistence] local sandbox write failed', error);
    return false;
  }
  if (notifyDataListeners) notifyQaDataListeners();
  return true;
}

export function readMockAssets(userId?: string): Asset[] {
  const assets = readState().assets;
  return userId ? assets.filter(asset => asset.userId === userId) : assets;
}

export function writeMockAsset(asset: Asset): void {
  const state = readState();
  const index = state.assets.findIndex(item => item.id === asset.id);
  const assets = [...state.assets];
  if (index >= 0) assets[index] = asset;
  else assets.unshift(asset);
  writeState({ ...state, assets, removedAssetIds: state.removedAssetIds.filter(id => id !== asset.id) });
}

export function removeMockAsset(id: string, userId: string): boolean {
  const state = readState();
  writeState({ ...state, assets: state.assets.filter(asset => asset.id !== id), removedAssetIds: [...new Set([...state.removedAssetIds, id])] });
  return true;
}

export function isMockAssetRemoved(id: string): boolean { return readState().removedAssetIds.includes(id); }

export function readMockFolders(userId?: string): Folder[] {
  const folders = readState().folders;
  return userId ? folders.filter(folder => folder.userId === userId) : folders;
}

export function writeMockFolder(folder: Folder): void {
  const state = readState();
  const index = state.folders.findIndex(item => item.id === folder.id);
  const folders = [...state.folders];
  if (index >= 0) folders[index] = folder;
  else folders.push(folder);
  writeState({ ...state, folders, removedFolderIds: state.removedFolderIds.filter(id => id !== folder.id) });
}

export function removeMockFolder(id: string, userId: string): boolean {
  const state = readState();
  writeState({ ...state, folders: state.folders.filter(folder => folder.id !== id), removedFolderIds: [...new Set([...state.removedFolderIds, id])] });
  return true;
}

export function isMockFolderRemoved(id: string): boolean { return readState().removedFolderIds.includes(id); }

export function readMockProfile(userId: string, fallback: User | null): User | null {
  return readState().profiles[userId] || fallback;
}

export function readMockProfiles(): User[] {
  return Object.values(readState().profiles);
}

export function writeMockProfile(user: User): MockProfileWriteResult {
  const state = readState();
  const profiles = { ...state.profiles, [user.id]: user };
  let serialized = '';
  try {
    serialized = JSON.stringify(profiles);
  } catch (error) {
    console.warn('[creatorPersistence] QA Profile serialization failed', error);
    return {
      success: false,
      storage: null,
      error: 'ข้อมูลโปรไฟล์ไม่สามารถบันทึกใน QA Sandbox ได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่'
    };
  }

  let localError: unknown;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
  } catch (error) {
    localError = error;
  }

  if (!localError) {
    try { window.sessionStorage?.removeItem(PROFILE_STORAGE_KEY); } catch { /* stale fallback cannot override this tab after memory update */ }
    cachedLocalProfilesRaw = serialized;
    cachedLocalProfiles = profiles;
    cachedSessionProfilesRaw = null;
    cachedSessionProfiles = {};
    memoryState = { ...state, profiles };
    notifyQaDataListeners();
    return { success: true, storage: 'localStorage', error: null };
  }

  let sessionError: unknown;
  try {
    window.sessionStorage.setItem(PROFILE_STORAGE_KEY, serialized);
  } catch (error) {
    sessionError = error;
  }

  if (!sessionError) {
    cachedSessionProfilesRaw = serialized;
    cachedSessionProfiles = profiles;
    memoryState = { ...state, profiles };
    console.warn('[creatorPersistence] QA Profile is using the same-tab session fallback because localStorage was unavailable', localError);
    notifyQaDataListeners();
    return { success: true, storage: 'sessionStorage', error: null };
  }

  console.warn('[creatorPersistence] QA Profile persistence failed', { localError, sessionError });
  return {
    success: false,
    storage: null,
    error: isQuotaError(localError) || isQuotaError(sessionError)
      ? 'พื้นที่จัดเก็บของเบราว์เซอร์ไม่เพียงพอสำหรับบันทึกโปรไฟล์ QA กรุณาลดขนาดรูปภาพแล้วลองใหม่'
      : 'บันทึกโปรไฟล์ใน QA Sandbox ไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้ใช้พื้นที่จัดเก็บภายในเครื่อง'
  };
}

/**
 * Retains the first verified cloud Profile as a last-known browser snapshot.
 * An explicitly saved QA Profile always wins and this read-through cache does
 * not emit mutation events, so a read cannot create a refresh loop.
 */
export function cacheMockProfileSnapshot(user: User): boolean {
  const state = readState();
  if (!user.id || state.profiles[user.id]) return false;
  const profiles = { ...state.profiles, [user.id]: user };
  let serialized: string;
  try {
    serialized = JSON.stringify(profiles);
  } catch {
    return false;
  }

  if (typeof window === 'undefined') {
    memoryState = { ...state, profiles };
    return true;
  }

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
    cachedLocalProfilesRaw = serialized;
    cachedLocalProfiles = profiles;
    memoryState = { ...state, profiles };
    return true;
  } catch {
    try {
      window.sessionStorage?.setItem(PROFILE_STORAGE_KEY, serialized);
      cachedSessionProfilesRaw = serialized;
      cachedSessionProfiles = profiles;
      memoryState = { ...state, profiles };
      return true;
    } catch {
      return false;
    }
  }
}

/** Writes Profile metadata without notifying data listeners during image migration. */
export function replaceMockProfileSnapshot(user: User): boolean {
  if (typeof window === 'undefined') return false;
  const state = readState();
  if (!user.id) return false;
  const profiles = { ...state.profiles, [user.id]: user };
  let serialized: string;
  try {
    serialized = JSON.stringify(profiles);
  } catch {
    return false;
  }

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
    try { window.sessionStorage?.removeItem(PROFILE_STORAGE_KEY); } catch { /* no-op */ }
    cachedLocalProfilesRaw = serialized;
    cachedLocalProfiles = profiles;
    cachedSessionProfilesRaw = null;
    cachedSessionProfiles = {};
    memoryState = { ...state, profiles };
    return true;
  } catch {
    try {
      window.sessionStorage?.setItem(PROFILE_STORAGE_KEY, serialized);
      cachedSessionProfilesRaw = serialized;
      cachedSessionProfiles = profiles;
      memoryState = { ...state, profiles };
      return true;
    } catch {
      return false;
    }
  }
}

export function readCreatorSpaceSettings(userId: string): CreatorSpaceSettings | null {
  return readState().settings[userId] || null;
}

export function writeCreatorSpaceSettings(userId: string, settings: CreatorSpaceSettings): void {
  const state = readState();
  // Layout/widget settings are local presentation state. They must not notify
  // asset/profile data listeners: doing so creates a settings -> profile
  // refresh -> rerender -> settings feedback loop on the Profile route.
  writeState({ ...state, settings: { ...state.settings, [userId]: settings } }, false);
}

export function readMockBookmarks(userId: string): string[] {
  return readState().bookmarks[userId] || [];
}

export function writeMockBookmarks(userId: string, assetIds: string[]): void {
  const state = readState();
  writeState({ ...state, bookmarks: { ...state.bookmarks, [userId]: [...new Set(assetIds)] } });
}

export function readMockLikes(userId: string): string[] {
  return readState().likes[userId] || [];
}

export function writeMockLikes(userId: string, assetIds: string[]): void {
  const state = readState();
  writeState({ ...state, likes: { ...state.likes, [userId]: [...new Set(assetIds)] } });
}

export function resetCreatorSandbox(): void {
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { /* memory reset still applies */ }
    try { window.sessionStorage?.removeItem(PROFILE_STORAGE_KEY); } catch { /* memory reset still applies */ }
  }
  cachedSandboxRaw = undefined;
  cachedLocalProfilesRaw = undefined;
  cachedSessionProfilesRaw = undefined;
  cachedLocalProfiles = {};
  cachedSessionProfiles = {};
  writeState(emptyState());
}
