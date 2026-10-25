import React, { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { Botao, Campo, CampoSenha } from "../components/ui";
import { colors, spacing, typography } from "../theme";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);

  function trocarModo() {
    setModo(modo === "entrar" ? "cadastrar" : "entrar");
    setConfirmacao("");
  }

  async function enviar() {
    const e = email.trim().toLowerCase();
    if (!e || !senha) {
      Alert.alert("Preencha tudo", "Informe e-mail e senha.");
      return;
    }
    if (modo === "cadastrar") {
      if (senha.length < 6) return Alert.alert("Senha curta", "A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== confirmacao) return Alert.alert("Senhas diferentes", "A confirmação não é igual à senha. Digite de novo.");
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
          setConfirmacao("");
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  const confirmacaoErrada = modo === "cadastrar" && confirmacao.length > 0 && confirmacao !== senha;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: spacing.xl, alignItems: "center" }}>
            <Image source={require("../../assets/logo.png")} style={{ width: 180, height: 180 }} resizeMode="contain" accessibilityLabel="Helpp" />
            <Text style={[typography.title, { marginTop: spacing.sm, textAlign: "center", fontSize: 22 }]}>Precisa de ajuda? Dá um Helpp aí!</Text>
            <Text style={[typography.subtitle, { marginTop: spacing.xs, textAlign: "center" }]}>As finanças da casa, simples e juntas.</Text>
          </View>

          <Campo rotulo="E-MAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@email.com" />
          <CampoSenha rotulo="SENHA" value={senha} onChangeText={setSenha} placeholder="mínimo 6 caracteres" autoComplete={modo === "entrar" ? "password" : "new-password"} />
          {modo === "cadastrar" && (
            <>
              <CampoSenha rotulo="CONFIRME A SENHA" value={confirmacao} onChangeText={setConfirmacao} placeholder="digite a senha de novo" autoComplete="new-password" />
              {confirmacaoErrada && <Text style={[typography.label, { color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm }]}>As senhas não estão iguais.</Text>}
            </>
          )}

          <Botao titulo={modo === "entrar" ? "Entrar" : "Criar conta"} onPress={enviar} carregando={carregando} style={{ marginTop: spacing.sm }} />
          <Botao variante="link" titulo={modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"} onPress={trocarModo} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
