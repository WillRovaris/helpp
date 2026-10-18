import React from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

export function Botao({
  titulo,
  onPress,
  carregando,
  variante = "primario",
  style,
}: {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: "primario" | "secundario" | "link";
  style?: ViewStyle;
}) {
  const estilo = variante === "primario" ? styles.primario : variante === "secundario" ? styles.secundario : styles.link;
  const corTexto = variante === "primario" ? colors.accentContrast : colors.accent;
  return (
    <TouchableOpacity style={[styles.botao, estilo, style]} onPress={onPress} disabled={carregando} activeOpacity={0.8}>
      {carregando ? <ActivityIndicator color={corTexto} /> : <Text style={[styles.botaoTexto, { color: corTexto }]}>{titulo}</Text>}
    </TouchableOpacity>
  );
}

export function Campo({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.label, { marginBottom: spacing.xs }]}>{rotulo}</Text>
      <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} {...props} />
    </View>
  );
}

export function Cartao({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.cartao, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primario: { backgroundColor: colors.accent },
  secundario: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  link: { backgroundColor: "transparent", minHeight: 40 },
  botaoTexto: { fontSize: 16, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
