import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useEspacoRodape } from "../components/ui";
import { useCartoes, useFaturasPagas, useGastosCredito } from "../data/hooks";
import { resumirCartao, somarMeses } from "../lib/fatura";
import { hojeISO } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Relatorios">;

// Relatórios (botão da tela inicial): atalhos para as telas de consulta.
export function RelatoriosScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { cartoes } = useCartoes();
  const { gastosCredito } = useGastosCredito(somarMeses(hojeISO(), -3));
  const { faturaPaga } = useFaturasPagas();
  const temFaturaAVencer = cartoes.some((c) => {
    const r = resumirCartao(gastosCredito.filter((g) => g.cartao_id === c.id), c, hojeISO(), (v) => faturaPaga(c.id, v));
    return !!r.fechada && !r.fechada.paga;
  });

  const itens: { emoji: string; titulo: string; detalhe: string; cor: string; abrir: () => void }[] = [
    { emoji: "📥", titulo: "Entradas do mês", detalhe: "Salários, extras e a sobra do mês anterior", cor: colors.accent, abrir: () => navigation.navigate("Entradas", {}) },
    { emoji: "📅", titulo: "Balanço", detalhe: "Quanto entrou, saiu e sobrou · meses passados e previsão", cor: "#6366F1", abrir: () => navigation.navigate("Fechamento", {}) },
    { emoji: "📊", titulo: "Evolução dos meses", detalhe: "Gráfico de entradas × despesas mês a mês", cor: "#0F766E", abrir: () => navigation.navigate("Evolucao") },
    { emoji: "🐷", titulo: "Caixinhas", detalhe: "Dinheiro guardado para seus objetivos", cor: "#E11D48", abrir: () => navigation.navigate("Caixinhas") },
    {
      emoji: "💳",
      titulo: `Cartões${temFaturaAVencer ? "  ⏰" : ""}`,
      detalhe: temFaturaAVencer ? "Tem fatura fechada para pagar" : "Faturas, vencimentos e limite",
      cor: "#F59E0B",
      abrir: () => navigation.navigate("Cartoes"),
    },
    { emoji: "🧾", titulo: "Contas fixas", detalhe: "O que já foi pago e o que vai vencer", cor: "#0EA5E9", abrir: () => navigation.navigate("Contas") },
    { emoji: "🛒", titulo: "Preço dos produtos", detalhe: "Compare preços entre mercados", cor: "#DB2777", abrir: () => navigation.navigate("Produtos") },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      {itens.map((i) => (
        <TouchableOpacity
          key={i.titulo}
          onPress={i.abrir}
          activeOpacity={0.8}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: i.cor, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 24 }}>{i.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { fontWeight: "700", fontSize: 17 }]}>{i.titulo}</Text>
            <Text style={typography.label}>{i.detalhe}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
