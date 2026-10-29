import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createLocalGuestUser, signInAnonymously, signOut } from '../api/auth';

interface AuthContextValue {
  user: User;
  isLocalGuest: boolean;
  resetGuestSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  initialUser: User;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState(initialUser);

  const resetGuestSession = useCallback(async () => {
    try {
      await signOut();
      const guest = await signInAnonymously();
      setUser(guest);
    } catch (error) {
      console.warn(
        '[auth] Yeni sunucu misafir oturumu açılamadı; yerel misafir oturumu kullanılıyor:',
        error instanceof Error ? error.message : String(error),
      );
      setUser(createLocalGuestUser());
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLocalGuest: user.id === 'local-guest', resetGuestSession }),
    [user, resetGuestSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içerisinde kullanılmalıdır.');
  }
  return context;
}
