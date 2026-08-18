export type AssetCategory =
  | 'character'
  | 'lore'
  | 'ui_code'
  | 'prompts'
  | 'collab'
  | 'app_data';

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
  previewImages?: string[]; // up to 5 gallery images
  folderId?: string | null;
  isPublic: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  likesCount?: number;
  forkCount?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  email?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  isGuest: boolean;
  createdAt: string;
}

export interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  loginWithEmail: (email: string, pass: string, name?: string) => Promise<boolean>;
  loginAsGuest: (customName?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: { displayName?: string; bio?: string; avatarUrl?: string }) => Promise<boolean>;
  isAuthenticated: boolean;
}
