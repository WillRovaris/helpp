import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, Text } from "react-native";
import { CartaoAlertas } from "../components/Alertas";
import { useEspacoRodape } from "../components/ui";
import { useAlertas } from "../data/hooks";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Alertas">;

// Todos os alertas espertos (a tela inicial mostra só os 2 primeiros).
export function AlertasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { alertas, dispensar } = useAlertas(mostrarValor);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        O app compara este mês com a média dos últimos meses e procura cobranças repetidas. Toque num alerta para ver as despesas; o ✕ esconde.
      </Text>
      {alertas.length ? (
        <CartaoAlertas
          alertas={alertas}
          onDispensar={dispensar}
          onAbrir={(a) => (a.categoriaId ? navigation.navigate("Historico", { categoriaId: a.categoriaId }) : a.gastoId ? navigation.navigate("GastoForm", { gastoId: a.gastoId }) : undefined)}
        />
      ) : (
        <Text style={[typography.body, { textAlign: "center", paddingVertical: spacing.lg }]}>✅ Nenhum alerta agora. Tudo dentro do normal!</Text>
      )}
    </ScrollView>
  );
}
