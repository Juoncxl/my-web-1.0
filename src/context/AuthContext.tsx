import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'creator_vault_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session on mount
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        setCurrentUser(parsed);
      } else {
        // Default: Create or initialize a friendly Guest session if none exists
        const defaultGuest: User = {
          id: `guest_${Math.random().toString(36).substring(2, 9)}`,
          displayName: 'นักเขียนนิรนาม 🌸 (Guest)',
          bio: 'ยินดีต้อนรับสู่ Creator Vault! ทดลองสร้างและบันทึกผลงานได้ทันที',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isGuest: true,
          createdAt: new Date().toISOString()
        };
        setCurrentUser(defaultGuest);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(defaultGuest));
      }
    } catch (e) {
      console.error('Failed to parse user session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login with Email & Password
  const loginWithEmail = async (email: string, _pass: string, customName?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Check if Supabase is active
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: _pass
          });
          if (error) {
            // If sign in fails, try sign up
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password: _pass,
              options: {
                data: {
                  displayName: customName || email.split('@')[0]
                }
              }
            });
            if (signUpError) throw signUpError;
            if (signUpData.user) {
              const u: User = {
                id: signUpData.user.id,
                email: signUpData.user.email,
                displayName: customName || email.split('@')[0],
                bio: 'นักสร้างบอทและนักเขียน ✦ Creator Vault Member',
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
                isGuest: false,
                createdAt: signUpData.user.created_at || new Date().toISOString()
              };
              setCurrentUser(u);
              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(u));
              return true;
            }
          } else if (data.user) {
            const u: User = {
              id: data.user.id,
              email: data.user.email,
              displayName: customName || data.user.user_metadata?.displayName || email.split('@')[0],
              bio: data.user.user_metadata?.bio || 'นักสร้างบอทและนักเขียน ✦ Creator Vault Member',
              avatarUrl: data.user.user_metadata?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
              isGuest: false,
              createdAt: data.user.created_at || new Date().toISOString()
            };
            setCurrentUser(u);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(u));
            return true;
          }
        } catch (supabaseErr) {
          console.warn('Supabase auth fallback to local/server auth:', supabaseErr);
        }
      }

      // Local / Express Server Auth Fallback
      const normalizedId = `user_${btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}`;
      const newUser: User = {
        id: normalizedId,
        email,
        displayName: customName || email.split('@')[0],
        bio: 'นักสร้างบอทและนักเขียน ✦ Creator Vault Member',
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        isGuest: false,
        createdAt: new Date().toISOString()
      };

      // Sync with server
      await fetch(`/api/users/${newUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      }).catch(() => {});

      setCurrentUser(newUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login as Guest (Anonymous)
  const loginAsGuest = async (customName?: string): Promise<boolean> => {
    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      displayName: customName || 'นักเขียนนิรนาม 🌸 (Guest)',
      bio: 'บัญชี Guest ชั่วคราว — สามารถสร้างและบันทึกผลงานได้ทันที',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      isGuest: true,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(guestUser);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(guestUser));
    return true;
  };

  const logout = () => {
    const defaultGuest: User = {
      id: `guest_${Math.random().toString(36).substring(2, 9)}`,
      displayName: 'นักเขียนนิรนาม 🌸 (Guest)',
      bio: 'ยินดีต้อนรับสู่ Creator Vault! ทดลองสร้างและบันทึกผลงานได้ทันที',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isGuest: true,
      createdAt: new Date().toISOString()
    };
    setCurrentUser(defaultGuest);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(defaultGuest));
  };

  const updateProfile = async (data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<boolean> => {
    if (!currentUser) return false;

    const updatedUser: User = {
      ...currentUser,
      displayName: data.displayName !== undefined ? data.displayName : currentUser.displayName,
      bio: data.bio !== undefined ? data.bio : currentUser.bio,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatarUrl
    };

    setCurrentUser(updatedUser);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedUser));

    // Send update to server
    try {
      await fetch(`/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('Could not sync profile to backend:', e);
    }

    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        loginWithEmail,
        loginAsGuest,
        logout,
        updateProfile,
        isAuthenticated: !!currentUser && !currentUser.isGuest
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
