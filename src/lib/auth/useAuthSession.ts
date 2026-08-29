import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../../types';
import { getSupabaseClient } from '../supabaseClient';
import { supabaseService } from '../supabaseService';
import { mapSupabaseAuthUser } from './authUserMapper';

export interface AuthSessionState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export function useAuthSession(): AuthSessionState {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        setCurrentUser(mapSupabaseAuthUser(authUser, profile));
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

  return { currentUser, isLoading, setCurrentUser, setIsLoading };
}
