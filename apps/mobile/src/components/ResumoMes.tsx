import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Categoria, Gasto } from "../data/tipos";
import { colors, radius, spacing, typography } from "../theme";
import { Cartao, IconeCategoria } from "./ui";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";
import { principaisDe, somarPorPrincipal, somarSubcategorias } from "../lib/categorias";
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

/** Comparação com o mês anterior (no mês atual, só até o mesmo dia). */
export function textoComparacao(total: number, totalAnteriorAteHoje: number, referencia = "o mês passado até hoje"): { texto: string; cor: string } | null {
  if (totalAnteriorAteHoje <= 0) return null;
  const diff = total - totalAnteriorAteHoje;
  const pct = Math.round((Math.abs(diff) / totalAnteriorAteHoje) * 100);
  if (pct === 0) return { texto: `Igual a ${referencia}`, cor: colors.textSecondary };
  return diff > 0
    ? { texto: `▲ ${pct}% a mais que ${referencia}`, cor: colors.danger }
    : { texto: `▼ ${pct}% a menos que ${referencia}`, cor: colors.accent };
}

const CATEGORIAS_RECOLHIDAS = 5;

/** Gastos agrupados por categoria, maiores primeiro. Mostra as 5 maiores; "Ver todas" expande. */
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
  const [expandido, setExpandido] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  // O resumo mostra só as principais; as subcategorias abrem ao tocar.
  const somas = somarPorPrincipal(gastos, categorias);
  const principais = principaisDe(categorias);
  // Categoria com limite aparece mesmo sem despesa no mês (mostra quanto ainda pode gastar).
  for (const c of principais) if (c.limite && !somas.has(c.id)) somas.set(c.id, 0);
  if (!somas.size) return null;

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const linhas = [...somas.entries()].sort((a, b) => b[1] - a[1]);
  const maior = Math.max(linhas[0][1], 1);
  const corNivel = { ok: colors.accent, atencao: colors.warning, passou: colors.danger };
  // Soma de todas as categorias com limite: quanto já foi de quanto foi planejado.
  const comLimite = principais.filter((c) => c.limite);
  const totalLimites = comLimite.reduce((s, c) => s + (c.limite ?? 0), 0);
  const gastoComLimite = comLimite.reduce((s, c) => s + (somas.get(c.id) ?? 0), 0);

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
      {totalLimites > 0 && (
        <View style={{ marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={[typography.body, { fontWeight: "600" }]}>🎯 Total dos limites</Text>
            <Text style={typography.body}>
              <Text style={{ fontWeight: "600" }}>{mostrarValor(gastoComLimite)}</Text>
              <Text style={typography.label}> de {mostrarValor(totalLimites)}</Text>
            </Text>
          </View>
          <Barra fracao={gastoComLimite / totalLimites} cor={corNivel[nivelLimite(gastoComLimite, totalLimites)]} />
          <Text style={[typography.label, { marginTop: 2 }]}>
            {Math.round((gastoComLimite / totalLimites) * 100)}% somando as {comLimite.length} categorias com limite
          </Text>
        </View>
      )}
      {(expandido ? linhas : linhas.slice(0, CATEGORIAS_RECOLHIDAS)).map(([id, soma]) => {
        const cat = id ? categoriaPorId.get(id) : undefined;
        const limite = cat?.limite ?? null;
        const nivel = limite ? nivelLimite(soma, limite) : null;
        const subs = id ? somarSubcategorias(gastos, categorias, id) : [];
        return (
          <View key={id ?? "sem"}>
          <TouchableOpacity onPress={() => (subs.length ? setAberta(aberta === id ? null : id) : onPressCategoria(id))} style={{ paddingVertical: spacing.xs + 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 }}>
                <IconeCategoria categoria={cat} tamanho={28} />
                <Text style={typography.body} numberOfLines={1}>
                  {cat?.nome ?? "Sem categoria"}
                  {subs.length ? (aberta === id ? " ▲" : " ▼") : ""}
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
          {aberta === id && subs.length > 0 && (
            <View style={{ marginLeft: 36, marginBottom: spacing.xs }}>
              {subs.map((s) => (
                <TouchableOpacity
                  key={s.id ?? "direto"}
                  disabled={!s.id}
                  onPress={() => onPressCategoria(s.id)}
                  style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}
                >
                  <Text style={[typography.body, { fontSize: 14, flexShrink: 1 }]} numberOfLines={1}>
                    {s.nome}
                    {s.id ? " ›" : ""}
                  </Text>
                  <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>{mostrarValor(s.total)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => onPressCategoria(id)} hitSlop={6} style={{ paddingVertical: 5 }}>
                <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>Ver todas as despesas ›</Text>
              </TouchableOpacity>
            </View>
          )}
          </View>
        );
      })}
      {linhas.length > CATEGORIAS_RECOLHIDAS && (
        <TouchableOpacity onPress={() => setExpandido((v) => !v)} hitSlop={8} style={{ alignItems: "center", paddingTop: spacing.sm }}>
          <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>{expandido ? "Recolher ▲" : `Ver todas (${linhas.length}) ▼`}</Text>
        </TouchableOpacity>
      )}
    </Cartao>
  );
}
