import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { ScrollView, Text } from "react-native";
import { ResumoCartaoCard } from "../components/ResumoCartaoCard";
import { Botao } from "../components/ui";
import { useCartoes, useGastosCredito } from "../data/hooks";
import { resumirCartao, somarMeses } from "../lib/fatura";
import { hojeISO } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cartoes">;

export function CartoesScreen({ navigation }: Props) {
  const hoje = hojeISO();
  const { cartoes, carregando } = useCartoes();
  const { gastosCredito, recarregar } = useGastosCredito(somarMeses(hoje, -3));

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {!carregando && cartoes.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Cadastre seus cartões de crédito para acompanhar a fatura e quanto ainda falta do limite.
        </Text>
      )}
      {cartoes.map((c) => (
        <ResumoCartaoCard
          key={c.id}
          cartao={c}
          resumo={resumirCartao(gastosCredito.filter((g) => g.cartao_id === c.id), c, hoje)}
          onPress={() => navigation.navigate("CartaoDetalhe", { cartaoId: c.id })}
        />
      ))}
      <Botao titulo="+ Novo cartão" variante="secundario" onPress={() => navigation.navigate("CartaoForm", {})} />
    </ScrollView>
  );
}
