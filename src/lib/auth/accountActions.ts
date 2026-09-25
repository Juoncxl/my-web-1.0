import type { ProfileSocialLink, User } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { normalizeProfileUsername } from '../profileIdentity';
import { cxlDataService } from '../../data/cxlDataService';
import { cxlAuthService } from '../../data/cxlAuthService';

export interface ProfileUpdateResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function updateProfile(
  currentUser: User | null,
  data: { displayName?: string; username?: string; bio?: string; avatarUrl?: string; coverUrl?: string; avatarImageKey?: string | null; coverImageKey?: string | null; socialLinks?: ProfileSocialLink[] }
): Promise<ProfileUpdateResult> {
  if (!currentUser) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์' };
  }

  const updatedUser: User = {
    ...currentUser,
    displayName: data.displayName?.trim() || currentUser.displayName,
    username: data.username !== undefined ? normalizeProfileUsername(data.username) : normalizeProfileUsername(currentUser.username),
    bio: data.bio !== undefined ? data.bio.trim() : currentUser.bio,
    avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatarUrl,
    coverUrl: data.coverUrl !== undefined ? data.coverUrl : currentUser.coverUrl,
    avatarImageKey: data.avatarImageKey !== undefined ? data.avatarImageKey || undefined : currentUser.avatarImageKey,
    coverImageKey: data.coverImageKey !== undefined ? data.coverImageKey || undefined : currentUser.coverImageKey,
    socialLinks: data.socialLinks !== undefined ? data.socialLinks : currentUser.socialLinks
  };

  const saved = await cxlDataService.profiles.upsert(updatedUser);
  if (!saved.success) {
    return {
      success: false,
      error: saved.error || 'บันทึกโปรไฟล์บนคลาวด์ไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกเปลี่ยน'
    };
  }

  return { success: true, user: updatedUser };
}

export async function changePassword(
  currentUser: User | null,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  if (!currentUser) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน' };
  }
  if (currentUser.provider !== 'email' || !currentUser.email) {
    return { success: false, error: 'บัญชี OAuth ต้องจัดการรหัสผ่านผ่านผู้ให้บริการบัญชี' };
  }

  if (!cxlAuthService.isAvailable()) return { success: false, error: 'ไม่สามารถเชื่อมต่อระบบบัญชีได้' };

  try {
    const verification = await cxlAuthService.signInWithPassword(currentUser.email, currentPass);
    if (!verification) return { success: false, error: 'ไม่สามารถเชื่อมต่อระบบบัญชีได้' };
    const { error: verifyError } = verification;
    if (verifyError) {
      return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
    }

    const update = await cxlAuthService.updatePassword(newPass);
    if (!update) return { success: false, error: 'ไม่สามารถเชื่อมต่อระบบบัญชีได้' };
    const { error } = update;
    return error
      ? { success: false, error: formatFriendlyErrorMessage(error) }
      : { success: true };
  } catch (error) {
    return { success: false, error: formatFriendlyErrorMessage(error) };
  }
}
