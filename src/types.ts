export type AssetCategory =
  | 'character'
  | 'lore'
  | 'ui_code'
  | 'prompts'
  | 'collab'
  | 'app_data';

export type AssetVisibility = 'public' | 'private' | 'draft';

export type AssetStatus = 'idea' | 'draft' | 'in_progress' | 'finished' | 'archived';

export interface CategoryMeta {
  id: AssetCategory;
  name: string;
  nameEn: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export type IconType = 'emoji' | 'kaomoji' | 'image';

export interface AssetIcon {
  type: IconType;
  value: string;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  icon?: string; // emoji or icon name
  color?: string; // color badge class or hex
  createdAt: string;
  updatedAt: string;
  assetsCount?: number;
}

export interface AssetVersion {
  version: number;
  updatedAt: string;
  title: string;
  summary?: string;
  editorName?: string;
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  icon: AssetIcon;
  category: AssetCategory;
  content: string;
  uiCodeSnippet?: string;
  previewImage?: string; // legacy single image support
  previewImages?: string[]; // up to 6 gallery images
  folderId?: string | null;
  isPublic: boolean;
  visibility: AssetVisibility;
  status: AssetStatus;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  likesCount?: number;
  forkCount?: number;
  forkedFromId?: string | null;
  forkedFromAuthor?: string | null;
  linkedAssetIds?: string[];
  versions?: AssetVersion[];
}

export interface Bookmark {
  id: string;
  userId: string;
  assetId: string;
  createdAt: string;
}

export interface ContentReport {
  id: string;
  assetId: string;
  reporterId?: string;
  reporterName?: string;
  reason: 'copyright' | 'inappropriate' | 'spam' | 'harassment' | 'other';
  details?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  email?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  provider?: 'email' | 'google';
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  isNewUser?: boolean;
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

export interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  signUpWithEmail: (email: string, pass: string) => Promise<AuthResponse>;
  loginWithEmail: (email: string, pass: string, name?: string) => Promise<AuthResponse>;
  loginWithGoogle: () => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; bio?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  authDefaultTab: 'login' | 'signup';
  openAuthModal: (tab?: 'login' | 'signup') => void;
}

