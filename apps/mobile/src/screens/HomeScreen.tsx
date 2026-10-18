import React from "react";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao } from "../components/ui";
import { colors, spacing, typography } from "../theme";

// Tela inicial provisória (etapa 1): mostra a casa, quem participa e o convite.
// O resumo do mês entra aqui na etapa 3.
export function HomeScreen() {
  const { signOut } = useAuth();
  const { casa, membros, meuNome, novoConvite } = useCasa();
  if (!casa) return null;

  const sozinho = membros.length < 2;

  function compartilharConvite() {
    Share.share({
      message: `Entre na nossa casa no Helpp! Crie sua conta, toque em "Tenho um convite" e use o código: ${casa!.codigo_convite}`,
    });
  }

  function trocarCodigo() {
    Alert.alert("Gerar novo código?", "O código atual deixa de funcionar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Gerar",
        onPress: async () => {
          const { error } = await novoConvite();
          if (error) Alert.alert("Erro", error);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View>
          <Text style={typography.subtitle}>Olá, {meuNome}</Text>
          <Text style={typography.title}>{casa.nome}</Text>
        </View>

        <Cartao>
          <Text style={typography.label}>QUEM PARTICIPA</Text>
          {membros.map((m) => (
            <Text key={m.user_id} style={[typography.body, { marginTop: spacing.xs }]}>
              • {m.nome}
            </Text>
          ))}
        </Cartao>

        {sozinho && (
          <Cartao>
            <Text style={typography.label}>CONVIDAR PARCEIRO(A)</Text>
            <Text style={{ fontSize: 34, fontWeight: "700", letterSpacing: 6, color: colors.accent, marginVertical: spacing.sm }}>
              {casa.codigo_convite}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              No celular dele(a): instalar o Helpp → criar conta → "Tenho um convite" → digitar este código.
            </Text>
            <Botao titulo="Enviar convite" onPress={compartilharConvite} />
            <Botao titulo="Gerar outro código" variante="link" onPress={trocarCodigo} />
          </Cartao>
        )}

        <Cartao>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Em breve aqui: resumo do mês, gastos, cartão e contas fixas.
          </Text>
        </Cartao>

        <Botao titulo="Sair da conta" variante="link" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
