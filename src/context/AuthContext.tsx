import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType, AuthResponse } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';
import { supabaseService } from '../lib/supabaseService';
import { formatFriendlyErrorMessage } from '../lib/apiHelper';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_SESSION_KEY = 'creator_vault_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal Control States
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'signup'>('login');

  const openAuthModal = (tab: 'login' | 'signup' = 'login') => {
    setAuthDefaultTab(tab);
    setIsAuthOpen(true);
  };

  // Helper to persist session to localStorage and state
  const persistSession = (user: User | null) => {
    setCurrentUser(user);
    if (user && !user.isGuest) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('Could not write to localStorage:', e);
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  };

  // 1. Initialize Real Supabase Auth and Listen for Session Changes
  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    const initializeSession = async () => {
      setIsLoading(true);
      try {
        if (supabase) {
          // Direct Real Supabase Session Fetch
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (!error && session?.user) {
            const authUser = session.user;
            
            // Query Supabase profiles table directly
            const profile = await supabaseService.getProfile(authUser.id);

            const resolvedUser: User = {
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
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              isGuest: false,
              createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
              provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
            };

            if (isMounted) {
              persistSession(resolvedUser);
              setIsLoading(false);
              return;
            }
          }
        }

        // Check stored session if previously signed in
        const savedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.id && !parsed.isGuest && parsed.email) {
              if (isMounted) persistSession(parsed);
              setIsLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
          }
        }

        // Default Initial Guest State (Clear Guest Indicator, no fake accounts)
        const initialGuest: User = {
          id: `guest_${Math.random().toString(36).substring(2, 9)}`,
          displayName: 'นักเขียนนิรนาม 🌸',
          bio: 'โหมดทดลองใช้งาน — สามารถทดลองสร้างผลงานและใช้งานฟีเจอร์ได้ทันที',
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isGuest: true,
          createdAt: new Date().toISOString(),
          provider: 'guest'
        };
        if (isMounted) persistSession(initialGuest);
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeSession();

    // Real Supabase Auth State Change Listener
    let authListenerSubscription: { unsubscribe: () => void } | null = null;
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const authUser = session.user;
          const profile = await supabaseService.getProfile(authUser.id);

          const resolvedUser: User = {
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
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isGuest: false,
            createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
            provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
          };
          persistSession(resolvedUser);
        } else if (event === 'SIGNED_OUT') {
          // Reset to clean guest
          const guest: User = {
            id: `guest_${Math.random().toString(36).substring(2, 9)}`,
            displayName: 'นักเขียนนิรนาม 🌸',
            bio: 'โหมดทดลองใช้งาน — สามารถทดลองสร้างผลงานและใช้งานฟีเจอร์ได้ทันที',
            avatarUrl:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isGuest: true,
            createdAt: new Date().toISOString(),
            provider: 'guest'
          };
          persistSession(guest);
        }
      });
      authListenerSubscription = authListener.subscription;
    }

    return () => {
      isMounted = false;
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
    };
  }, []);

  // 2. Real Supabase Sign Up Flow
  const signUpWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const supabase = getSupabaseClient();

      if (!supabase) {
        return { 
          success: false, 
          error: 'ยังไม่ได้ตั้งค่า Supabase URL หรือ Anon Key ในตัวแปรสภาพแวดล้อม (Environment Variables)' 
        };
      }

      // Real Supabase SDK Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            displayName: cleanEmail.split('@')[0]
          }
        }
      });

      if (error) {
        return { success: false, error: formatFriendlyErrorMessage(error) };
      }

      if (data && data.user) {
        const authUser = data.user;
        const newUser: User = {
          id: authUser.id,
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
          bio: 'นักสร้างบอทและนักเขียน ✦ สมาชิกใหม่ของ Creator Vault',
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isGuest: false,
          createdAt: authUser.created_at || new Date().toISOString(),
          provider: 'email'
        };

        // Upsert to Supabase profiles table
        await supabaseService.upsertProfile(newUser);

        persistSession(newUser);
        setIsAuthOpen(false);
        setIsOnboardingOpen(true);
        return { success: true, user: newUser, isNewUser: true };
      }

      return { success: false, error: 'ไม่พบข้อมูลผู้ใช้จากการลงทะเบียน' };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Real Supabase Log In Flow
  const loginWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const supabase = getSupabaseClient();

      if (!supabase) {
        return { 
          success: false, 
          error: 'ยังไม่ได้ตั้งค่า Supabase URL หรือ Anon Key ในตัวแปรสภาพแวดล้อม (Environment Variables)' 
        };
      }

      // Real Supabase SDK Password Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        return { success: false, error: formatFriendlyErrorMessage(error) };
      }

      if (data && data.user) {
        const authUser = data.user;
        const profile = await supabaseService.getProfile(authUser.id);

        const loggedInUser: User = {
          id: authUser.id,
          email: cleanEmail,
          displayName:
            profile?.displayName ||
            authUser.user_metadata?.display_name ||
            authUser.user_metadata?.displayName ||
            cleanEmail.split('@')[0],
          bio: profile?.bio || authUser.user_metadata?.bio || 'ยินดีต้อนรับกลับสู่ Creator Vault!',
          avatarUrl:
            profile?.avatarUrl ||
            authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isGuest: false,
          createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
          provider: 'email'
        };

        persistSession(loggedInUser);
        setIsAuthOpen(false);
        return { success: true, user: loggedInUser, isNewUser: false };
      }

      return { success: false, error: 'ไม่พบข้อมูลผู้ใช้จากการเข้าสู่ระบบ' };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Supabase Google OAuth Login (Hidden in UI, available when configured)
  const loginWithGoogle = async (): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { success: false, error: 'Supabase client is not configured' };
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        return { success: false, error: formatFriendlyErrorMessage(error) };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Google login error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Guest Mode
  const loginAsGuest = async (customName?: string): Promise<boolean> => {
    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      displayName: customName || 'นักเขียนนิรนาม 🌸',
      bio: 'บัญชี Guest ชั่วคราว — สามารถทดลองสร้างผลงานและใช้งานฟีเจอร์ได้ทันที',
      avatarUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      isGuest: true,
      createdAt: new Date().toISOString(),
      provider: 'guest'
    };

    persistSession(guestUser);
    setIsAuthOpen(false);
    return true;
  };

  // 6. Real Supabase Log Out
  const logout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signout error:', e);
      }
    }

    const defaultGuest: User = {
      id: `guest_${Math.random().toString(36).substring(2, 9)}`,
      displayName: 'นักเขียนนิรนาม 🌸',
      bio: 'โหมดทดลองใช้งาน — สามารถทดลองสร้างผลงานและใช้งานฟีเจอร์ได้ทันที',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isGuest: true,
      createdAt: new Date().toISOString(),
      provider: 'guest'
    };
    persistSession(defaultGuest);
  };

  // 7. Real Supabase Profile Update
  const updateProfile = async (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<boolean> => {
    if (!currentUser) return false;

    const updatedUser: User = {
      ...currentUser,
      displayName:
        data.displayName !== undefined ? data.displayName.trim() : currentUser.displayName,
      bio: data.bio !== undefined ? data.bio.trim() : currentUser.bio,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatarUrl
    };

    persistSession(updatedUser);

    if (!currentUser.isGuest) {
      await supabaseService.upsertProfile(updatedUser);
    }

    return true;
  };

  // 8. Real Supabase Password Change
  const changePassword = async (
    _currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.isGuest) {
      return { success: false, error: 'คุณต้องเข้าสู่ระบบด้วยบัญชีสมาชิกเพื่อเปลี่ยนรหัสผ่าน' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPass
        });
        if (error) {
          return { success: false, error: formatFriendlyErrorMessage(error) };
        }
        return { success: true };
      } catch (e: any) {
        return { success: false, error: formatFriendlyErrorMessage(e) };
      }
    }

    return { success: false, error: 'ไม่สามารถเชื่อมต่อกับ Supabase ได้' };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isAuthenticated: !!currentUser && !currentUser.isGuest,
        signUpWithEmail,
        loginWithEmail,
        loginWithGoogle,
        loginAsGuest,
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
