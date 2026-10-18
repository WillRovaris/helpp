import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// Tela inicial provisória: o resumo do mês entra aqui na etapa 3.
export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { casa, membros, meuNome } = useCasa();
  if (!casa) return null;

  const compartilhada = membros.length >= 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.subtitle}>Olá, {meuNome}</Text>
            <Text style={typography.title}>{casa.nome}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Compartilhar")} style={{ paddingVertical: spacing.sm }}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>{compartilhada ? "👥 Casa" : "Compartilhar"}</Text>
          </TouchableOpacity>
        </View>

        <Cartao>
          <Text style={typography.label}>ESTE MÊS</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Em breve aqui: resumo do mês, lançar gastos, cartão de crédito e contas fixas.
          </Text>
        </Cartao>

        <Botao titulo="Sair da conta" variante="link" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
