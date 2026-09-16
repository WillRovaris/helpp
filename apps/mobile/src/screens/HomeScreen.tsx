import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

interface ReceiptSummary {
  id: string;
  purchaseDate: string;
  totalValue: number;
  establishment: { tradeName: string | null; legalName: string };
  items: { id: string }[];
}

export function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [lastReceipt, setLastReceipt] = useState<ReceiptSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<ReceiptSummary[]>("/api/receipts")
        .then((receipts) => setLastReceipt(receipts[0] ?? null))
        .catch(() => setLastReceipt(null));
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.headerRow}>
        <Text style={typography.title}>Helpp</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={{ color: colors.textSecondary }}>Sair</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={() => navigation.navigate("Scanner")}>
        <Text style={styles.scanButtonText}>Escanear nota fiscal</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.searchLink} onPress={() => navigation.navigate("Search")}>
        <Text style={{ color: colors.accent, fontWeight: "600" }}>Pesquisar preços de um produto</Text>
      </TouchableOpacity>

      {lastReceipt && (
        <View style={styles.card}>
          <Text style={typography.label}>ÚLTIMA COMPRA</Text>
          <Text style={[typography.body, { fontWeight: "600", marginTop: spacing.xs }]}>
            {lastReceipt.establishment.tradeName ?? lastReceipt.establishment.legalName}
          </Text>
          <Text style={typography.subtitle}>{lastReceipt.items.length} produtos</Text>
          <Text style={typography.price}>R$ {lastReceipt.totalValue.toFixed(2).replace(".", ",")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  scanButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  scanButtonText: { color: colors.accentContrast, fontSize: 18, fontWeight: "700" },
  searchLink: { alignItems: "center", marginBottom: spacing.xl, paddingVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
