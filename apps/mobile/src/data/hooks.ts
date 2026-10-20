import { useCallback, useEffect, useState } from "react";
import { useCasa } from "../casa/CasaContext";
import { limitesDoMes } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { Cartao, Categoria, Gasto } from "./tipos";

/**
 * Busca uma lista da casa e mantém atualizada em tempo real: quando o outro
 * celular grava algo na mesma tabela, a lista recarrega sozinha.
 */
function useListaAoVivo<T>(tabela: string, buscar: (casaId: string) => PromiseLike<{ data: T[] | null }>, deps: unknown[]) {
  const { casa } = useCasa();
  const [itens, setItens] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    if (!casa) return;
    const { data } = await buscar(casa.id);
    setItens(data ?? []);
    setCarregando(false);
  }, [casa?.id, ...deps]);

  useEffect(() => {
    if (!casa) return;
    recarregar();
    const canal = supabase
      .channel(`${tabela}-${casa.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabela, filter: `casa_id=eq.${casa.id}` }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [casa?.id, recarregar, tabela]);

  return { itens, carregando, recarregar };
}

export function useCategorias() {
  const { itens, ...resto } = useListaAoVivo<Categoria>(
    "categorias",
    (casaId) => supabase.from("categorias").select("id, nome, icone, cor, ordem").eq("casa_id", casaId).eq("arquivada", false).order("ordem"),
    [],
  );
  return { categorias: itens, ...resto };
}

export function useCartoes() {
  const { itens, ...resto } = useListaAoVivo<Cartao>(
    "cartoes",
    (casaId) =>
      supabase.from("cartoes").select("id, nome, limite, dia_fechamento, dia_vencimento").eq("casa_id", casaId).eq("arquivado", false).order("created_at"),
    [],
  );
  return { cartoes: itens.map((c) => ({ ...c, limite: Number(c.limite) })), ...resto };
}

/** Gastos de um mês (mes = 0–11), mais recentes primeiro. */
export function useGastosDoMes(ano: number, mes: number) {
  const { inicio, fim } = limitesDoMes(ano, mes);
  const { itens, ...resto } = useListaAoVivo<Gasto>(
    "gastos",
    (casaId) =>
      supabase
        .from("gastos")
        // "*": inclui as colunas de parcela quando o SQL 03 já rodou, sem quebrar antes disso.
        .select("*")
        .eq("casa_id", casaId)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
    [inicio, fim],
  );
  return { gastos: itens.map((g) => ({ ...g, valor: Number(g.valor) })), ...resto };
}

/**
 * Gastos no crédito de todos os cartões, de ~3 meses atrás em diante (inclui
 * parcelas futuras) — o suficiente para fatura aberta, fechada e limite usado.
 */
export function useGastosCredito(desde: string) {
  const { itens, ...resto } = useListaAoVivo<Gasto>(
    "gastos",
    (casaId) =>
      supabase
        .from("gastos")
        .select("*")
        .eq("casa_id", casaId)
        .not("cartao_id", "is", null)
        .gte("data", desde)
        .order("data", { ascending: false }),
    [desde],
  );
  return { gastosCredito: itens.map((g) => ({ ...g, valor: Number(g.valor) })), ...resto };
}
