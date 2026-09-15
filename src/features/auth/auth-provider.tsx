import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getAuthSession,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
  subscribeAuth,
  type AuthSession,
  type AuthUser,
} from '@/services/backend';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const failSafe = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 8000);

    getAuthSession()
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null);
          setIsLoading(false);
        }
      })
      .finally(() => {
        clearTimeout(failSafe);
      });

    const unsubscribe = subscribeAuth((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      clearTimeout(failSafe);
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const data = await signUpWithPassword(email, password, fullName);
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [session, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
