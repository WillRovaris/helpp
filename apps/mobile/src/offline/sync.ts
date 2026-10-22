// Sincronização celular ⇄ nuvem.
// 1) ENVIA a fila (o que foi gravado no celular), na ordem em que aconteceu.
// 2) TRAZ da nuvem só o que mudou desde a última vez (updated_at) e o que foi
//    excluído no outro celular (tabela "exclusoes").
// Sem internet: para no primeiro erro de rede e tenta de novo depois.
import { supabase } from "../lib/supabase";
import {
  apagarLocal,
  enfileirar,
  gravarLocal,
  gravarMeta,
  idDe,
  lerFila,
  lerMeta,
  type Linha,
  obter,
  type Operacao,
  substituirTabela,
  type Tabela,
  TABELAS,
  tirarDaFila,
} from "./banco";

export interface ResultadoSync {
  online: boolean;
  /** Despesas novas lançadas por outra pessoa da casa (para o aviso "🔄 N novas"). */
  novasDeOutros: Linha[];
}

type ErroSupabase = { message: string; code?: string } | null;

function ehErroDeRede(e: ErroSupabase | unknown): boolean {
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  return /network|fetch|timeout|internet|abort|failed to connect/i.test(msg);
}

class SemInternet extends Error {}

// ------------------------------------------------------------ envio

async function executar(op: Operacao): Promise<void> {
  let erro: ErroSupabase = null;
  if (op.op === "inserir") {
    ({ error: erro } = await supabase.from(op.tabela).insert(op.dados));
    // Já existe na nuvem (ex.: o outro celular registrou a mesma conta paga): fica a versão da nuvem.
    if (erro?.code === "23505") {
      apagarLocal(op.tabela, [idDe(op.tabela, op.dados)]);
      // Conta fixa paga nos dois celulares: a despesa deste pagamento repetido também sai.
      if (op.tabela === "contas_pagamentos" && op.dados.gasto_id) {
        apagarLocal("gastos", [op.dados.gasto_id]);
        enfileirar({ op: "excluir", tabela: "gastos", dados: { ids: [op.dados.gasto_id] } });
      }
      return;
    }
  } else if (op.op === "atualizar") {
    ({ error: erro } = await supabase.from(op.tabela).update(op.dados.campos).eq(op.tabela === "membros" ? "user_id" : "id", op.dados.id));
  } else {
    ({ error: erro } = await supabase.from(op.tabela).delete().in(op.tabela === "membros" ? "user_id" : "id", op.dados.ids));
  }
  if (!erro) return;
  if (ehErroDeRede(erro)) throw new SemInternet(erro.message);
  // Erro definitivo (permissão, coluna que não existe…): desfaz no celular para não ficar diferente da nuvem.
  console.warn(`[sync] ${op.op} ${op.tabela} recusado:`, erro.message);
  if (op.op === "inserir") apagarLocal(op.tabela, [idDe(op.tabela, op.dados)]);
}

async function enviarFila(): Promise<void> {
  // Repete enquanto houver fila: um envio pode gerar outra operação (ex.: desfazer despesa repetida).
  for (let passada = 0; passada < 5; passada++) {
    const fila = lerFila();
    if (!fila.length) return;
    for (const op of fila) {
      try {
        await executar(op);
      } catch (e) {
        if (e instanceof SemInternet || ehErroDeRede(e)) throw new SemInternet(String(e));
        console.warn("[sync] operação descartada:", e);
      }
      tirarDaFila(op.seq!);
    }
  }
}

// ------------------------------------------------------------ recebimento

const POR_PAGINA = 1000;

function consultaDaCasa(t: Tabela, casaId: string) {
  const q = supabase.from(t).select("*");
  return t === "casas" ? q.eq("id", casaId) : q.eq("casa_id", casaId);
}

function daCasa(t: Tabela, casaId: string) {
  return (l: Linha) => (t === "casas" ? l.id === casaId : l.casa_id === casaId);
}

