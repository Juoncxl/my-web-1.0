import React, { createContext, useContext, useState } from 'react';
import type { AuthContextType, ProfileSocialLink } from '../types';
import { isGuestUser } from '../lib/accessPolicy';
import {
  changePassword as changePasswordAction,
  updateProfile as updateProfileAction
} from '../lib/auth/accountActions';
import {
  loginWithEmail as loginWithEmailAction,
  loginWithGoogle as loginWithGoogleAction,
  logout as logoutAction,
  signUpWithEmail as signUpWithEmailAction
} from '../lib/auth/authActions';
import { useAuthSession } from '../lib/auth/useAuthSession';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading, setCurrentUser } = useAuthSession();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'signup'>('login');

  const openAuthModal = (tab: 'login' | 'signup' = 'login') => {
    setAuthDefaultTab(tab);
    setIsAuthOpen(true);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    const result = await signUpWithEmailAction(email, pass);
    if (result.requiresEmailConfirmation) {
      setCurrentUser(null);
    } else if (result.success && result.user) {
      setCurrentUser(result.user);
      setIsAuthOpen(false);
      setIsOnboardingOpen(true);
    }
    return result;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const result = await loginWithEmailAction(email, pass);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      setIsAuthOpen(false);
    }
    return result;
  };

  const loginWithGoogle = async () => {
    return loginWithGoogleAction();
  };

  const logout = async (): Promise<void> => {
    // Disable account-only UI immediately, even if the network sign-out is slow.
    setCurrentUser(null);
    setIsSettingsOpen(false);
    await logoutAction();
  };

  const updateProfile = async (data: {
    displayName?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    socialLinks?: ProfileSocialLink[];
  }): Promise<{ success: boolean; user?: NonNullable<AuthContextType['currentUser']>; error?: string }> => {
    const result = await updateProfileAction(currentUser, data);
    if (!result.success) return { success: false, error: result.error };

    if (result.user) setCurrentUser(result.user);
    return { success: true, user: result.user };
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    return changePasswordAction(currentUser, currentPass, newPass);
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
