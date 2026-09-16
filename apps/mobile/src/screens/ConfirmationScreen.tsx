import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Confirmation">;

// MVP: a importação já é efetivada ao extrair o HTML da WebView (seção 18 —
// minimizar etapas). Corrigir item por item antes de confirmar (seção 19) fica
// para uma v2; aqui o usuário só revisa o que foi lido e volta para a Home.
export function ConfirmationScreen({ route, navigation }: Props) {
  const { result } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.label}>{new Date(result.receipt.purchaseDate).toLocaleDateString("pt-BR")}</Text>
        <Text style={[typography.title, { fontSize: 22 }]}>
          {result.establishment.tradeName ?? result.establishment.legalName}
        </Text>
        <Text style={typography.subtitle}>{result.items.length} produtos encontrados</Text>
        <Text style={typography.price}>R$ {result.receipt.totalValue.toFixed(2).replace(".", ",")}</Text>
      </View>

      <FlatList
        data={result.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.name}</Text>
              {!item.identified && <Text style={typography.label}>Ajude-nos a identificar este produto</Text>}
            </View>
            <Text style={[typography.body, { fontWeight: "700" }]}>R$ {item.totalPrice.toFixed(2).replace(".", ",")}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.popToTop()}>
          <Text style={styles.buttonText}>Concluído</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footer: { padding: spacing.lg },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  buttonText: { color: colors.accentContrast, fontWeight: "700", fontSize: 16 },
});
