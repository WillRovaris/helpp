import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ProductDetail">;

interface PriceAtEstablishment {
  establishment: { id: string; name: string; city: string | null };
  price: number;
  unitPrice: number | null;
  purchaseDate: string;
}

interface ProductDetailResponse {
  hasEnoughData: boolean;
  currentPrices: PriceAtEstablishment[];
  history: { price: number; purchaseDate: string }[];
}

export function ProductDetailScreen({ route }: Props) {
  const { productId, name } = route.params;
  const [data, setData] = useState<ProductDetailResponse | null>(null);

  useEffect(() => {
    apiFetch<ProductDetailResponse>(`/api/products/${productId}`).then(setData);
  }, [productId]);

  if (!data) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const cheapest = data.currentPrices[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.title}>{name}</Text>
        {cheapest && (
          <>
            <Text style={typography.label}>MENOR PREÇO ENCONTRADO</Text>
            <Text style={[typography.price, { fontSize: 28 }]}>R$ {cheapest.price.toFixed(2).replace(".", ",")}</Text>
          </>
        )}
      </View>

      <Text style={[typography.label, { paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>PREÇOS POR ESTABELECIMENTO</Text>
      <FlatList
        data={data.currentPrices}
        keyExtractor={(item) => item.establishment.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={typography.body}>{item.establishment.name}</Text>
              <Text style={typography.label}>Atualizado em {new Date(item.purchaseDate).toLocaleDateString("pt-BR")}</Text>
            </View>
            <Text style={[typography.body, { fontWeight: "700" }]}>R$ {item.price.toFixed(2).replace(".", ",")}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={typography.subtitle}>Ainda não temos preços registrados para este produto.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
