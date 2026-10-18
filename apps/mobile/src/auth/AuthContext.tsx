import type { Session } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, traduzirErro } from "../lib/supabase";

type Result = { error: string | null };

interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /** `precisaConfirmar` = o Supabase exige confirmar o e-mail antes de entrar. */
  signUp: (email: string, password: string) => Promise<Result & { precisaConfirmar: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<Result> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? traduzirErro(error.message) : null };
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: traduzirErro(error.message), precisaConfirmar: false };
    return { error: null, precisaConfirmar: !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, userId: session?.user.id ?? null, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
