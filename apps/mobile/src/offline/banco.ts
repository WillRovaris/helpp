// Cópia local dos dados da casa (SQLite no celular) + fila do que falta subir.
// O app lê sempre daqui (funciona sem internet); a sincronização (sync.ts)
// envia a fila para o Supabase e traz o que mudou na nuvem.
import * as SQLite from "expo-sqlite";

export type Tabela =
  | "casas"
  | "membros"
  | "categorias"
  | "cartoes"
  | "contas_fixas"
  | "notas"
  | "nota_itens"
  | "gastos"
  | "contas_pagamentos"
  | "faturas_pagas"
  | "sugestoes"
  | "receitas"
  | "importacoes"
  | "caixinhas"
  | "caixinha_movimentos"
  | "lista_compras";

/** Ordem importa: quem é referenciado vem antes (nota antes dos itens e da despesa). */
export const TABELAS: Tabela[] = ["casas", "membros", "categorias", "cartoes", "contas_fixas", "notas", "nota_itens", "gastos", "contas_pagamentos", "faturas_pagas", "sugestoes", "receitas", "importacoes", "caixinhas", "caixinha_movimentos", "lista_compras"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Linha = Record<string, any>;

export type Operacao =
  | { seq?: number; op: "inserir"; tabela: Tabela; dados: Linha }
  | { seq?: number; op: "atualizar"; tabela: Tabela; dados: { id: string; campos: Linha } }
  | { seq?: number; op: "excluir"; tabela: Tabela; dados: { ids: string[] } };

const db = SQLite.openDatabaseSync("helpp.db");
db.execSync(`
  create table if not exists registros (tabela text not null, id text not null, dados text not null, primary key (tabela, id));
  create table if not exists fila (seq integer primary key autoincrement, op text not null, tabela text not null, dados text not null, criado_em text not null);
  create table if not exists meta (chave text primary key, valor text);
`);

/** Chave de cada linha (membros não tem "id": é o user_id). */
export function idDe(tabela: Tabela, linha: Linha): string {
  return String(tabela === "membros" ? linha.user_id : linha.id);
}

// Memória: tudo carregado uma vez; leituras são instantâneas.
const memoria = new Map<Tabela, Map<string, Linha>>();
function carregar() {
  if (memoria.size) return;
  for (const t of TABELAS) memoria.set(t, new Map());
  for (const r of db.getAllSync<{ tabela: Tabela; id: string; dados: string }>("select tabela, id, dados from registros")) {
    memoria.get(r.tabela)?.set(r.id, JSON.parse(r.dados));
  }
}

// Quem quer saber quando uma tabela mudou (as telas, via hooks).
const ouvintes = new Set<(t: Tabela) => void>();
export function ouvirMudancas(fn: (t: Tabela) => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}
function avisar(t: Tabela) {
  for (const fn of ouvintes) fn(t);
}

export function linhas(tabela: Tabela): Linha[] {
  carregar();
  return [...memoria.get(tabela)!.values()];
}

export function obter(tabela: Tabela, id: string): Linha | undefined {
  carregar();
  return memoria.get(tabela)!.get(id);
}

export function gravarLocal(tabela: Tabela, novas: Linha[]) {
  if (!novas.length) return;
  carregar();
  const mapa = memoria.get(tabela)!;
  db.withTransactionSync(() => {
    for (const l of novas) {
      const id = idDe(tabela, l);
      mapa.set(id, l);
      db.runSync("insert or replace into registros (tabela, id, dados) values (?, ?, ?)", tabela, id, JSON.stringify(l));
    }
  });
  avisar(tabela);
}

export function apagarLocal(tabela: Tabela, ids: string[]) {
  if (!ids.length) return;
  carregar();
  const mapa = memoria.get(tabela)!;
  db.withTransactionSync(() => {
    for (const id of ids) {
      mapa.delete(id);
      db.runSync("delete from registros where tabela = ? and id = ?", tabela, id);
    }
  });
  avisar(tabela);
}

/** Troca a tabela inteira (usado quando a nuvem não informa o que mudou). */
export function substituirTabela(tabela: Tabela, todas: Linha[], filtro: (l: Linha) => boolean) {
  carregar();
  const mapa = memoria.get(tabela)!;
  const manter = new Set(todas.map((l) => idDe(tabela, l)));
  const remover = [...mapa.values()].filter((l) => filtro(l) && !manter.has(idDe(tabela, l))).map((l) => idDe(tabela, l));
  apagarLocal(tabela, remover);
  gravarLocal(tabela, todas);
}

// ---- fila do que falta subir

export function enfileirar(op: Operacao) {
  db.runSync("insert into fila (op, tabela, dados, criado_em) values (?, ?, ?, ?)", op.op, op.tabela, JSON.stringify(op.dados), new Date().toISOString());
}

export function lerFila(): Operacao[] {
  return db
    .getAllSync<{ seq: number; op: Operacao["op"]; tabela: Tabela; dados: string }>("select seq, op, tabela, dados from fila order by seq")
    .map((r) => ({ seq: r.seq, op: r.op, tabela: r.tabela, dados: JSON.parse(r.dados) }) as Operacao);
}

export function tirarDaFila(seq: number) {
  db.runSync("delete from fila where seq = ?", seq);
}

/** Quantas despesas (tabela gastos) ainda não subiram — é o que aparece no aviso. */
export function despesasNaFila(): number {
  return db.getFirstSync<{ n: number }>("select count(*) as n from fila where tabela = 'gastos'")?.n ?? 0;
}

export function tamanhoFila(): number {
  return db.getFirstSync<{ n: number }>("select count(*) as n from fila")?.n ?? 0;
}

// ---- marcadores (última sincronização, cursores etc.)

export function lerMeta(chave: string): string | null {
  return db.getFirstSync<{ valor: string }>("select valor from meta where chave = ?", chave)?.valor ?? null;
}

export function gravarMeta(chave: string, valor: string | null) {
  if (valor == null) db.runSync("delete from meta where chave = ?", chave);
  else db.runSync("insert or replace into meta (chave, valor) values (?, ?)", chave, valor);
}

/** Ao sair da conta: apaga a cópia local (outra pessoa pode entrar neste celular). */
export function limparTudo() {
  db.execSync("delete from registros; delete from fila; delete from meta;");
  memoria.clear();
  for (const t of TABELAS) avisar(t);
}
