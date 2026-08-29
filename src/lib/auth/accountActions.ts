import type { User } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { getSupabaseClient } from '../supabaseClient';
import { supabaseService } from '../supabaseService';

export interface ProfileUpdateResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function updateProfile(
  currentUser: User | null,
  data: { displayName?: string; bio?: string; avatarUrl?: string }
): Promise<ProfileUpdateResult> {
  if (!currentUser) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์' };
  }

  const updatedUser: User = {
    ...currentUser,
    displayName: data.displayName?.trim() || currentUser.displayName,
    bio: data.bio !== undefined ? data.bio.trim() : currentUser.bio,
    avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatarUrl
  };

  const saved = await supabaseService.upsertProfile(updatedUser);
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

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'ไม่สามารถเชื่อมต่อระบบบัญชีได้' };

  try {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPass
    });
    if (verifyError) {
      return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPass });
    return error
      ? { success: false, error: formatFriendlyErrorMessage(error) }
      : { success: true };
  } catch (error) {
    return { success: false, error: formatFriendlyErrorMessage(error) };
  }
}
