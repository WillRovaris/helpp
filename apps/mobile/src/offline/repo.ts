// Gravações do app: vão primeiro para o celular (aparecem na hora, mesmo sem
// internet) e entram na fila para subir para a nuvem na próxima sincronização.
import { gerarUuid } from "../lib/format";
import { apagarLocal, enfileirar, gravarLocal, type Linha, obter, type Tabela } from "./banco";

let aoGravar: () => void = () => {};

/** A sincronização se registra aqui para ser chamada logo depois de cada gravação. */
export function quandoGravar(fn: () => void) {
  aoGravar = fn;
}

export function inserir(tabela: Tabela, dados: Linha): Linha {
  return inserirVarios(tabela, [dados])[0];
}

export function inserirVarios(tabela: Tabela, lista: Linha[]): Linha[] {
  const agora = new Date().toISOString();
  // tira campos vazios (undefined) e dá um id criado no próprio celular
  const prontas = lista.map((d) => {
    const linha: Linha = { id: gerarUuid(), created_at: agora, ...d };
    for (const k of Object.keys(linha)) if (linha[k] === undefined) delete linha[k];
    return linha;
  });
  gravarLocal(tabela, prontas);
  for (const linha of prontas) enfileirar({ op: "inserir", tabela, dados: linha });
  aoGravar();
  return prontas;
}

export function atualizar(tabela: Tabela, id: string, campos: Linha) {
  const atual = obter(tabela, id);
  const limpos: Linha = {};
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) limpos[k] = v;
  if (atual) gravarLocal(tabela, [{ ...atual, ...limpos }]);
  enfileirar({ op: "atualizar", tabela, dados: { id, campos: limpos } });
  aoGravar();
}

export function excluir(tabela: Tabela, ids: string[]) {
  if (!ids.length) return;
  apagarLocal(tabela, ids);
  enfileirar({ op: "excluir", tabela, dados: { ids } });
  aoGravar();
}
