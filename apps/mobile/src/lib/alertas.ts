// Alertas espertos: o app percebe sozinho o que merece atenção.
//  - categoria acima da média dos últimos meses (ou num ritmo bem acima do normal);
//  - possível cobrança repetida (mesmo valor e descrição em poucos dias).

export interface Alerta {
  /** Fixo para o mesmo assunto (o ✕ esconde só este). */
  id: string;
  emoji: string;
  titulo: string;
  texto: string;
  /** Para abrir a tela certa ao tocar. */
  categoriaId?: string;
  gastoId?: string;
}

const real = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/**
 * @param atual gasto do mês atual por categoria (até hoje)
 * @param anteriores gasto por categoria em cada um dos meses anteriores (os que têm lançamentos)
 */
export function alertasDeCategoria(
  mes: string,
  atual: Map<string, number>,
  anteriores: Map<string, number>[],
  nomes: Map<string, { nome: string; emoji: string }>,
  dia: number,
  diasNoMes: number,
  /** Formata valor (a tela passa o do modo privacidade). */
  fmt: (v: number) => string = real,
): Alerta[] {
  if (anteriores.length < 2) return []; // pouco histórico para comparar
  const lista: Alerta[] = [];
  for (const [cat, valor] of atual) {
    const info = nomes.get(cat);
    if (!info) continue;
    const media = anteriores.reduce((s, m) => s + (m.get(cat) ?? 0), 0) / anteriores.length;
    if (media < 50) continue;
    const pct = Math.round((valor / media - 1) * 100);
    if (valor > media * 1.15) {
      lista.push({
        id: `media:${mes}:${cat}`,
        emoji: info.emoji,
        titulo: `${info.nome} passou da média`,
        texto: `Já foram ${fmt(valor)} este mês — ${pct}% acima da média de ${fmt(media)} dos últimos meses.`,
        categoriaId: cat,
      });
    } else if (dia >= 5) {
      const esperado = media * (dia / diasNoMes);
      if (valor >= 100 && valor > esperado * 1.5) {
        lista.push({
          id: `ritmo:${mes}:${cat}`,
          emoji: info.emoji,
          titulo: `${info.nome} em ritmo acelerado`,
          texto: `${fmt(valor)} até o dia ${dia}. No ritmo normal seriam uns ${fmt(esperado)} — atenção para não passar da média de ${fmt(media)}.`,
          categoriaId: cat,
        });
      }
    }
  }
  return lista;
}

export interface GastoParaRepetido {
  id: string;
  valor: number;
  data: string;
  descricao: string | null;
  cartao_id: string | null;
  parcelamento_id?: string | null;
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const diasEntre = (a: string, b: string) => Math.abs((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86400000);

/** Mesmo valor, mesma descrição e mesmo cartão/forma em até 3 dias: pode ser cobrança em dobro. */
export function alertasRepetidos(gastos: GastoParaRepetido[], desde: string, fmt: (v: number) => string = real): Alerta[] {
  const recentes = gastos.filter((g) => g.data >= desde && g.valor >= 5 && g.descricao && !g.parcelamento_id);
  const lista: Alerta[] = [];
  const usados = new Set<string>();
  for (let i = 0; i < recentes.length; i++) {
    const a = recentes[i];
    if (usados.has(a.id)) continue;
    for (let j = i + 1; j < recentes.length; j++) {
      const b = recentes[j];
      if (usados.has(b.id)) continue;
      if (a.valor !== b.valor || (a.cartao_id ?? "") !== (b.cartao_id ?? "")) continue;
      if (normalizar(a.descricao!) !== normalizar(b.descricao!) || diasEntre(a.data, b.data) > 3) continue;
      usados.add(a.id);
      usados.add(b.id);
      const [x, y] = [a.id, b.id].sort();
      lista.push({
        id: `repetido:${x}:${y}`,
        emoji: "🔁",
        titulo: "Possível cobrança repetida",
        texto: `"${a.descricao}" de ${fmt(a.valor)} aparece duas vezes (${a.data.split("-").reverse().slice(0, 2).join("/")} e ${b.data
          .split("-")
          .reverse()
          .slice(0, 2)
          .join("/")}). Confira se não foi cobrado em dobro.`,
        gastoId: b.id,
      });
      break;
    }
  }
  return lista;
}
