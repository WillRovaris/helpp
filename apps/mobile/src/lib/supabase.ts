import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Chave "publishable": pode ficar no app. A proteção dos dados é feita pelo
// RLS no banco (supabase/01-home-finance.sql) — cada casa só vê o que é dela.
const SUPABASE_URL = "https://tpsytskbvcousydgpnlp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oxCkYng84OKEbxywHhw9Uw_sk0oLIzW";

/**
 * Toda chamada à nuvem desiste depois de 20 s. Sem isso, quando a internet cai
 * e volta, uma requisição pode ficar esperando para sempre e travar a sincronização.
 */
const fetchComLimite: typeof fetch = (entrada, opcoes) => {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 20_000);
  opcoes?.signal?.addEventListener("abort", () => controle.abort());
  return fetch(entrada, { ...opcoes, signal: controle.signal }).finally(() => clearTimeout(limite));
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchComLimite },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Mensagens do Supabase em português (as mais comuns). */
export function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja a caixa de entrada).";
  if (m.includes("user already registered")) return "Já existe uma conta com esse e-mail. Use \"Entrar\".";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid format")) return "E-mail inválido.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("network request failed") || m.includes("fetch")) return "Sem conexão com a internet.";
  return message;
}