/** Traz tudo da tabela (primeira vez, ou se a nuvem ainda não tem updated_at). */
async function trazerTudo(t: Tabela, casaId: string): Promise<Linha[]> {
  const todas: Linha[] = [];
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await consultaDaCasa(t, casaId).range(de, de + POR_PAGINA - 1);
    if (error) {
      if (ehErroDeRede(error)) throw new SemInternet(error.message);
      throw error;
    }
    todas.push(...(data ?? []));
    if (!data || data.length < POR_PAGINA) break;
  }
  return todas;
}

/** Traz o que mudou desde o último "updated_at" visto. Retorna as linhas que não existiam no celular. */
async function trazerMudancas(t: Tabela, casaId: string): Promise<Linha[]> {
  const chave = `cursor:${casaId}:${t}`;
  const cursor = lerMeta(chave);

  if (!cursor) {
    const todas = await trazerTudo(t, casaId);
    substituirTabela(t, todas, daCasa(t, casaId));
    const maior = todas.reduce<string | null>((m, l) => (l.updated_at && (!m || l.updated_at > m) ? l.updated_at : m), null);
    // Tabela vazia na nuvem: marca o "começo dos tempos" para as próximas virem como novidade.
    gravarMeta(chave, maior ?? "1970-01-01T00:00:00Z");
    return []; // primeira carga: não conta como "novidade"
  }

  const mudadas: Linha[] = [];
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await consultaDaCasa(t, casaId).gte("updated_at", cursor).order("updated_at").range(de, de + POR_PAGINA - 1);
    if (error) {
      if (ehErroDeRede(error)) throw new SemInternet(error.message);
      if (error.code === "42703") {
        // nuvem sem updated_at (SQL 10 ainda não rodou): troca a tabela inteira
        substituirTabela(t, await trazerTudo(t, casaId), daCasa(t, casaId));
        return [];
      }
      throw error;
    }
    mudadas.push(...(data ?? []));
    if (!data || data.length < POR_PAGINA) break;
  }
  const novas = mudadas.filter((l) => !obter(t, idDe(t, l)));
  gravarLocal(t, mudadas);
  const maior = mudadas.reduce<string>((m, l) => (l.updated_at && l.updated_at > m ? l.updated_at : m), cursor);
  gravarMeta(chave, maior);
  return novas;
}

/** Exclusões feitas no outro celular. */
async function trazerExclusoes(casaId: string): Promise<void> {
  const chave = `exclusoes:${casaId}`;
  const ultimo = Number(lerMeta(chave) ?? "0");
  const { data, error } = await supabase.from("exclusoes").select("id, tabela, registro_id").eq("casa_id", casaId).gt("id", ultimo).order("id").limit(5000);
  if (error) {
    if (ehErroDeRede(error)) throw new SemInternet(error.message);
    return; // tabela ainda não existe (SQL 10): as exclusões chegam pela troca da tabela inteira
  }
  if (!data?.length) return;
  const porTabela = new Map<Tabela, string[]>();
  for (const e of data) {
    if (!TABELAS.includes(e.tabela as Tabela)) continue;
    const lista = porTabela.get(e.tabela as Tabela) ?? [];
    lista.push(String(e.registro_id));
    porTabela.set(e.tabela as Tabela, lista);
  }
  for (const [t, ids] of porTabela) apagarLocal(t, ids);
  gravarMeta(chave, String(data[data.length - 1].id));
}

// ------------------------------------------------------------ ciclo completo

let emAndamento: Promise<ResultadoSync> | null = null;

export function sincronizar(casaId: string, meuId: string | null): Promise<ResultadoSync> {
  if (!emAndamento) {
    emAndamento = (async () => {
      try {
        await enviarFila();
        const novasDeOutros: Linha[] = [];
        for (const t of TABELAS) {
          const novas = await trazerMudancas(t, casaId);
          if (t === "gastos") novasDeOutros.push(...novas.filter((g) => g.created_by && g.created_by !== meuId));
        }
        await trazerExclusoes(casaId);
        gravarMeta(`ultima_sync:${casaId}`, new Date().toISOString());
        return { online: true, novasDeOutros };
      } catch (e) {
        if (!(e instanceof SemInternet) && !ehErroDeRede(e)) console.warn("[sync] falhou:", e);
        return { online: false, novasDeOutros: [] };
      } finally {
        emAndamento = null;
      }
    })();
  }
  return emAndamento;
}
