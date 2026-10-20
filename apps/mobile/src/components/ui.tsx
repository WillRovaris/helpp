import { HeaderHeightContext } from "@react-navigation/elements";
import React, { useContext } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from "react-native";
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
  const estilo =
    variante === "primario"
      ? { backgroundColor: colors.accent }
      : variante === "secundario"
        ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent }
        : styles.link;
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
      <TextInput placeholderTextColor={colors.textSecondary} style={estiloInput()} {...props} />
    </View>
  );
}

export function Cartao({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.cartao, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  link: { backgroundColor: "transparent", minHeight: 40 },
  botaoTexto: { fontSize: 16, fontWeight: "600" },
  cartao: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
});

/** Estilo de campo de texto com as cores do tema atual (por isso é função, não StyleSheet). */
export function estiloInput() {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  } as const;
}

/** Opção selecionável em linha (categoria, forma de pagamento, data...). */
export function Chip({ rotulo, ativo, onPress, cor }: { rotulo: string; ativo: boolean; onPress: () => void; cor?: string }) {
  const corAtiva = cor ?? colors.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[chipStyles.chip, ativo ? { backgroundColor: corAtiva, borderColor: corAtiva } : { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[chipStyles.texto, { color: ativo ? colors.accentContrast : colors.textPrimary }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  texto: { fontSize: 14, fontWeight: "500" },
});

/**
 * Formulário que sobe junto com o teclado, para o campo digitado ficar visível.
 * O Android desta versão do Expo desenha a tela por baixo do teclado
 * (edge-to-edge), então o ajuste "padding" vale para as duas plataformas.
 */
export function TelaFormulario({ children, contentStyle }: { children: React.ReactNode; contentStyle?: ViewStyle }) {
  const alturaCabecalho = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={alturaCabecalho}>
      <ScrollView contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
