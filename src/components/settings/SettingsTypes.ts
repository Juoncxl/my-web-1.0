export type SettingsTab = 'profile' | 'security' | 'backup';

export interface SettingsMessage {
  type: 'success' | 'error';
  text: string;
}

export interface LegacySummary {
  assets: number;
  folders: number;
}
