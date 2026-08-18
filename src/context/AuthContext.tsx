import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType, AuthResponse } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';
import { safeFetchJson, formatFriendlyErrorMessage } from '../lib/apiHelper';

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

  // Helper to persist user and notify state
  const persistSession = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('Could not write to localStorage:', e);
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  };

  // Initialize and restore session from Database on mount (Sync across devices)
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const sessionRes = await supabase.auth.getSession();
            if (sessionRes && sessionRes.data && sessionRes.data.session?.user) {
              const authUser = sessionRes.data.session.user;
              const authUid = authUser.id;

              // Fetch profile from supabase profiles table safely
              const profileRes = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUid)
                .single();

              const profile = profileRes?.data;
              if (profile) {
                const u: User = {
                  id: authUid,
                  email: authUser.email,
                  displayName:
                    profile.display_name ||
                    profile.displayName ||
                    authUser.email?.split('@')[0] ||
                    'Creator',
                  bio: profile.bio || '',
                  avatarUrl:
                    profile.avatar_url ||
                    profile.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                  isGuest: false,
                  createdAt: profile.created_at || authUser.created_at || new Date().toISOString(),
                  provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
                };
                persistSession(u);
                setIsLoading(false);
                return;
              }
            }
          } catch (supInitErr) {
            console.warn('Supabase session fetch skipped or failed:', formatFriendlyErrorMessage(supInitErr));
          }
        }

        // Restore from Local Storage session & sync with server database
        const savedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.id) {
              if (parsed.isGuest) {
                setCurrentUser(parsed);
              } else {
                // Fetch latest profile from server to guarantee sync using safeFetchJson
                const res = await safeFetchJson<any>(`/api/profiles/${parsed.id}`);
                if (res.success && res.data) {
                  const syncedUser: User = {
                    ...parsed,
                    displayName: res.data.displayName || parsed.displayName,
                    bio: res.data.bio !== undefined ? res.data.bio : parsed.bio,
                    avatarUrl: res.data.avatarUrl || parsed.avatarUrl
                  };
                  persistSession(syncedUser);
                } else {
                  setCurrentUser(parsed);
                }
              }
            }
          } catch {
            // Bad local JSON, clear it
            localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
          }
        } else {
          // Default initial friendly Guest session
          const defaultGuest: User = {
            id: `guest_${Math.random().toString(36).substring(2, 9)}`,
            displayName: 'นักเขียนนิรนาม 🌸 (Guest)',
            bio: 'ยินดีต้อนรับสู่ Creator Vault! ทดลองสร้างและบันทึกผลงานได้ทันที',
            avatarUrl:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isGuest: true,
            createdAt: new Date().toISOString(),
            provider: 'guest'
          };
          persistSession(defaultGuest);
        }
      } catch (err) {
        console.error('Session initialization error:', formatFriendlyErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 1. Sign Up Flow (Email/Password) -> Triggers Onboarding
  const signUpWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const supabase = getSupabaseClient();

      // Attempt Supabase Auth if client is configured
      if (supabase) {
        try {
          const authRes = await supabase.auth.signUp({
            email: cleanEmail,
            password: pass,
            options: {
              data: {
                displayName: cleanEmail.split('@')[0]
              }
            }
          });

          if (authRes?.error) {
            console.warn('Supabase signUp reported error:', authRes.error);
          } else if (authRes && authRes.data && authRes.data.user) {
            const authUser = authRes.data.user;
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

            // Save to Supabase profiles table safely
            try {
              await supabase.from('profiles').upsert({
                id: newUser.id,
                display_name: newUser.displayName,
                bio: newUser.bio,
                avatar_url: newUser.avatarUrl,
                is_guest: false
              });
            } catch (pErr) {
              console.warn('Could not upsert Supabase profile:', pErr);
            }

            // Mirror to server DB
            await safeFetchJson(`/api/profiles/${newUser.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newUser)
            }).catch(() => {});

            persistSession(newUser);
            setIsAuthOpen(false);
            setIsOnboardingOpen(true); // Direct to onboarding
            return { success: true, user: newUser, isNewUser: true };
          }
        } catch (supabaseErr: any) {
          console.warn('Supabase signup threw error, falling back to Server DB:', formatFriendlyErrorMessage(supabaseErr));
        }
      }

      // Server DB Auth (Safe Fetch JSON)
      const res = await safeFetchJson<{ user: User; message?: string }>('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: pass })
      });

      if (!res.success || !res.data?.user) {
        return {
          success: false,
          error: res.error || 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        };
      }

      persistSession(res.data.user);
      setIsAuthOpen(false);
      setIsOnboardingOpen(true); // Open profile setup onboarding immediately
      return { success: true, user: res.data.user, isNewUser: true };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Log In Flow (Email/Password) -> Recognizes returning users, preserves profiles & assets
  const loginWithEmail = async (email: string, pass: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const supabase = getSupabaseClient();

      if (supabase) {
        try {
          const authRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: pass
          });

          if (authRes && !authRes.error && authRes.data?.user) {
            const authUser = authRes.data.user;

            // Fetch profile from supabase profiles table safely
            let profile: any = null;
            try {
              const profileRes = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();
              profile = profileRes?.data;
            } catch (profErr) {
              console.warn('Supabase profile fetch error:', profErr);
            }

            const loggedInUser: User = {
              id: authUser.id,
              email: cleanEmail,
              displayName:
                profile?.display_name ||
                profile?.displayName ||
                authUser.user_metadata?.displayName ||
                cleanEmail.split('@')[0],
              bio: profile?.bio || authUser.user_metadata?.bio || '',
              avatarUrl:
                profile?.avatar_url ||
                profile?.avatarUrl ||
                authUser.user_metadata?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              isGuest: false,
              createdAt: profile?.created_at || authUser.created_at || new Date().toISOString(),
              provider: 'email'
            };

            persistSession(loggedInUser);
            setIsAuthOpen(false);
            return { success: true, user: loggedInUser, isNewUser: false };
          }
        } catch (supabaseErr) {
          console.warn('Supabase login fallback:', formatFriendlyErrorMessage(supabaseErr));
        }
      }

      // Server DB Auth
      const res = await safeFetchJson<{ user: User; message?: string }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: pass })
      });

      if (!res.success || !res.data?.user) {
        return {
          success: false,
          error: res.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน'
        };
      }

      persistSession(res.data.user);
      setIsAuthOpen(false);
      return { success: true, user: res.data.user, isNewUser: false };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Continue with Google Flow
  const loginWithGoogle = async (): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const authRes = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin
            }
          });
          if (authRes?.error) {
            console.warn('Supabase Google OAuth returned error:', authRes.error);
          }
        } catch (supGoogleErr) {
          console.warn('Supabase Google OAuth fallback:', formatFriendlyErrorMessage(supGoogleErr));
        }
      }

      // Google OAuth simulation/flow for preview environment
      const promptEmail = `creator.${Math.random().toString(36).substring(2, 6)}@gmail.com`;
      const res = await safeFetchJson<{ user: User; isNewUser: boolean; message?: string }>(
        '/api/auth/google',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: promptEmail,
            displayName: 'Google Creator 🌸',
            avatarUrl:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            googleId: `g_${Date.now()}`
          })
        }
      );

      if (!res.success || !res.data?.user) {
        return {
          success: false,
          error: res.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
        };
      }

      persistSession(res.data.user);
      setIsAuthOpen(false);

      if (res.data.isNewUser) {
        setIsOnboardingOpen(true);
      }

      return { success: true, user: res.data.user, isNewUser: res.data.isNewUser };
    } catch (err: any) {
      console.error('Google login error:', err);
      return { success: false, error: formatFriendlyErrorMessage(err) };
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Guest Mode Flow
  const loginAsGuest = async (customName?: string): Promise<boolean> => {
    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      displayName: customName || 'นักเขียนนิรนาม 🌸 (Guest)',
      bio: 'บัญชี Guest ชั่วคราว — สามารถทดลองสร้างผลงานได้ 2 ชิ้น',
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

  // 5. Log Out Flow
  const logout = () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        supabase.auth.signOut().catch(() => {});
      } catch (e) {
        console.warn('Supabase signout catch:', e);
      }
    }

    const defaultGuest: User = {
      id: `guest_${Math.random().toString(36).substring(2, 9)}`,
      displayName: 'นักเขียนนิรนาม 🌸 (Guest)',
      bio: 'ยินดีต้อนรับสู่ Creator Vault! ทดลองสร้างและบันทึกผลงานได้ทันที',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isGuest: true,
      createdAt: new Date().toISOString(),
      provider: 'guest'
    };
    persistSession(defaultGuest);
  };

  // 6. Update Profile Flow (Saved to Supabase profiles & backend database)
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

    // Save to Supabase profiles table if configured
    const supabase = getSupabaseClient();
    if (supabase && !currentUser.isGuest) {
      try {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          display_name: updatedUser.displayName,
          bio: updatedUser.bio,
          avatar_url: updatedUser.avatarUrl,
          is_guest: false
        });
      } catch (supErr) {
        console.warn('Supabase profile sync error:', formatFriendlyErrorMessage(supErr));
      }
    }

    // Save to Server database
    try {
      await safeFetchJson(`/api/profiles/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('Could not sync profile to backend:', e);
    }

    return true;
  };

  // 7. Change Password Flow
  const changePassword = async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.isGuest) {
      return { success: false, error: 'คุณต้องเข้าสู่ระบบด้วยบัญชีสมาชิกเพื่อเปลี่ยนรหัสผ่าน' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const supRes = await supabase.auth.updateUser({
          password: newPass
        });
        if (supRes && !supRes.error) {
          return { success: true };
        }
      } catch (e) {
        console.warn('Supabase password update fallback:', formatFriendlyErrorMessage(e));
      }
    }

    try {
      const res = await safeFetchJson('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });

      if (!res.success) {
        return { success: false, error: res.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: formatFriendlyErrorMessage(err) };
    }
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
