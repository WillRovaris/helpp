import React from "react";
import { Alert, ScrollView, Share, Text } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { colors, spacing, typography } from "../theme";

// Opcional: só para quem quer dividir a casa com outra pessoa.
// Quem mora sozinho(a) nunca precisa abrir esta tela.
export function CompartilharScreen() {
  const rodape = useEspacoRodape();
  const { casa, membros, novoConvite } = useCasa();
  if (!casa) return null;

  const cheia = membros.length >= 2;

  function enviarConvite() {
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={typography.label}>QUEM PARTICIPA</Text>
        {membros.map((m) => (
          <Text key={m.user_id} style={[typography.body, { marginTop: spacing.xs }]}>
            • {m.nome}
          </Text>
        ))}
      </Cartao>

      {cheia ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Vocês já estão compartilhando a casa. Tudo que um lança, o outro vê na hora.</Text>
      ) : (
        <Cartao>
          <Text style={[typography.body, { marginBottom: spacing.md }]}>
            Se quiser, convide uma pessoa para dividir as finanças com você. Vocês vão ver as mesmas despesas, ao vivo.
          </Text>
          <Text style={typography.label}>CÓDIGO DE CONVITE</Text>
          <Text style={{ fontSize: 34, fontWeight: "700", letterSpacing: 6, color: colors.accent, marginVertical: spacing.sm }}>
            {casa.codigo_convite}
          </Text>
          <Text style={[typography.label, { marginBottom: spacing.md }]}>
            No celular da outra pessoa: instalar o Helpp → criar conta → "Tenho um convite" → digitar este código.
          </Text>
          <Botao titulo="Enviar convite" onPress={enviarConvite} />
          <Botao titulo="Gerar outro código" variante="link" onPress={trocarCodigo} />
        </Cartao>
      )}
    </ScrollView>
  );
}
