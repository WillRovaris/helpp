import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { Botao, Cartao as CartaoUI } from "../components/ui";
import { useCartoes } from "../data/hooks";
import { formatarReais } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cartoes">;

// Lista simples de cartões. Fatura, quanto já gastou e o aviso "faltam R$ X"
// entram na etapa 4.
export function CartoesScreen({ navigation }: Props) {
  const { cartoes, carregando } = useCartoes();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {!carregando && cartoes.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Cadastre seus cartões de crédito para escolher em qual cartão foi cada gasto.
        </Text>
      )}
      {cartoes.map((c) => (
        <TouchableOpacity key={c.id} onPress={() => navigation.navigate("CartaoForm", { cartaoId: c.id })}>
          <CartaoUI>
            <Text style={[typography.body, { fontWeight: "600" }]}>💳 {c.nome}</Text>
            <Text style={typography.label}>
              Limite {formatarReais(c.limite)} · fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}
            </Text>
          </CartaoUI>
        </TouchableOpacity>
      ))}
      <Botao titulo="+ Novo cartão" variante="secundario" onPress={() => navigation.navigate("CartaoForm", {})} />
    </ScrollView>
  );
}
