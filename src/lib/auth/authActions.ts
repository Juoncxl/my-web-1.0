import type { AuthResponse } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { cxlAuthService } from '../../data/cxlAuthService';

let logoutInFlight: Promise<void> | null = null;

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

async function waitForLogoutCompletion(): Promise<void> {
  if (logoutInFlight) await logoutInFlight;
}

export async function signUpWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
    const cleanEmail = email.toLowerCase().trim();
    if (!cxlAuthService.isAvailable()) {
      cxlAuthService.logUnavailable('signup');
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    const authResult = await cxlAuthService.signUp(cleanEmail, pass);
    if (!authResult) {
      cxlAuthService.logUnavailable('signup');
      return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const { data, error } = authResult;

    if (error) {
      cxlAuthService.logFailure('signup', error);
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
      user: cxlAuthService.mapUser(data.user),
      isNewUser: true
    };
  } catch (error) {
    cxlAuthService.logFailure('signup:exception', error);
    return { success: false, error: safeAuthMessage(error, 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
    const cleanEmail = email.toLowerCase().trim();
    if (!cxlAuthService.isAvailable()) {
      cxlAuthService.logUnavailable('login');
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    const authResult = await cxlAuthService.signInWithPassword(cleanEmail, pass);
    if (!authResult) {
      cxlAuthService.logUnavailable('login');
      return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const { data, error } = authResult;

    if (error) {
      cxlAuthService.logFailure('login', error);
      return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน') };
    }
    if (!data.user || !data.session) {
      return { success: false, error: 'ไม่พบ session ที่ใช้งานได้ กรุณาลองเข้าสู่ระบบอีกครั้ง' };
    }

    return {
      success: true,
      user: cxlAuthService.mapUser(data.user),
      isNewUser: false
    };
  } catch (error) {
    cxlAuthService.logFailure('login:exception', error);
    return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  try {
    await waitForLogoutCompletion();
    if (!cxlAuthService.isAvailable()) {
      cxlAuthService.logUnavailable('google-login');
      return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    const authResult = await cxlAuthService.signInWithGoogle();
    if (!authResult) {
      cxlAuthService.logUnavailable('google-login');
      return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const { error } = authResult;

    return error
      ? (cxlAuthService.logFailure('google-login', error), { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') })
      : { success: true };
  } catch (error) {
    cxlAuthService.logFailure('google-login:exception', error);
    return { success: false, error: safeAuthMessage(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') };
  }
}

export async function logout(): Promise<void> {
  if (logoutInFlight) return logoutInFlight;

  const operation = (async () => {
    try {
      if (cxlAuthService.isAvailable()) {
        // The app's Logout button ends only this browser session. Using the
        // explicit local scope avoids revoking unrelated devices and narrows
        // the server-side cleanup before a fresh login.
        const result = await cxlAuthService.signOutLocal();
        const error = result?.error;
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
