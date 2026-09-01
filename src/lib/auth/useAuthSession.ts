import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { User } from '../../types';
import { getSupabaseClient } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { startAuthSessionBootstrap } from './authSessionBootstrap';

export interface AuthSessionState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  transitionToGuest: () => void;
}

export function useAuthSession(): AuthSessionState {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapRef = useRef<ReturnType<typeof startAuthSessionBootstrap> | null>(null);

  const transitionToGuest = useCallback(() => {
    const bootstrap = bootstrapRef.current;
    if (bootstrap) bootstrap.transitionToGuest();
    else setCurrentUser(null);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    const bootstrap = startAuthSessionBootstrap({
      auth: supabase.auth,
      getProfileSnapshot: userId => supabaseService.getProfileSnapshot(userId),
      loadProfile: userId => supabaseService.getProfile(userId),
      setCurrentUser,
      setLoading: setIsLoading
    });
    bootstrapRef.current = bootstrap;

    return () => {
      if (bootstrapRef.current === bootstrap) bootstrapRef.current = null;
      bootstrap.dispose();
    };
  }, []);

  return { currentUser, isLoading, setCurrentUser, transitionToGuest };
}
