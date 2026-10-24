import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Categoria, Gasto } from "../data/tipos";
import { emojiCategoria } from "../data/tipos";
import { colors, radius, spacing, typography } from "../theme";
import { Cartao } from "./ui";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";

/** Barra horizontal simples (0–1), sem biblioteca de gráfico. */
export function Barra({ fracao, cor }: { fracao: number; cor: string }) {
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radius.sm, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, Math.max(0, fracao * 100))}%`, height: "100%", backgroundColor: cor, borderRadius: radius.sm }} />
    </View>
  );
}

/** Renda × gastos: quanto já foi e quanto sobra. */
/** O que sobrou no mês anterior entra no mês: disponível = renda + saldo anterior (✏️ corrige o saldo). */
export function CartaoSobra({
  total,
  renda,
  saldoAnterior = 0,
  nomeMesAnterior,
  onDefinirRenda,
  onEditarSaldo,
}: {
  total: number;
  renda: number | null;
  saldoAnterior?: number;
  nomeMesAnterior?: string;
  onDefinirRenda: () => void;
  onEditarSaldo?: () => void;
}) {
  const { mostrarValor } = usePrivacidade();
  if (renda == null || renda <= 0) {
    return (
      <TouchableOpacity onPress={onDefinirRenda}>
        <Text style={[typography.label, { color: colors.accent }]}>+ Informar renda do mês para ver quanto sobra (opcional)</Text>
      </TouchableOpacity>
    );
  }
  const disponivel = renda + saldoAnterior;
  const sobra = disponivel - total;
  const fracao = disponivel > 0 ? total / disponivel : 1;
  const cor = fracao >= 1 ? colors.danger : fracao >= 0.8 ? colors.warning : colors.accent;
  return (
    <View>
      <TouchableOpacity onPress={onDefinirRenda} activeOpacity={0.8}>
        <Barra fracao={fracao} cor={cor} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
          <Text style={typography.label}>
            {Math.round(fracao * 100)}% {saldoAnterior ? "do disponível" : "da renda"} ({mostrarValor(disponivel)})
          </Text>
          <Text style={[typography.label, { color: sobra < 0 ? colors.danger : colors.accent, fontWeight: "700" }]}>
            {sobra < 0 ? `Passou ${mostrarValor(-sobra)}` : `Sobra ${mostrarValor(sobra)}`}
          </Text>
        </View>
      </TouchableOpacity>
      {onEditarSaldo && (
        <TouchableOpacity onPress={onEditarSaldo} style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs }} accessibilityLabel="Editar saldo do mês anterior">
          <Text style={[typography.label, { flex: 1 }]}>
            Renda {mostrarValor(renda)} {saldoAnterior < 0 ? "−" : "+"} saldo de {nomeMesAnterior?.toLowerCase() ?? "mês anterior"}{" "}
            <Text style={{ color: saldoAnterior < 0 ? colors.danger : colors.textSecondary }}>{mostrarValor(Math.abs(saldoAnterior))}</Text>
          </Text>
          <Text style={{ fontSize: 16, paddingLeft: spacing.sm }}>✏️</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Comparação com o mês anterior até o mesmo dia. */
export function textoComparacao(total: number, totalAnteriorAteHoje: number): { texto: string; cor: string } | null {
  if (totalAnteriorAteHoje <= 0) return null;
  const diff = total - totalAnteriorAteHoje;
  const pct = Math.round((Math.abs(diff) / totalAnteriorAteHoje) * 100);
  if (pct === 0) return { texto: "Igual ao mês passado até hoje", cor: colors.textSecondary };
  return diff > 0
    ? { texto: `▲ ${pct}% a mais que o mês passado até hoje`, cor: colors.danger }
    : { texto: `▼ ${pct}% a menos que o mês passado até hoje`, cor: colors.accent };
}

/** Gastos agrupados por categoria, maiores primeiro. */
export function PorCategoria({
  gastos,
  categorias,
  onPressCategoria,
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  onPressCategoria: (categoriaId: string | null) => void;
}) {
  const { mostrarValor } = usePrivacidade();
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  if (total <= 0) return null;

  const somas = new Map<string | null, number>();
  for (const g of gastos) somas.set(g.categoria_id, (somas.get(g.categoria_id) ?? 0) + g.valor);
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const linhas = [...somas.entries()].sort((a, b) => b[1] - a[1]);
  const maior = linhas[0][1];

  return (
    <Cartao>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>CATEGORIA</Text>
      {linhas.map(([id, soma]) => {
        const cat = id ? categoriaPorId.get(id) : undefined;
        return (
          <TouchableOpacity key={id ?? "sem"} onPress={() => onPressCategoria(id)} style={{ paddingVertical: spacing.xs + 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={typography.body}>
                {emojiCategoria(cat?.icone)} {cat?.nome ?? "Sem categoria"}
              </Text>
              <Text style={typography.body}>
                <Text style={{ fontWeight: "600" }}>{mostrarValor(soma)}</Text>
                <Text style={typography.label}>  {Math.round((soma / total) * 100)}%</Text>
              </Text>
            </View>
            <Barra fracao={soma / maior} cor={cat?.cor ?? colors.textSecondary} />
          </TouchableOpacity>
        );
      })}
    </Cartao>
  );
}
