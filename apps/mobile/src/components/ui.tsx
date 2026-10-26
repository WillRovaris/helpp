import { HeaderHeightContext } from "@react-navigation/elements";
import React, { useContext, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../theme";
import { emojiCategoria } from "../data/tipos";

/**
 * Espaço no fim das telas com rolagem: a altura dos botões de navegação do
 * Android (que ficam por cima do app) + uma folga, para o último item não ficar escondido.
 */
export function useEspacoRodape(): number {
  return useSafeAreaInsets().bottom + spacing.xl;
}

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

/** Ícone da categoria: emoji num círculo com a cor dela (igual à tela de categorias). */
export function IconeCategoria({
  categoria,
  tamanho = 34,
  emoji,
  style,
}: {
  categoria?: { icone?: string; cor?: string } | null;
  tamanho?: number;
  /** Troca o emoji (ex.: ✅ conta paga), mantendo a cor da categoria. */
  emoji?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, alignItems: "center", justifyContent: "center", backgroundColor: categoria?.cor ?? colors.border },
        style,
      ]}
    >
      <Text style={{ fontSize: Math.round(tamanho * 0.52) }}>{emoji ?? emojiCategoria(categoria?.icone)}</Text>
    </View>
  );
}

/** Campo de senha com olho para mostrar/esconder o que foi digitado. */
export function CampoSenha({ rotulo, ...props }: Omit<TextInputProps, "secureTextEntry"> & { rotulo: string }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.label, { marginBottom: spacing.xs }]}>{rotulo}</Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          secureTextEntry={!visivel}
          style={[estiloInput(), { paddingRight: 48 }]}
        />
        <TouchableOpacity
          onPress={() => setVisivel((v) => !v)}
          accessibilityLabel={visivel ? "Esconder senha" : "Mostrar senha"}
          hitSlop={8}
          style={{ position: "absolute", right: 10, padding: 4 }}
        >
          <Image
            source={visivel ? require("../../assets/olho-aberto.png") : require("../../assets/olho-fechado.png")}
            style={{ width: 24, height: 24, tintColor: colors.textSecondary }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
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
  const rodape = useEspacoRodape();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={alturaCabecalho}>
      <ScrollView contentContainerStyle={[{ padding: spacing.lg, paddingBottom: rodape + spacing.xl }, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
