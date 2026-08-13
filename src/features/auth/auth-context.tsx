import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

type AuthResult = { error: string | null; confirmationRequired?: boolean };

type AuthContextValue = {
  continueAsDemo: () => void;
  isDemo: boolean;
  loading: boolean;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthRedirect(path = "") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL(path, `${window.location.origin}/`).toString();
  }

  return Linking.createURL(path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) setIsDemo(false);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      continueAsDemo: () => setIsDemo(true),
      isDemo,
      loading,
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: createAuthRedirect("reset-password") },
        );
        return { error: error?.message ?? null };
      },
      session,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (session) await supabase.auth.signOut();
        setSession(null);
        setIsDemo(false);
      },
      signUp: async (fullName, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: createAuthRedirect(),
          },
        });
        return {
          error: error?.message ?? null,
          confirmationRequired: !error && !data.session,
        };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message ?? null };
      },
      user: session?.user ?? null,
    }),
    [isDemo, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
