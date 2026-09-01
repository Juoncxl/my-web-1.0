import type { AuthResponse } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { getSupabaseClient, isLocalRuntime, supabaseConfigStatus } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { mapSupabaseAuthUser } from './authUserMapper';

function logAuthFailure(operation: string, error: unknown) {
  if (!isLocalRuntime()) return;
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? record.message.replace(/[\r\n]+/g, ' ').slice(0, 300) : 'Unknown auth error';
  console.warn(`[supabase:auth:${operation}] failed`, {
    code: typeof record.code === 'string' ? record.code : undefined,
    status: typeof record.status === 'number' ? record.status : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    message
  });
}

function logAuthConfigUnavailable(operation: string) {
  if (!isLocalRuntime()) return;
  console.warn(`[supabase:auth:${operation}] skipped because client is not configured`, {
    url: supabaseConfigStatus.urlConfigured ? 'configured' : 'missing',
    anonKey: supabaseConfigStatus.anonKeyConfigured ? 'configured' : 'missing'
  });
}

function profileProvisioningError(operation: string): string {
  logAuthFailure(`${operation}:profile-provisioning`, {
    code: 'PROFILE_PROVISIONING_FAILED',
    message: 'Auth succeeded but the profile record could not be read after authentication.'
  });
  return 'บัญชีถูกสร้างแล้ว แต่สร้างข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Profile provisioning';
}

function safeAuthMessage(error: unknown, fallback: string): string {
  const message = formatFriendlyErrorMessage(error).trim();
  if (!message || message.length > 300 || /stack|\bat\s+[a-z]:\\|\bat\s+\/|node_modules/i.test(message)) return fallback;
  return message;
}

export async function signUpWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabaseClient();
    if (!supabase) {
      logAuthConfigUnavailable('signup');
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: cleanEmail.split('@')[0] }
      }
    });

    if (error) {
      logAuthFailure('signup', error);
      return { success: false, error: safeAuthMessage(error, 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
    }
    if (!data.user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้จากการลงทะเบียน' };

    const profile = await supabaseService.getProfile(data.user.id);
    if (!profile) return { success: false, error: profileProvisioningError('signup') };

    if (!data.session) {
      return {
        success: true,
        requiresEmailConfirmation: true,
        message: 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
      };
    }

    return {
      success: true,
      user: mapSupabaseAuthUser(data.user, profile),
      isNewUser: true
    };
  } catch (error) {
    logAuthFailure('signup:exception', error);
    return { success: false, error: safeAuthMessage(error, 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabaseClient();
    if (!supabase) {
      logAuthConfigUnavailable('login');
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass
    });

    if (error) {
      logAuthFailure('login', error);
      return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน') };
    }
    if (!data.user || !data.session) {
      return { success: false, error: 'ไม่พบ session ที่ใช้งานได้ กรุณาลองเข้าสู่ระบบอีกครั้ง' };
    }

    const profile = await supabaseService.getProfile(data.user.id);
    if (!profile) return { success: false, error: profileProvisioningError('login') };
    return {
      success: true,
      user: mapSupabaseAuthUser(data.user, profile),
      isNewUser: false
    };
  } catch (error) {
    logAuthFailure('login:exception', error);
    return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logAuthConfigUnavailable('google-login');
      return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });

    return error
      ? (logAuthFailure('google-login', error), { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') })
      : { success: true };
  } catch (error) {
    logAuthFailure('google-login:exception', error);
    return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function logout(): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('Supabase signout failed:', error);
    }
  } catch (error) {
    console.warn('Supabase signout exception:', error);
  }
}
