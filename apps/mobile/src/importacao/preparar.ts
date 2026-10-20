// Transforma os lançamentos lidos do arquivo em itens prontos para importar:
// separa saídas (gastos) de entradas, sugere categoria e forma de pagamento,
// marca o que parece já lançado e sugere dar baixa em contas fixas.
// Sem dependências de React Native, para poder testar no computador.

import type { LancamentoArquivo } from "./leitor";
import { normalizar } from "./leitor";

export type TipoArquivo = "extrato" | "fatura";

export interface ItemImportacao {
  id: string;
  /** Data que vai para o gasto (na fatura, ajustada para cair na fatura escolhida). */
  data: string;
  dataOriginal: string;
  descricao: string;
  valor: number; // sempre positivo
  parcela: string | null;
  iconeSugerido: string;
  forma: "pix" | "debito" | "credito";
  incluir: boolean;
  /** Por que veio desmarcado / aviso para a pessoa. */
  aviso: string | null;
  jaImportado: boolean;
  contaBaixa: { contaId: string; nome: string; competencia: string; porNome: boolean } | null;
}

/** "Renner - Parcela 3/5" → "Renner" (a parcela é guardada à parte e o app mostra "(3/5)"). */
export function descricaoSemParcela(desc: string): string {
  const limpa = desc
    .replace(/\s*[-–]?\s*parc(ela)?\.?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\b/i, "")
    .replace(/\s+\d{1,2}\/\d{1,2}$/, "")
    .trim();
  return limpa || desc;
}

export interface ResultadoPreparo {
  itens: ItemImportacao[];
  /** Entradas (extrato) ou pagamentos/estornos (fatura) que não viram gasto. */
  ignorados: number;
}

// Palavras na descrição → ícone da categoria (o app mapeia ícone → categoria da casa).
const REGRAS_CATEGORIA: [RegExp, string][] = [
  [/limite convertido|convers(ao|ão) de limite|emprestimo|credito pessoal|consignado|financiamento|antecipacao|refinanciamento/, "cash"],
  [/supermerc|mercado|atacad|hortifruti|acougue|padaria|assai|carrefour|koch|giassi|angeloni|fort atacad|bistek|komprao/, "cart"],
  [/ifood|restaur|lanch|pizza|burger|mc ?donald|\bbk\b|subway|cafe|\bbar\b|churrasc|sushi|rappi|ze delivery/, "restaurant"],
  [/posto|combust|shell|ipiranga|petrobras|br mania|uber|99 ?app|99pop|estaciona|pedagio|sem parar|conectcar|onibus|passagem urb/, "car"],
  [/farmac|drogar|\bdroga\b|raia|pague menos|panvel|hospital|clinica|laborat|unimed|odonto|medic|saude/, "medkit"],
  [/escola|colegio|faculdade|universid|curso|livraria|papelaria|material escolar|mensalidade/, "school"],
  [/renner|riachuelo|c&a|cea |zara|shein|hering|marisa|calcad|sapat|roupa|moda|centauro|netshoes/, "shirt"],
  [/hotel|pousada|airbnb|booking|decolar|latam|gol linhas|azul linhas|aeroporto|rodoviaria|viagem|123milhas/, "airplane"],
  [/pet ?shop|petz|cobasi|veterin|racao/, "paw"],
  [/netflix|spotify|disney|hbo|max\.com|prime video|youtube|cinema|ingresso|steam|playstation|xbox|show|teatro/, "game-controller"],
  [/celesc|copel|cemig|enel|energia|luz|casan|sabesp|agua|saneamento|vivo|claro|\btim\b|\boi\b|internet|net servicos|telefon|\bgas\b|condominio|aluguel|iptu|ipva|seguro|boleto|conta/, "receipt"],
  [/magazine|magalu|casas bahia|leroy|tok ?stok|madeira|construc|material de constr|eletro|moveis|americanas|mercado ?livre|amazon/, "home"],
  [/presente|floricultura|flores/, "gift"],
];

export function sugerirIcone(descricao: string): string {
  const d = ` ${normalizar(descricao)} `;
  for (const [re, icone] of REGRAS_CATEGORIA) if (re.test(d)) return icone;
  return "ellipsis-horizontal";
}

/** Pagamento de fatura no extrato: a compra já é contada no cartão, então não vira gasto de novo. */
const PAGAMENTO_FATURA = /pagamento (de )?fatura|pgto\.? ?(cartao|fatura)|pag(amento)? cartao|fatura cartao|cartao de credito|ourocard|nu pagamentos|pagamento nubank|c6 ?(bank)? ?fatura|digio fatura/;
/** Na fatura: pagamentos, créditos e estornos não são compras. */
const PAGAMENTO_NA_FATURA = /pagamento|pgto|estorno|credito de|ajuste|iof estorno|reembolso/;

function msDia(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
}

