import type { Asset, Folder, User } from '../types';

const STORAGE_KEY = 'cxl_creator_space_qa_sandbox_v1';

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

function readState(): CreatorSandboxState {
  if (typeof window === 'undefined') return memoryState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryState;
    const parsed = JSON.parse(raw) as Partial<CreatorSandboxState>;
    memoryState = {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      removedAssetIds: Array.isArray(parsed.removedAssetIds) ? parsed.removedAssetIds : [],
      removedFolderIds: Array.isArray(parsed.removedFolderIds) ? parsed.removedFolderIds : [],
      profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
      bookmarks: parsed.bookmarks && typeof parsed.bookmarks === 'object' ? parsed.bookmarks : {},
      likes: parsed.likes && typeof parsed.likes === 'object' ? parsed.likes : {}
    };
  } catch {
    // Keep the in-memory state if storage is unavailable or corrupted.
  }
  return memoryState;
}

function writeState(next: CreatorSandboxState): void {
  memoryState = next;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('creator-vault-qa-data-changed'));
    window.dispatchEvent(new Event('creator-vault-cloud-data-changed'));
  } catch (error) {
    console.warn('[creatorPersistence] local sandbox write failed', error);
  }
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

export function writeMockProfile(user: User): void {
  const state = readState();
  writeState({ ...state, profiles: { ...state.profiles, [user.id]: user } });
}

export function readCreatorSpaceSettings(userId: string): CreatorSpaceSettings | null {
  return readState().settings[userId] || null;
}

export function writeCreatorSpaceSettings(userId: string, settings: CreatorSpaceSettings): void {
  const state = readState();
  writeState({ ...state, settings: { ...state.settings, [userId]: settings } });
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
  writeState(emptyState());
}
