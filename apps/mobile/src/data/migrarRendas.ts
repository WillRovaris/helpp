import type { Casa } from "../casa/CasaContext";
import { hojeISO } from "../lib/format";
import { gravarMeta, lerMeta, linhas } from "../offline/banco";
import { inserir } from "../offline/repo";

/**
 * Uma vez por casa: a renda cadastrada antes (um valor por pessoa) vira entrada
 * "Salário" que repete todo mês a partir deste mês. O id é o da pessoa (ou da casa),
 * então se os dois celulares fizerem isso ao mesmo tempo, fica um só na nuvem.
 */
export function migrarRendasParaEntradas(casa: Casa) {
  const chave = `rendas_migradas:${casa.id}`;
  if (lerMeta(chave)) return;
  gravarMeta(chave, "1");
  if (linhas("receitas").some((r) => r.casa_id === casa.id)) return;
  const data = `${hojeISO().slice(0, 7)}-01`;
  const porPessoa = Object.entries(casa.rendas).filter(([, v]) => v > 0);
  const base = { casa_id: casa.id, tipo: "salario", descricao: null, data, recorrente: true, ate: null };
  if (porPessoa.length) {
    for (const [pessoa, valor] of porPessoa) inserir("receitas", { ...base, id: pessoa, valor, recebido_por: pessoa, created_by: pessoa });
  } else if (casa.renda_mensal && casa.renda_mensal > 0) {
    inserir("receitas", { ...base, id: casa.id, valor: casa.renda_mensal, recebido_por: null });
  }
}
