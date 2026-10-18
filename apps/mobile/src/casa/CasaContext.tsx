import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase, traduzirErro } from "../lib/supabase";

export interface Casa {
  id: string;
  nome: string;
  codigo_convite: string;
}

export interface Membro {
  user_id: string;
  nome: string;
}

type Result = { error: string | null };

interface CasaContextValue {
  casa: Casa | null;
  membros: Membro[];
  /** Nome de quem está usando o app (como aparece nos lançamentos). */
  meuNome: string | null;
  loading: boolean;
  criarCasa: (nomeCasa: string, meuNome: string) => Promise<Result>;
  entrarNaCasa: (codigo: string, meuNome: string) => Promise<Result>;
  novoConvite: () => Promise<Result>;
  recarregar: () => Promise<void>;
}

const CasaContext = createContext<CasaContextValue | undefined>(undefined);

/**
 * A "casa" é o grupo (pessoa sozinha ou casal) dono de todos os dados.
 * Cada usuário participa de no máximo uma casa.
 */
export function CasaProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [casa, setCasa] = useState<Casa | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    if (!userId) {
      setCasa(null);
      setMembros([]);
      setLoading(false);
      return;
    }
    const { data: meu } = await supabase.from("membros").select("casa_id").eq("user_id", userId).maybeSingle();
    if (!meu) {
      setCasa(null);
      setMembros([]);
      setLoading(false);
      return;
    }
    const [{ data: casaRow }, { data: membrosRows }] = await Promise.all([
      supabase.from("casas").select("id, nome, codigo_convite").eq("id", meu.casa_id).single(),
      supabase.from("membros").select("user_id, nome").eq("casa_id", meu.casa_id).order("created_at"),
    ]);
    setCasa(casaRow ?? null);
    setMembros(membrosRows ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    recarregar();
  }, [recarregar]);

  // Quando o(a) parceiro(a) entra pelo convite, a lista de membros atualiza sozinha.
  useEffect(() => {
    if (!casa) return;
    const canal = supabase
      .channel(`membros-${casa.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "membros", filter: `casa_id=eq.${casa.id}` }, () => {
        recarregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [casa?.id, recarregar]);

  async function criarCasa(nomeCasa: string, meuNome: string): Promise<Result> {
    const { error } = await supabase.rpc("criar_casa", { p_nome_casa: nomeCasa, p_meu_nome: meuNome });
    if (error) return { error: traduzirErro(error.message) };
    await recarregar();
    return { error: null };
  }

  async function entrarNaCasa(codigo: string, meuNome: string): Promise<Result> {
    const { error } = await supabase.rpc("entrar_na_casa", { p_codigo: codigo, p_meu_nome: meuNome });
    if (error) return { error: traduzirErro(error.message) };
    await recarregar();
    return { error: null };
  }

  async function novoConvite(): Promise<Result> {
    if (!casa) return { error: "Sem casa" };
    const { data, error } = await supabase.rpc("novo_convite", { p_casa: casa.id });
    if (error) return { error: traduzirErro(error.message) };
    setCasa({ ...casa, codigo_convite: data as string });
    return { error: null };
  }

  const meuNome = membros.find((m) => m.user_id === userId)?.nome ?? null;

  return (
    <CasaContext.Provider value={{ casa, membros, meuNome, loading, criarCasa, entrarNaCasa, novoConvite, recarregar }}>
      {children}
    </CasaContext.Provider>
  );
}

export function useCasa(): CasaContextValue {
  const ctx = useContext(CasaContext);
  if (!ctx) throw new Error("useCasa deve ser usado dentro de CasaProvider");
  return ctx;
}
