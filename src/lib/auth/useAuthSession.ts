import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { User } from '../../types';
import { getSupabaseClient } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { startAuthSessionBootstrap } from './authSessionBootstrap';

export interface AuthSessionState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
}

export function useAuthSession(): AuthSessionState {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    const bootstrap = startAuthSessionBootstrap({
      auth: supabase.auth,
      loadProfile: userId => supabaseService.getProfile(userId),
      setCurrentUser,
      setLoading: setIsLoading
    });

    return () => {
      bootstrap.dispose();
    };
  }, []);

  return { currentUser, isLoading, setCurrentUser };
}
