import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Cartao as CartaoUI, Chip } from "../components/ui";
import { useCartoes, useCategorias, useGastosDoMes } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type Gasto } from "../data/tipos";
import { formatarReais, MESES, rotuloDia } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Historico">;

export function HistoricoScreen({ navigation }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [filtroPessoa, setFiltroPessoa] = useState<string | null>(null);

  const { membros } = useCasa();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();
  const { gastos, carregando, recarregar } = useGastosDoMes(ano, mes);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  const filtrados = gastos.filter((g) => (!filtroCategoria || g.categoria_id === filtroCategoria) && (!filtroPessoa || g.pago_por === filtroPessoa));
  const total = filtrados.reduce((s, g) => s + g.valor, 0);

  const porDia = useMemo(() => {
    const grupos: { data: string; itens: Gasto[] }[] = [];
    for (const g of filtrados) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.data === g.data) ultimo.itens.push(g);
      else grupos.push({ data: g.data, itens: [g] });
    }
    return grupos;
  }, [filtrados]);

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
  const nomePessoa = new Map(membros.map((m) => [m.user_id, m.nome]));
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => mudarMes(-1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>
          {MESES[mes]} {ano}
        </Text>
        <TouchableOpacity onPress={() => mudarMes(1)} disabled={ehMesAtual} style={{ padding: spacing.sm, opacity: ehMesAtual ? 0.3 : 1 }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <CartaoUI>
        <Text style={typography.label}>{filtroCategoria || filtroPessoa ? "TOTAL FILTRADO" : "TOTAL DO MÊS"}</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(total)}</Text>
        <Text style={typography.label}>{filtrados.length} {filtrados.length === 1 ? "gasto" : "gastos"}</Text>
      </CartaoUI>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip rotulo="Todas" ativo={!filtroCategoria} onPress={() => setFiltroCategoria(null)} />
        {categorias.map((c) => (
          <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={filtroCategoria === c.id} onPress={() => setFiltroCategoria(filtroCategoria === c.id ? null : c.id)} />
        ))}
      </ScrollView>

      {membros.length > 1 && (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Chip rotulo="Todos" ativo={!filtroPessoa} onPress={() => setFiltroPessoa(null)} />
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.nome} ativo={filtroPessoa === m.user_id} onPress={() => setFiltroPessoa(filtroPessoa === m.user_id ? null : m.user_id)} />
          ))}
        </View>
      )}

      {!carregando && filtrados.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nenhum gasto por aqui.</Text>
      )}

      {porDia.map((grupo) => (
        <View key={grupo.data}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
            <Text style={typography.label}>{rotuloDia(grupo.data).toUpperCase()}</Text>
            <Text style={typography.label}>{formatarReais(grupo.itens.reduce((s, g) => s + g.valor, 0))}</Text>
          </View>
          <CartaoUI style={{ paddingVertical: spacing.xs }}>
            {grupo.itens.map((g, i) => {
              const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
              const forma = g.forma_pagamento === "credito" && g.cartao_id
                ? `💳 ${cartaoPorId.get(g.cartao_id)?.nome ?? "Crédito"}`
                : FORMAS_PAGAMENTO.find((f) => f.valor === g.forma_pagamento)?.rotulo;
              const detalhes = [forma, membros.length > 1 && g.pago_por ? nomePessoa.get(g.pago_por) : null].filter(Boolean).join(" · ");
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => navigation.navigate("GastoForm", { gastoId: g.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>
                      {g.descricao || cat?.nome || "Sem categoria"}
                    </Text>
                    <Text style={typography.label}>{detalhes}</Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
                </TouchableOpacity>
              );
            })}
          </CartaoUI>
        </View>
      ))}
    </ScrollView>
  );
}
