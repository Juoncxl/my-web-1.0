import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { User } from '../../types';
import { cxlAuthService } from '../../data/cxlAuthService';

export interface AuthSessionState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  transitionToGuest: () => void;
}

export function useAuthSession(): AuthSessionState {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapRef = useRef<ReturnType<typeof cxlAuthService.createSessionBootstrap> | null>(null);

  const transitionToGuest = useCallback(() => {
    const bootstrap = bootstrapRef.current;
    if (bootstrap) bootstrap.transitionToGuest();
    else setCurrentUser(null);
  }, []);

  useEffect(() => {
    const bootstrap = cxlAuthService.createSessionBootstrap({ setCurrentUser, setLoading: setIsLoading });
    if (!bootstrap) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }
    bootstrapRef.current = bootstrap;

    return () => {
      if (bootstrapRef.current === bootstrap) bootstrapRef.current = null;
      bootstrap.dispose();
    };
  }, []);

  return { currentUser, isLoading, setCurrentUser, transitionToGuest };
}
