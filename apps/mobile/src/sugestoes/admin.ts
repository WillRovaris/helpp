// Sugestões recebidas de TODAS as casas (só a equipe do Helpp; a regra está no banco, SQL 27).
// Precisam de internet: falam direto com a nuvem (não entram na fila do modo offline).
import { supabase, traduzirErro } from "../lib/supabase";

export type SituacaoSugestao = "nova" | "analisando" | "planejada" | "feita" | "recusada";

export const SITUACOES: { id: SituacaoSugestao; rotulo: string }[] = [
  { id: "nova", rotulo: "🆕 Nova" },
  { id: "analisando", rotulo: "🔍 Em análise" },
  { id: "planejada", rotulo: "📅 Planejada" },
  { id: "feita", rotulo: "✅ Feita" },
  { id: "recusada", rotulo: "🚫 Não vamos fazer" },
];

export const rotuloSituacao = (s: string | null | undefined) => SITUACOES.find((x) => x.id === s)?.rotulo ?? "🆕 Nova";

export interface SugestaoRecebida {
  id: string;
  texto: string;
  status: SituacaoSugestao;
  resposta: string | null;
  feita: boolean;
  created_at: string;
  versao_app: string | null;
  dispositivo: string | null;
  casa_nome: string | null;
  autor_nome: string | null;
  autor_email: string | null;
}

/** true só para as contas do dono do app. Sem internet ou sem o SQL 27, false. */
export async function souAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("sou_admin");
  return !error && data === true;
}

export async function carregarRecebidas(): Promise<{ lista: SugestaoRecebida[]; erro: string | null }> {
  const { data, error } = await supabase.rpc("sugestoes_recebidas");
  if (error) return { lista: [], erro: /could not find the function/i.test(error.message) ? "Falta rodar o SQL 27 no Supabase." : traduzirErro(error.message) };
  return { lista: (data ?? []) as SugestaoRecebida[], erro: null };
}

export async function responder(id: string, status: SituacaoSugestao, resposta: string): Promise<string | null> {
  const { error } = await supabase.rpc("responder_sugestao", { p_id: id, p_status: status, p_resposta: resposta });
  return error ? traduzirErro(error.message) : null;
}
