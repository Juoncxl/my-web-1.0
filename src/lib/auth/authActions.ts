import type { AuthResponse } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { getSupabaseClient, isLocalRuntime, supabaseConfigStatus } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { mapSupabaseAuthUser } from './authUserMapper';

let logoutInFlight: Promise<void> | null = null;

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

function safeAuthMessage(error: unknown, fallback: string): string {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const status = typeof record.status === 'number' ? record.status : Number(record.status || 0);
  const code = typeof record.code === 'string' ? record.code : '';
  if (status >= 500 || code === 'request_timeout' || code === 'unexpected_failure') {
    const suffix = status ? ` (HTTP ${status})` : '';
    return `ระบบยืนยันตัวตนไม่พร้อมใช้งานชั่วคราว${suffix} กรุณารอสักครู่แล้วลองใหม่อีกครั้ง`;
  }

  const message = formatFriendlyErrorMessage(error).trim();
  if (!message || message.length > 300 || /stack|\bat\s+[a-z]:\\|\bat\s+\/|node_modules/i.test(message)) return fallback;
  return message;
}

function mapAuthenticatedUser(authUser: Parameters<typeof mapSupabaseAuthUser>[0]) {
  const profileSnapshot = supabaseService.getProfileSnapshot(authUser.id);
  return mapSupabaseAuthUser(authUser, profileSnapshot?.id === authUser.id ? profileSnapshot : null);
}

async function waitForLogoutCompletion(): Promise<void> {
  if (logoutInFlight) await logoutInFlight;
}

export async function signUpWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
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

    if (!data.session) {
      return {
        success: true,
        requiresEmailConfirmation: true,
        message: 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
      };
    }

    return {
      success: true,
      user: mapAuthenticatedUser(data.user),
      isNewUser: true
    };
  } catch (error) {
    logAuthFailure('signup:exception', error);
    return { success: false, error: safeAuthMessage(error, 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
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

    return {
      success: true,
      user: mapAuthenticatedUser(data.user),
      isNewUser: false
    };
  } catch (error) {
    logAuthFailure('login:exception', error);
    return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
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
  if (logoutInFlight) return logoutInFlight;

  const operation = (async () => {
    const supabase = getSupabaseClient();
    try {
      if (supabase) {
        // The app's Logout button ends only this browser session. Using the
        // explicit local scope avoids revoking unrelated devices and narrows
        // the server-side cleanup before a fresh login.
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) console.warn('Supabase signout failed:', error);
      }
    } catch (error) {
      console.warn('Supabase signout exception:', error);
    }
  })();

  const trackedOperation = operation.finally(() => {
    if (logoutInFlight === trackedOperation) logoutInFlight = null;
  });
  logoutInFlight = trackedOperation;
  return trackedOperation;
}
