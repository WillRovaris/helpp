import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

interface ProductResult {
  id: string;
  name: string;
  contentValue: number | null;
  contentUnit: string | null;
  lastPrice: number | null;
  lastUpdate: string | null;
}

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      const data = await apiFetch<ProductResult[]>(`/api/products/search?q=${encodeURIComponent(text)}`);
      setResults(data);
      setSearched(true);
    } catch {
      setResults([]);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Buscar produto (ex: Coca-Cola, Arroz...)"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={handleSearch}
        autoFocus
      />

      {searched && results.length === 0 && (
        <Text style={[typography.subtitle, { textAlign: "center", marginTop: spacing.xl }]}>
          Nenhum produto encontrado ainda com esse nome.
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultCard} onPress={() => navigation.navigate("ProductDetail", { productId: item.id, name: item.name })}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.name}</Text>
              {item.contentValue && (
                <Text style={typography.label}>
                  {item.contentValue}
                  {item.contentUnit}
                </Text>
              )}
            </View>
            {item.lastPrice != null && <Text style={typography.price}>R$ {item.lastPrice.toFixed(2).replace(".", ",")}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  input: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  resultCard: {
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
