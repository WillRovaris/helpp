// Acerto do casal: cada um pagou X das despesas do mês; pela divisão combinada
// (meio a meio ou proporcional às entradas de cada um), quem deve quanto para quem.

export interface PessoaAcerto {
  id: string;
  nome: string;
  /** Quanto das despesas do mês saiu do bolso dela. */
  pagou: number;
  /** Peso na divisão (ex.: 1 e 1 = meio a meio; entradas de cada um = proporcional). */
  peso: number;
}

export interface ResultadoAcerto {
  total: number;
  pessoas: (PessoaAcerto & { parte: number; percentual: number; diferenca: number })[];
  /** null quando está acertado (diferença menor que R$ 1). */
  transferencia: { de: string; para: string; valor: number } | null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function calcularAcerto(pessoas: PessoaAcerto[]): ResultadoAcerto {
  const total = arred(pessoas.reduce((s, p) => s + p.pagou, 0));
  const somaPesos = pessoas.reduce((s, p) => s + Math.max(0, p.peso), 0);
  const lista = pessoas.map((p) => {
    const percentual = somaPesos > 0 ? Math.max(0, p.peso) / somaPesos : 1 / pessoas.length;
    const parte = arred(total * percentual);
    return { ...p, parte, percentual, diferenca: arred(p.pagou - parte) };
  });
  // Quem pagou menos que a parte dele deve a diferença para quem pagou mais.
  const devedor = [...lista].sort((a, b) => a.diferenca - b.diferenca)[0];
  const credor = [...lista].sort((a, b) => b.diferenca - a.diferenca)[0];
  const valor = arred(Math.min(-devedor.diferenca, credor.diferenca));
  return {
    total,
    pessoas: lista,
    transferencia: lista.length > 1 && valor >= 1 ? { de: devedor.nome, para: credor.nome, valor } : null,
  };
}
