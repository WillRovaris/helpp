import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase, traduzirErro } from "../lib/supabase";
import { gravarLocal, gravarMeta, type Linha, lerMeta, linhas, obter, ouvirMudancas } from "../offline/banco";
import { atualizar } from "../offline/repo";

function paraCasa(l: Linha): Casa {
  const numeros = (o: unknown) => {
    const r: Record<string, number> = {};
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (v != null) r[k] = Number(v);
    return r;
  };
  return {
    id: l.id,
    nome: l.nome,
    codigo_convite: l.codigo_convite,
    renda_mensal: l.renda_mensal != null ? Number(l.renda_mensal) : null,
    rendas: numeros(l.rendas),
    saldos_iniciais: numeros(l.saldos_iniciais),
  };
}

export interface Casa {
  id: string;
  nome: string;
  codigo_convite: string;
  /** Renda mensal informada (opcional) — usada no "quanto sobra" do resumo. */
  renda_mensal: number | null;
  /** Renda de cada pessoa da casa (user_id → valor); `renda_mensal` é a soma. */
  rendas: Record<string, number>;
  /** Saldo do mês anterior corrigido à mão (YYYY-MM → valor); sem ajuste, é calculado (lib/saldo.ts). */
  saldos_iniciais: Record<string, number>;
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
  definirRenda: (valor: number | null, rendas?: Record<string, number>) => Promise<Result>;
  /** Corrige o saldo que veio do mês anterior (null = volta ao cálculo automático). */
  definirSaldoInicial: (mes: string, valor: number | null) => void;
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

  /** Mostra o que está guardado no celular (abre na hora, mesmo sem internet). */
  const lerDoCelular = useCallback((): boolean => {
    if (!userId) return false;
    const casaId = lerMeta(`casa:${userId}`);
    const local = casaId ? obter("casas", casaId) : undefined;
    if (!local) return false;
    setCasa(paraCasa(local));
    setMembros(
      linhas("membros")
        .filter((m) => m.casa_id === casaId)
        .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
        .map((m) => ({ user_id: m.user_id, nome: m.nome })),
    );
    return true;
  }, [userId]);

  const recarregar = useCallback(async () => {
    if (!userId) {
      setCasa(null);
      setMembros([]);
      setLoading(false);
      return;
    }
    if (lerDoCelular()) setLoading(false);
    const { data: meu, error: erroMeu } = await supabase.from("membros").select("casa_id").eq("user_id", userId).maybeSingle();
    // Falha de rede: mantém o que já estava na tela (não manda a pessoa de volta
    // para "Começar" achando que ela não tem casa).
    if (erroMeu) {
      setLoading(false);
      return;
    }
    if (!meu) {
      gravarMeta(`casa:${userId}`, null);
      setCasa(null);
      setMembros([]);
      setLoading(false);
      return;
    }
    const [{ data: casaRow, error: erroCasa }, { data: membrosRows }] = await Promise.all([
      // "*" em vez de colunas fixas: se o SQL da renda (02-renda.sql) ainda não
      // rodou, a coluna só não vem — em vez de dar erro e "perder" a casa.
      supabase.from("casas").select("*").eq("id", meu.casa_id).single(),
      supabase.from("membros").select("*").eq("casa_id", meu.casa_id).order("created_at"),
    ]);
    if (erroCasa || !casaRow) {
      setLoading(false);
      return;
    }
    // guarda no celular para abrir sem internet da próxima vez
    gravarLocal("casas", [casaRow]);
    if (membrosRows) gravarLocal("membros", membrosRows);
    gravarMeta(`casa:${userId}`, casaRow.id);
    setCasa(paraCasa(casaRow));
    if (membrosRows) setMembros(membrosRows.map((m) => ({ user_id: m.user_id, nome: m.nome })));
    setLoading(false);
  }, [userId, lerDoCelular]);

  // Mudanças que chegam pela sincronização (ex.: renda alterada no outro celular).
  useEffect(
    () =>
      ouvirMudancas((t) => {
        if (t === "casas" || t === "membros") lerDoCelular();
      }),
    [lerDoCelular],
  );

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "casas", filter: `id=eq.${casa.id}` }, () => {
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

  async function definirRenda(valor: number | null, rendas: Record<string, number> = {}): Promise<Result> {
    if (!casa) return { error: "Sem casa" };
    // grava no celular e sobe na próxima sincronização (funciona sem internet)
    atualizar("casas", casa.id, { renda_mensal: valor, rendas });
    setCasa({ ...casa, renda_mensal: valor, rendas });
    return { error: null };
  }

  function definirSaldoInicial(mes: string, valor: number | null) {
    if (!casa) return;
    const saldos_iniciais = { ...casa.saldos_iniciais };
    if (valor == null) delete saldos_iniciais[mes];
    else saldos_iniciais[mes] = valor;
    atualizar("casas", casa.id, { saldos_iniciais });
    setCasa({ ...casa, saldos_iniciais });
  }

  const meuNome = membros.find((m) => m.user_id === userId)?.nome ?? null;

  return (
    <CasaContext.Provider value={{ casa, membros, meuNome, loading, criarCasa, entrarNaCasa, novoConvite, definirRenda, definirSaldoInicial, recarregar }}>
      {children}
    </CasaContext.Provider>
  );
}

export function useCasa(): CasaContextValue {
  const ctx = useContext(CasaContext);
  if (!ctx) throw new Error("useCasa deve ser usado dentro de CasaProvider");
  return ctx;
}
