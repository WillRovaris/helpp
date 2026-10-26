import React, { useState } from "react";
import { Alert, ScrollView, Share, Text } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { colors, spacing, typography } from "../theme";

/** "ABCDEFGH" → "ABCD-EFGH" (mais fácil de ler e digitar). */
const comHifen = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

// Opcional: só para quem quer dividir a casa com outra pessoa.
// Quem mora sozinho(a) nunca precisa abrir esta tela.
// Segurança: o código só existe depois de gerado aqui, vence em 48 h e vale para uma entrada.
export function CompartilharScreen() {
  const rodape = useEspacoRodape();
  const { casa, membros, novoConvite } = useCasa();
  const [gerando, setGerando] = useState(false);
  if (!casa) return null;

  const cheia = membros.length >= 2;
  const valido = !!casa.codigo_convite && !!casa.convite_expira_em && new Date(casa.convite_expira_em) > new Date();
  const venceEm = casa.convite_expira_em ? new Date(casa.convite_expira_em) : null;

  async function gerar() {
    setGerando(true);
    const { error } = await novoConvite();
    setGerando(false);
    if (error) Alert.alert("Não foi possível gerar o código", error);
  }

  function enviarConvite() {
    Share.share({
      message: `Entre na nossa casa no Helpp! Crie sua conta, toque em "Tenho um convite" e use o código: ${comHifen(casa!.codigo_convite!)} (vale por 48 horas).`,
    });
  }

  function trocarCodigo() {
    Alert.alert("Gerar novo código?", "O código atual deixa de funcionar.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Gerar", onPress: gerar },
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
          {valido ? (
            <>
              <Text style={typography.label}>CÓDIGO DE CONVITE</Text>
              <Text style={{ fontSize: 34, fontWeight: "700", letterSpacing: 4, color: colors.accent, marginVertical: spacing.sm }}>
                {comHifen(casa.codigo_convite!)}
              </Text>
              <Text style={[typography.label, { marginBottom: spacing.md }]}>
                Vale até {venceEm!.toLocaleDateString("pt-BR")} às {venceEm!.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} e só
                para uma pessoa. No celular dela: instalar o Helpp → criar conta → &quot;Tenho um convite&quot; → digitar este código.
              </Text>
              <Botao titulo="Enviar convite" onPress={enviarConvite} />
              <Botao titulo="Gerar outro código" variante="link" onPress={trocarCodigo} />
            </>
          ) : (
            <>
              <Text style={[typography.label, { marginBottom: spacing.md }]}>
                Por segurança, o código de convite é criado só quando você pede, vale por 48 horas e para uma pessoa.
              </Text>
              <Botao titulo="Gerar código de convite" onPress={gerar} carregando={gerando} />
            </>
          )}
        </Cartao>
      )}
    </ScrollView>
  );
}
