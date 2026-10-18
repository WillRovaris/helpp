import { Linking, Share } from "react-native";
import type { Membro } from "../casa/CasaContext";
import { type Categoria, emojiCategoria, type Gasto } from "../data/tipos";
import { formatarReais, MESES } from "./format";

/** Texto do resumo do mês, formatado para WhatsApp (*negrito*). */
export function textoResumoMes(opts: {
  nomeCasa: string;
  ano: number;
  mes: number;
  gastos: Gasto[];
  categorias: Categoria[];
  membros: Membro[];
  renda: number | null;
}): string {
  const { gastos, categorias, membros, renda } = opts;
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const linhas: string[] = [`*Helpp — ${MESES[opts.mes]} ${opts.ano}*`, opts.nomeCasa, "", `💰 *Total gasto:* ${formatarReais(total)}`];

  if (renda && renda > 0) {
    const sobra = renda - total;
    linhas.push(`📥 Renda: ${formatarReais(renda)}`);
    linhas.push(sobra >= 0 ? `✅ *Sobra:* ${formatarReais(sobra)}` : `⚠️ *Passou:* ${formatarReais(-sobra)}`);
  }

  if (total > 0) {
    const somas = new Map<string | null, number>();
    for (const g of gastos) somas.set(g.categoria_id, (somas.get(g.categoria_id) ?? 0) + g.valor);
    const porId = new Map(categorias.map((c) => [c.id, c]));
    linhas.push("", "*Por categoria*");
    for (const [id, soma] of [...somas.entries()].sort((a, b) => b[1] - a[1])) {
      const cat = id ? porId.get(id) : undefined;
      linhas.push(`${emojiCategoria(cat?.icone)} ${cat?.nome ?? "Sem categoria"}: ${formatarReais(soma)} (${Math.round((soma / total) * 100)}%)`);
    }

    if (membros.length > 1) {
      linhas.push("", "*Quem pagou*");
      for (const m of membros) {
        const soma = gastos.filter((g) => g.pago_por === m.user_id).reduce((s, g) => s + g.valor, 0);
        linhas.push(`👤 ${m.nome}: ${formatarReais(soma)}`);
      }
    }
  }

  linhas.push("", `${gastos.length} ${gastos.length === 1 ? "lançamento" : "lançamentos"}`);
  return linhas.join("\n");
}

/** Abre o WhatsApp com o texto pronto; sem WhatsApp, cai no "Compartilhar" do celular. */
export async function enviarWhatsApp(texto: string): Promise<void> {
  try {
    await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`);
  } catch {
    await Share.share({ message: texto });
  }
}
