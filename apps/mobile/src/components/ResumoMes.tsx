import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Categoria, Gasto } from "../data/tipos";
import { colors, radius, spacing, typography } from "../theme";
import { Cartao, IconeCategoria } from "./ui";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";
import { nivelLimite } from "../lib/limites";

/** Barra horizontal simples (0–1), sem biblioteca de gráfico. */
export function Barra({ fracao, cor }: { fracao: number; cor: string }) {
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radius.sm, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, Math.max(0, fracao * 100))}%`, height: "100%", backgroundColor: cor, borderRadius: radius.sm }} />
    </View>
  );
}

/** Entradas × despesas: disponível = entradas do mês + sobra do mês anterior. Tocar abre "Entradas do mês". */
export function CartaoSobra({
  total,
  entradas,
  saldoAnterior,
  nomeMesAnterior,
  onPress,
}: {
  total: number;
  entradas: number;
  saldoAnterior: number;
  nomeMesAnterior: string;
  onPress: () => void;
}) {
  const { mostrarValor } = usePrivacidade();
  const disponivel = entradas + saldoAnterior;
  if (entradas <= 0 && saldoAnterior === 0) {
    return (
      <TouchableOpacity onPress={onPress}>
        <Text style={[typography.label, { color: colors.accent }]}>+ Lançar as entradas do mês para ver quanto sobra (opcional)</Text>
      </TouchableOpacity>
    );
  }
  const sobra = disponivel - total;
  const fracao = disponivel > 0 ? total / disponivel : 1;
  const cor = fracao >= 1 ? colors.danger : fracao >= 0.8 ? colors.warning : colors.accent;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Barra fracao={fracao} cor={cor} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
        <Text style={typography.label}>
          {Math.round(fracao * 100)}% do disponível ({mostrarValor(disponivel)})
        </Text>
        <Text style={[typography.label, { color: sobra < 0 ? colors.danger : colors.accent, fontWeight: "700" }]}>
          {sobra < 0 ? `Passou ${mostrarValor(-sobra)}` : `Sobra ${mostrarValor(sobra)}`}
        </Text>
      </View>
      <Text style={[typography.label, { marginTop: spacing.xs }]}>
        Entradas {mostrarValor(entradas)}
        {saldoAnterior !== 0 && ` ${saldoAnterior < 0 ? "−" : "+"} sobra de ${nomeMesAnterior.toLowerCase()} ${mostrarValor(Math.abs(saldoAnterior))}`} ›
      </Text>
    </TouchableOpacity>
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
  onDefinirLimites,
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  onPressCategoria: (categoriaId: string | null) => void;
  onDefinirLimites?: () => void;
}) {
  const { mostrarValor } = usePrivacidade();
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const somas = new Map<string | null, number>();
  for (const g of gastos) somas.set(g.categoria_id, (somas.get(g.categoria_id) ?? 0) + g.valor);
  // Categoria com limite aparece mesmo sem despesa no mês (mostra quanto ainda pode gastar).
  for (const c of categorias) if (c.limite && !somas.has(c.id)) somas.set(c.id, 0);
  if (!somas.size) return null;

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const linhas = [...somas.entries()].sort((a, b) => b[1] - a[1]);
  const maior = Math.max(linhas[0][1], 1);
  const corNivel = { ok: colors.accent, atencao: colors.warning, passou: colors.danger };

  return (
    <Cartao>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <Text style={typography.label}>CATEGORIA</Text>
        {onDefinirLimites && (
          <TouchableOpacity onPress={onDefinirLimites} hitSlop={8}>
            <Text style={[typography.label, { color: colors.accent }]}>🎯 Limites ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {linhas.map(([id, soma]) => {
        const cat = id ? categoriaPorId.get(id) : undefined;
        const limite = cat?.limite ?? null;
        const nivel = limite ? nivelLimite(soma, limite) : null;
        return (
          <TouchableOpacity key={id ?? "sem"} onPress={() => onPressCategoria(id)} style={{ paddingVertical: spacing.xs + 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 }}>
                <IconeCategoria categoria={cat} tamanho={28} />
                <Text style={typography.body} numberOfLines={1}>
                  {cat?.nome ?? "Sem categoria"}
                </Text>
              </View>
              <Text style={typography.body}>
                <Text style={{ fontWeight: "600" }}>{mostrarValor(soma)}</Text>
                {limite ? (
                  <Text style={typography.label}> de {mostrarValor(limite)}</Text>
                ) : (
                  <Text style={typography.label}>  {total > 0 ? Math.round((soma / total) * 100) : 0}%</Text>
                )}
              </Text>
            </View>
            {limite && nivel ? (
              <>
                <Barra fracao={soma / limite} cor={corNivel[nivel]} />
                <Text style={[typography.label, { marginTop: 2, color: nivel === "ok" ? colors.textSecondary : corNivel[nivel] }]}>
                  {nivel === "passou"
                    ? `🚨 Passou ${mostrarValor(soma - limite)} do limite`
                    : `${nivel === "atencao" ? "⚠️ " : ""}${Math.round((soma / limite) * 100)}% do limite · restam ${mostrarValor(limite - soma)}`}
                </Text>
              </>
            ) : (
              <Barra fracao={soma / maior} cor={cat?.cor ?? colors.textSecondary} />
            )}
          </TouchableOpacity>
        );
      })}
    </Cartao>
  );
}
