import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Cartao } from "../components/ui";
import { useCartoes, useCategorias } from "../data/hooks";
import { emojiCategoria, type Gasto, tituloGasto } from "../data/tipos";
import { diaMes, faturaDaCompra, faturaVizinha } from "../lib/fatura";
import { formatarReais, hojeISO, MESES, rotuloDia } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CartaoDetalhe">;

// Uma fatura por vez, com ‹ › para ver as anteriores e as futuras (parcelas).
export function CartaoDetalheScreen({ navigation, route }: Props) {
  const { cartaoId } = route.params;
  const { casa, membros } = useCasa();
  const { cartoes } = useCartoes();
  const { categorias } = useCategorias();
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const [deslocamento, setDeslocamento] = useState(0);
  const [gastos, setGastos] = useState<Gasto[]>([]);

  const atual = cartao ? faturaDaCompra(hojeISO(), cartao.dia_fechamento, cartao.dia_vencimento) : null;
  const fatura = cartao && atual ? (deslocamento === 0 ? atual : faturaVizinha(atual.fechamento, deslocamento, cartao.dia_fechamento, cartao.dia_vencimento)) : null;
  const inicio = cartao && fatura ? faturaVizinha(fatura.fechamento, -1, cartao.dia_fechamento, cartao.dia_vencimento).fechamento : null;

  useEffect(() => {
    if (cartao) navigation.setOptions({ title: cartao.nome, headerRight: () => (
      <TouchableOpacity onPress={() => navigation.navigate("CartaoForm", { cartaoId })}>
        <Text style={{ color: colors.accent, fontWeight: "600" }}>Editar</Text>
      </TouchableOpacity>
    ) });
  }, [cartao, cartaoId, navigation]);

  const carregar = useCallback(async () => {
    if (!casa || !fatura || !inicio) return;
    // Fatura = compras de [fechamento anterior, fechamento desta).
    const { data } = await supabase
      .from("gastos")
      .select("*")
      .eq("casa_id", casa.id)
      .eq("cartao_id", cartaoId)
      .gte("data", inicio)
      .lt("data", fatura.fechamento)
      .order("data", { ascending: false });
    setGastos((data ?? []).map((g) => ({ ...g, valor: Number(g.valor) })));
  }, [casa?.id, cartaoId, fatura?.fechamento, inicio]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!cartao || !fatura) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const hoje = hojeISO();
  const situacao =
    deslocamento > 0 ? "Futura" : deslocamento === 0 ? "Aberta" : hoje <= fatura.vencimento ? "Fechada · a vencer" : "Fechada";
  const mesVenc = Number(fatura.vencimento.slice(5, 7)) - 1;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const nomePessoa = new Map(membros.map((m) => [m.user_id, m.nome]));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setDeslocamento(deslocamento - 1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>Fatura de {MESES[mesVenc]}</Text>
          <Text style={typography.label}>{situacao}</Text>
        </View>
        <TouchableOpacity onPress={() => setDeslocamento(deslocamento + 1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        <Text style={typography.label}>TOTAL DA FATURA</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(total)}</Text>
        <Text style={typography.label}>
          Fecha {diaMes(fatura.fechamento)} · vence {diaMes(fatura.vencimento)}
        </Text>
      </Cartao>

      {gastos.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nenhuma compra nesta fatura.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {gastos.map((g, i) => {
            const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => navigation.navigate("GastoForm", { gastoId: g.id })}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>{tituloGasto(g, cat?.nome)}</Text>
                  <Text style={typography.label}>
                    {rotuloDia(g.data)}
                    {membros.length > 1 && g.pago_por ? ` · ${nomePessoa.get(g.pago_por) ?? ""}` : ""}
                  </Text>
                </View>
                <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
              </TouchableOpacity>
            );
          })}
        </Cartao>
      )}
    </ScrollView>
  );
}
