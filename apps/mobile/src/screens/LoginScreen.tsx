import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { Botao, Campo } from "../components/ui";
import { colors, spacing, typography } from "../theme";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    const e = email.trim().toLowerCase();
    if (!e || !senha) {
      Alert.alert("Preencha tudo", "Informe e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await signIn(e, senha);
        if (error) Alert.alert("Não foi possível entrar", error);
      } else {
        const { error, precisaConfirmar } = await signUp(e, senha);
        if (error) Alert.alert("Não foi possível criar a conta", error);
        else if (precisaConfirmar) {
          Alert.alert(
            "Confirme seu e-mail",
            "Enviamos um link para " + e + ". Abra o e-mail, toque no link e depois volte aqui para entrar.",
          );
          setModo("entrar");
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={[typography.title, { color: colors.accent }]}>Helpp</Text>
            <Text style={typography.subtitle}>As finanças da casa, simples e juntas.</Text>
          </View>

          <Campo rotulo="E-MAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@email.com" />
          <Campo rotulo="SENHA" value={senha} onChangeText={setSenha} secureTextEntry placeholder="mínimo 6 caracteres" />

          <Botao titulo={modo === "entrar" ? "Entrar" : "Criar conta"} onPress={enviar} carregando={carregando} style={{ marginTop: spacing.sm }} />
          <Botao
            variante="link"
            titulo={modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
            onPress={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
