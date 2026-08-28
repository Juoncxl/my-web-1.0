import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { AuthContextType, AuthResponse, User } from '../types';
import { formatFriendlyErrorMessage } from '../lib/apiHelper';
import { getSupabaseClient } from '../lib/supabaseClient';
import { supabaseService } from '../lib/supabaseService';
import { isGuestUser } from '../lib/accessPolicy';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

function resolveUser(authUser: SupabaseAuthUser, profile?: Partial<User> | null): User {
  return {
    id: authUser.id,
    email: authUser.email || '',
    displayName:
      profile?.displayName ||
      authUser.user_metadata?.display_name ||
      authUser.user_metadata?.displayName ||
      authUser.email?.split('@')[0] ||
      'Creator',
    bio: profile?.bio || authUser.user_metadata?.bio || 'นักสร้างสรรค์ผลงาน 🌸',
    avatarUrl:
      profile?.avatarUrl ||
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.avatarUrl ||
      DEFAULT_AVATAR,
    createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
    provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'signup'>('login');

  const openAuthModal = (tab: 'login' | 'signup' = 'login') => {
    setAuthDefaultTab(tab);
    setIsAuthOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    let latestRequest = 0;
    const pendingTimers = new Set<number>();
    const supabase = getSupabaseClient();

    const syncAuthenticatedUser = async (authUser: SupabaseAuthUser | null) => {
      const requestId = ++latestRequest;
      if (!authUser) {
        if (isMounted) setCurrentUser(null);
        return;
      }

      const profile = await supabaseService.getProfile(authUser.id);
      if (isMounted && requestId === latestRequest) {
        setCurrentUser(resolveUser(authUser, profile));
      }
    };

    const initializeSession = async () => {
      setIsLoading(true);

      if (!supabase) {
        if (isMounted) {
          setCurrentUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          await syncAuthenticatedUser(null);
          return;
        }

        // Validate the stored session with Supabase before enabling account-only UI.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          await syncAuthenticatedUser(null);
          return;
        }

        await syncAuthenticatedUser(userData.user);
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        await syncAuthenticatedUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initializeSession();

    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      // Defer Supabase calls until after the auth callback finishes to avoid lock contention.
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        void syncAuthenticatedUser(session?.user || null);
      }, 0);
      pendingTimers.add(timer);
    });

    return () => {
      isMounted = false;
      pendingTimers.forEach(timer => window.clearTimeout(timer));
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
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
        setCurrentUser(null);
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
        };
      }

      const newUser = resolveUser(data.user);
      setCurrentUser(newUser);
      setIsAuthOpen(false);
      setIsOnboardingOpen(true);
      return { success: true, user: newUser, isNewUser: true };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: formatFriendlyErrorMessage(error) };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
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
      const loggedInUser = resolveUser(data.user, profile);
      setCurrentUser(loggedInUser);
      setIsAuthOpen(false);
      return { success: true, user: loggedInUser, isNewUser: false };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: formatFriendlyErrorMessage(error) };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<AuthResponse> => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    const supabase = getSupabaseClient();
    // Disable account-only UI immediately, even if the network sign-out is slow.
    setCurrentUser(null);
    setIsSettingsOpen(false);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) console.warn('Supabase signout failed:', error);
      }
    } catch (error) {
      console.warn('Supabase signout exception:', error);
    }
  };

  const updateProfile = async (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; error?: string }> => {
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

    setCurrentUser(updatedUser);
    return { success: true };
  };

  const changePassword = async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> => {
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
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isAuthenticated: !isGuestUser(currentUser),
        isGuest: isGuestUser(currentUser),
        signUpWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        updateProfile,
        changePassword,
        isOnboardingOpen,
        setIsOnboardingOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isAuthOpen,
        setIsAuthOpen,
        authDefaultTab,
        openAuthModal
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
