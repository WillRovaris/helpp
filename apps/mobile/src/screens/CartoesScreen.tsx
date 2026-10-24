import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect } from "react";
import { ScrollView, Text } from "react-native";
import { ResumoCartaoCard } from "../components/ResumoCartaoCard";
import { Botao, useEspacoRodape } from "../components/ui";
import { useCartoes, useFaturasPagas, useGastosCredito } from "../data/hooks";
import { resumirCartao, somarMeses } from "../lib/fatura";
import { hojeISO } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { BotaoOlho } from "../privacidade/PrivacidadeContext";

type Props = NativeStackScreenProps<RootStackParamList, "Cartoes">;

export function CartoesScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const hoje = hojeISO();
  const { cartoes, carregando } = useCartoes();
  const { gastosCredito, recarregar } = useGastosCredito(somarMeses(hoje, -3));
  const { faturaPaga, recarregar: recarregarFaturasPagas } = useFaturasPagas();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      recarregar();
      recarregarFaturasPagas();
    }, [recarregar, recarregarFaturasPagas]),
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      {!carregando && cartoes.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Cadastre seus cartões de crédito para acompanhar a fatura e quanto ainda falta do limite.
        </Text>
      )}
      {cartoes.map((c) => (
        <ResumoCartaoCard
          key={c.id}
          cartao={c}
          resumo={resumirCartao(gastosCredito.filter((g) => g.cartao_id === c.id), c, hoje, (v) => faturaPaga(c.id, v))}
          onPress={() => navigation.navigate("CartaoDetalhe", { cartaoId: c.id })}
        />
      ))}
      <Botao titulo="+ Novo cartão" variante="secundario" onPress={() => navigation.navigate("CartaoForm", {})} />
    </ScrollView>
  );
}
