import type { AuthResponse } from '../../types';
import { formatFriendlyErrorMessage } from '../apiHelper';
import { getSupabaseClient } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { mapSupabaseAuthUser } from './authUserMapper';

export async function signUpWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลเว็บไซต์'
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

    if (error) return { success: false, error: formatFriendlyErrorMessage(error) };
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
      user: mapSupabaseAuthUser(data.user),
      isNewUser: true
    };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: formatFriendlyErrorMessage(error) };
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<AuthResponse> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        success: false,
        error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลเว็บไซต์'
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass
    });

    if (error) return { success: false, error: formatFriendlyErrorMessage(error) };
    if (!data.user || !data.session) {
      return { success: false, error: 'ไม่พบ session ที่ใช้งานได้ กรุณาลองเข้าสู่ระบบอีกครั้ง' };
    }

    const profile = await supabaseService.getProfile(data.user.id);
    return {
      success: true,
      user: mapSupabaseAuthUser(data.user, profile),
      isNewUser: false
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: formatFriendlyErrorMessage(error) };
  }
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'ระบบบัญชียังไม่พร้อมใช้งาน' };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });

    return error
      ? { success: false, error: formatFriendlyErrorMessage(error) }
      : { success: true };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: formatFriendlyErrorMessage(error) };
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
