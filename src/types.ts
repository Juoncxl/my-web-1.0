export type AssetCategory =
  | 'character'
  | 'lore'
  | 'ui_code'
  | 'prompts'
  | 'collab'
  | 'app_data';

export type AssetVisibility = 'public' | 'private' | 'draft';

export type AssetStatus = 'idea' | 'draft' | 'in_progress' | 'finished' | 'archived';

export type AssetContentType = 'character' | 'lore' | 'image_prompt' | 'ui_code' | 'bot_prompt';
export type AssetAudienceRating = 'general' | '13_plus' | '16_plus' | '18_plus';
export type AssetCreatorWorkStatus = 'not_started' | 'in_progress' | 'waiting_data' | 'in_review' | 'needs_fix' | 'blocked' | 'paused' | 'finished';

export interface AssetPresentationMetadata {
  contentTypes: AssetContentType[];
  appPlatforms: string[];
  audienceRating: AssetAudienceRating;
  contentWarnings: string[];
  genres: string[];
  imagePromptToolModel: string;
  workStatus: AssetCreatorWorkStatus;
}

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
  /** QA Sandbox key for binary image/GIF data held outside localStorage. */
  storageKey?: string;
  /** Original media type, retained so the editor can restore the GIF mode. */
  mimeType?: string;
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

export type WorkContentBlockType = 'Text' | 'Heading' | 'Image' | 'Prompt' | 'UI Code' | 'Divider' | 'Note';

export interface WorkContentBlock {
  id: string;
  type: WorkContentBlockType;
  title: string;
  body: string;
}

export interface AssetCollaborationSharedInformation {
  id: string;
  title: string;
  type: 'text' | 'code';
  content: string;
  appScope: 'unspecified' | 'all_apps' | 'specific_apps';
  platforms: string[];
}

export interface AssetCollaborationDeadline {
  id: string;
  kind: 'data' | 'image' | 'publish' | 'custom';
  label: string;
  date: string;
}

export interface AssetCollaborationParticipant {
  id: string;
  isOwner: boolean;
  creatorName: string;
  houseTag: string;
  platforms: string[];
  contact: string;
  externalWorkName: string;
  dataStatus: 'not_submitted' | 'reviewing' | 'needs_fix' | 'approved';
  imageStatus: 'not_submitted' | 'reviewing' | 'needs_fix' | 'approved';
  notes: string;
  referenceImages: Array<{
    id: string;
    src: string;
    kind: 'image' | 'gif';
    mimeType?: string;
    naturalWidth?: number;
    naturalHeight?: number;
  }>;
  linkedWorkIds: string[];
  deadlineOverrides: Record<string, string>;
  useDeadlineOverrides: boolean;
}

export interface AssetCollaborationVisibilityPolicy {
  showParticipantStatuses: boolean;
  showParticipantNotes: boolean;
  showParticipantDeadlineOverrides: boolean;
}

export interface AssetCollaboration {
  name: string;
  sharedTag: string;
  platforms: string[];
  sharedInformation: AssetCollaborationSharedInformation[];
  deadlines: AssetCollaborationDeadline[];
  participants: AssetCollaborationParticipant[];
  visibilityPolicy: AssetCollaborationVisibilityPolicy;
}

export interface PublicAssetCollaborationParticipant {
  id: string;
  isOwner: boolean;
  creatorName: string;
  houseTag: string;
  platforms: string[];
  externalWorkName: string;
  referenceImages: AssetCollaborationParticipant['referenceImages'];
  linkedWorkIds: string[];
  dataStatus?: AssetCollaborationParticipant['dataStatus'];
  imageStatus?: AssetCollaborationParticipant['imageStatus'];
  notes?: string;
  deadlineOverrides?: Record<string, string>;
}

export interface PublicAssetCollaboration {
  name: string;
  sharedTag: string;
  platforms: string[];
  sharedInformation: AssetCollaborationSharedInformation[];
  deadlines: AssetCollaborationDeadline[];
  participants: PublicAssetCollaborationParticipant[];
  visibilityPolicy: AssetCollaborationVisibilityPolicy;
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  icon: AssetIcon;
  category: AssetCategory;
  shortDescription?: string;
  /** QA-safe canonical labels used by both Review and real Work cards. */
  contentTypeLabels?: string[];
  /** Selected Composer content types retained by the local QA persistence model. */
  contentTypes?: AssetContentType[];
  /** Canonical metadata shared by Composer Review and persisted Work surfaces. */
  presentationMetadata?: AssetPresentationMetadata;
  /** Owner-only Collaboration draft. Public renderers must never read this field. */
  collaboration?: AssetCollaboration | null;
  /** QA Sandbox key for the large Work payload held outside localStorage. */
  qaStorageKey?: string;
  /** Whitelisted Collaboration data safe for cards, details, exports, and public APIs. */
  publicCollaboration?: PublicAssetCollaboration | null;
  /** A standard Work may belong to one Collaboration hub. */
  collaborationAssetId?: string | null;
  contentBlocks?: WorkContentBlock[];
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

export interface ProfileSocialLink {
  id?: string;
  platform: 'instagram' | 'x' | 'website' | 'contact' | 'custom' | string;
  label: string;
  url: string;
  visible: boolean;
  sortOrder?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  email?: string;
  displayName: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  avatarImageKey?: string;
  coverImageKey?: string;
  socialLinks?: ProfileSocialLink[];
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
  updateProfile: (data: { displayName?: string; username?: string; bio?: string; avatarUrl?: string; coverUrl?: string; avatarImageKey?: string | null; coverImageKey?: string | null; socialLinks?: ProfileSocialLink[] }) => Promise<{ success: boolean; user?: User; error?: string }>;
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

