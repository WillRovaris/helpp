import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Cartao } from "../components/ui";
import { colors, spacing, typography } from "../theme";

// Primeiro acesso: o normal é "Começar" (usar sozinho(a)). Entrar com convite
// é só para quem foi chamado(a) por outra pessoa para dividir a casa.
export function CasaSetupScreen() {
  const { signOut } = useAuth();
  const { criarCasa, entrarNaCasa } = useCasa();
  const [modo, setModo] = useState<"criar" | "entrar">("criar");
  const [meuNome, setMeuNome] = useState("");
  const [nomeCasa, setNomeCasa] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    const nome = meuNome.trim();
    if (!nome) {
      Alert.alert("Seu nome", "Diga como você quer aparecer nos lançamentos.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "criar") {
        const { error } = await criarCasa(nomeCasa.trim() || "Minhas finanças", nome);
        if (error) Alert.alert("Não foi possível criar", error);
      } else {
        if (codigo.trim().length < 6) {
          Alert.alert("Código", "Digite o código de 6 caracteres que a outra pessoa te passou.");
          return;
        }
        const { error } = await entrarNaCasa(codigo, nome);
        if (error) Alert.alert("Não foi possível entrar", error);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={typography.title}>Bem-vindo(a)!</Text>
          <Text style={[typography.subtitle, { marginBottom: spacing.lg }]}>Vamos preparar seu Helpp.</Text>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
            <Botao titulo="Começar" variante={modo === "criar" ? "primario" : "secundario"} onPress={() => setModo("criar")} style={{ flex: 1 }} />
            <Botao titulo="Tenho um convite" variante={modo === "entrar" ? "primario" : "secundario"} onPress={() => setModo("entrar")} style={{ flex: 1 }} />
          </View>

          <Cartao>
            <Campo rotulo="SEU NOME" value={meuNome} onChangeText={setMeuNome} placeholder="Ex.: Will" autoCapitalize="words" />
            {modo === "criar" ? (
              <>
                <Campo rotulo="NOME (OPCIONAL)" value={nomeCasa} onChangeText={setNomeCasa} placeholder="Ex.: Minhas finanças, Casa da família" />
                <Text style={typography.label}>
                  Funciona para quem mora sozinho(a). Se um dia quiser dividir com alguém, é só tocar em "Compartilhar" na tela inicial.
                </Text>
              </>
            ) : (
              <Campo
                rotulo="CÓDIGO DO CONVITE"
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder="Ex.: A1B2C3"
                autoCapitalize="characters"
                maxLength={6}
              />
            )}
          </Cartao>

          <Botao titulo={modo === "criar" ? "Começar" : "Entrar com convite"} onPress={confirmar} carregando={carregando} style={{ marginTop: spacing.lg }} />
          <Botao titulo="Sair da conta" variante="link" onPress={signOut} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
