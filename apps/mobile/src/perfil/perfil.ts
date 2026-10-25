// Perfil da pessoa (tabela "contatos", só dela) e troca de senha.
// Precisam de internet: falam direto com a nuvem (não entram na fila do modo offline).
import { supabase, traduzirErro } from "../lib/supabase";

export interface Contato {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  aceita_novidades: boolean;
}

export async function carregarContato(userId: string): Promise<Contato | null> {
  const { data, error } = await supabase.from("contatos").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return { nome: data.nome, email: data.email, telefone: data.telefone, aceita_novidades: !!data.aceita_novidades };
}

export async function salvarContato(userId: string, c: Contato): Promise<string | null> {
  const { error } = await supabase.from("contatos").upsert({ user_id: userId, ...c }, { onConflict: "user_id" });
  if (!error) return null;
  if (/could not find the table|does not exist/i.test(error.message)) return "Falta rodar o SQL 16 no Supabase.";
  return traduzirErro(error.message);
}

export async function trocarSenha(nova: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (!error) return null;
  if (/different from the old/i.test(error.message)) return "A nova senha precisa ser diferente da atual.";
  return traduzirErro(error.message);
}

/** Máscara de telefone: (48) 99999-9999. */
export function mascaraTelefone(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
