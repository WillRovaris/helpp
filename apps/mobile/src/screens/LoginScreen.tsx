import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, radius, spacing, typography } from "../theme";

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={typography.title}>Helpp</Text>
      <Text style={[typography.subtitle, { marginBottom: spacing.xl, marginTop: spacing.xs }]}>
        Descubra onde está mais barato.
      </Text>

      {isSignup && (
        <TextInput style={styles.input} placeholder="Nome" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />
      )}
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={styles.buttonText}>{isSignup ? "Criar conta" : "Entrar"}</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignup((v) => !v)} style={{ marginTop: spacing.lg }}>
        <Text style={{ color: colors.accent, textAlign: "center" }}>
          {isSignup ? "Já tenho conta" : "Criar uma conta"}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", paddingHorizontal: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.accentContrast, fontSize: 16, fontWeight: "700" },
});
