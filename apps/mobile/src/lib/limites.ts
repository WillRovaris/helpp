// Limite de gasto por mês em cada categoria (pedido do dono): barra colorida e aviso
// quando a despesa lançada faz a categoria chegar em 80% ou passar do limite.
import { formatarReais } from "./format";

export type NivelLimite = "ok" | "atencao" | "passou";

/** Até 80%: ok · de 80% até 100%: atenção · acima de 100%: passou. */
export function nivelLimite(gasto: number, limite: number): NivelLimite {
  if (limite <= 0) return "ok";
  const f = gasto / limite;
  return f > 1 ? "passou" : f >= 0.8 ? "atencao" : "ok";
}

/** Aviso só quando a despesa cruza uma faixa (80% ou o limite); senão, null. */
export function avisoLimite(nome: string, antes: number, depois: number, limite: number): { titulo: string; texto: string } | null {
  if (limite <= 0 || depois <= antes) return null;
  const nivelAntes = nivelLimite(antes, limite);
  const nivelDepois = nivelLimite(depois, limite);
  if (nivelAntes === nivelDepois) return null;
  const pct = Math.round((depois / limite) * 100);
  if (nivelDepois === "passou") {
    return {
      titulo: `🚨 ${nome} passou do limite`,
      texto: `Já foram ${formatarReais(depois)} de ${formatarReais(limite)} este mês (${pct}%). Passou ${formatarReais(depois - limite)}.`,
    };
  }
  return {
    titulo: `⚠️ ${nome} chegou a ${pct}% do limite`,
    texto: `Já foram ${formatarReais(depois)} de ${formatarReais(limite)} este mês. Restam ${formatarReais(limite - depois)}.`,
  };
}