export function preparar(opts: {
  lancamentos: LancamentoArquivo[];
  tipo: TipoArquivo;
  /** Na fatura: compras antes deste dia vão para ele (ex.: parcela de compra antiga). */
  inicioFatura?: string;
  /** Na fatura: compras a partir deste dia vão para o dia anterior. */
  fimFatura?: string;
  jaImportados: Set<string>;
  /** Gastos já existentes perto das datas do arquivo (para achar duplicados). */
  existentes: { data: string; valor: number; cartao_id: string | null }[];
  /** Parcelas já lançadas (por importação anterior ou à mão), para não duplicar a do mês. */
  parcelasLancadas?: { cartao_id: string | null; valor: number; parcela: number; parcelas: number }[];
  cartaoId?: string | null;
  contasAbertas: { id: string; nome: string; valor: number | null; dia_vencimento: number; competencia: string }[];
}): ResultadoPreparo {
  const { lancamentos, tipo } = opts;

  // Na fatura, qual sinal é compra? OFX de cartão usa negativo; CSV (Nubank, C6) usa positivo.
  let sinalCompra = -1;
  if (tipo === "fatura") {
    const somaPos = lancamentos.filter((l) => l.valor > 0).length;
    const somaNeg = lancamentos.filter((l) => l.valor < 0).length;
    sinalCompra = somaPos >= somaNeg ? 1 : -1;
  }

  const usadosExistentes = new Set<number>();
  const contasUsadas = new Set<string>();
  const itens: ItemImportacao[] = [];
  let ignorados = 0;

  for (const l of lancamentos) {
    const desc = normalizar(l.descricao);
    const ehSaida = tipo === "extrato" ? l.valor < 0 : Math.sign(l.valor) === sinalCompra;
    if (!ehSaida || (tipo === "fatura" && PAGAMENTO_NA_FATURA.test(desc) && !/pagamento (de )?(boleto|conta)/.test(desc))) {
      ignorados++;
      continue;
    }

    let data = l.data;
    if (tipo === "fatura" && opts.inicioFatura && opts.fimFatura) {
      if (data < opts.inicioFatura) data = opts.inicioFatura;
      if (data >= opts.fimFatura) {
        const d = new Date(msDia(opts.fimFatura) * 86400000 - 86400000);
        data = d.toISOString().slice(0, 10);
      }
    }

    const valor = Math.round(Math.abs(l.valor) * 100) / 100;
    const jaImportado = opts.jaImportados.has(l.id);
    let aviso: string | null = null;
    let incluir = !jaImportado;

    const [pAtual, pTotal] = l.parcela ? l.parcela.split("/").map(Number) : [0, 0];
    const parcelaJaLancada =
      !!l.parcela &&
      (opts.parcelasLancadas ?? []).some(
        (p) => p.parcela === pAtual && p.parcelas === pTotal && Math.abs(p.valor - valor) < 0.02 && (tipo !== "fatura" || !opts.cartaoId || p.cartao_id === opts.cartaoId),
      );

    if (jaImportado) aviso = "Já importado antes";
    else if (parcelaJaLancada) {
      incluir = false;
      aviso = `Parcela ${l.parcela} já está lançada (veio de uma fatura anterior)`;
    }
    else if (tipo === "extrato" && PAGAMENTO_FATURA.test(desc)) {
      incluir = false;
      aviso = "Pagamento de fatura — as compras já contam no cartão";
    } else {
      // Mesmo valor, até 2 dias de diferença (e mesmo cartão, na fatura) = provavelmente já lançado à mão.
      const idx = opts.existentes.findIndex(
        (g, i) =>
          !usadosExistentes.has(i) &&
          Math.abs(g.valor - valor) < 0.005 &&
          Math.abs(msDia(g.data) - msDia(l.data)) <= 2 &&
          (tipo !== "fatura" || !opts.cartaoId || g.cartao_id === opts.cartaoId),
      );
      if (idx >= 0) {
        usadosExistentes.add(idx);
        incluir = false;
        aviso = "Parece que já foi lançado (mesmo valor e data)";
      }
    }

    // Conta fixa: nome parecido na descrição, ou mesmo valor perto do vencimento.
    let contaBaixa: ItemImportacao["contaBaixa"] = null;
    if (!jaImportado) {
      const mes = l.data.slice(0, 7);
      for (const c of opts.contasAbertas) {
        if (contasUsadas.has(c.id + c.competencia) || c.competencia.slice(0, 7) !== mes) continue;
        const palavras = normalizar(c.nome).split(" ").filter((p) => p.length >= 3);
        const porNome = palavras.length > 0 && palavras.some((p) => desc.includes(p));
        const dia = Number(l.data.slice(8, 10));
        const porValor = c.valor != null && Math.abs(c.valor - valor) < 0.005 && Math.abs(dia - c.dia_vencimento) <= 5;
        if (porNome || porValor) {
          contaBaixa = { contaId: c.id, nome: c.nome, competencia: c.competencia, porNome };
          contasUsadas.add(c.id + c.competencia);
          break;
        }
      }
    }

    const forma = tipo === "fatura" ? "credito" : /pix/.test(desc) ? "pix" : "debito";
    itens.push({
      id: l.id,
      data,
      dataOriginal: l.data,
      descricao: l.descricao,
      valor,
      parcela: l.parcela,
      iconeSugerido: contaBaixa ? "receipt" : sugerirIcone(l.descricao),
      forma,
      incluir,
      aviso,
      jaImportado,
      contaBaixa,
    });
  }

  itens.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return { itens, ignorados };
}
