const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(valor: number): string {
  return brl.format(valor);
}

/** Campo de valor tipo "maquininha": digitar 1234 vira R$ 12,34. Retorna centavos. */
export function centavosDoTexto(texto: string): number {
  const digitos = texto.replace(/\D/g, "").slice(0, 11);
  return digitos ? parseInt(digitos, 10) : 0;
}

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Data local no formato do banco (YYYY-MM-DD), sem passar por UTC. */
export function dataISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function dataDeISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function hojeISO(): string {
  return dataISO(new Date());
}

export function somarDias(iso: string, dias: number): string {
  const d = dataDeISO(iso);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

/** "Hoje", "Ontem" ou "quinta, 16/10". */
export function rotuloDia(iso: string): string {
  if (iso === hojeISO()) return "Hoje";
  if (iso === somarDias(hojeISO(), -1)) return "Ontem";
  const d = dataDeISO(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Converte "16/10" ou "16/10/2026" em YYYY-MM-DD. null se inválida. */
export function isoDeTextoBR(texto: string): string | null {
  const partes = texto.trim().split("/").map((p) => parseInt(p, 10));
  if (partes.length < 2 || partes.some(isNaN)) return null;
  const [dia, mes] = partes;
  let ano = partes[2] ?? new Date().getFullYear();
  if (ano < 100) ano += 2000;
  const d = new Date(ano, mes - 1, dia);
  if (d.getDate() !== dia || d.getMonth() !== mes - 1) return null;
  return dataISO(d);
}

/** Primeiro e último dia do mês (YYYY-MM-DD). `mes` é 0–11. */
export function limitesDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  return { inicio: dataISO(new Date(ano, mes, 1)), fim: dataISO(new Date(ano, mes + 1, 0)) };
}
