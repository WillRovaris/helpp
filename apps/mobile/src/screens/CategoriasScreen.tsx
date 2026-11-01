import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Botao, Cartao, IconeCategoria, useEspacoRodape } from "../components/ui";
import { useCategorias } from "../data/hooks";
import { emojiCategoria } from "../data/tipos";
import { principaisDe, subcategoriasDe } from "../lib/categorias";
import type { RootStackParamList } from "../navigation/types";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Categorias">;

// Categorias da casa: principais com as subcategorias dentro. Criar, renomear, trocar ícone/cor,
// limite (só na principal) e excluir — sem precisar de SQL.
export function CategoriasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { categorias } = useCategorias();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>Toque numa categoria para mudar nome, ícone, cor ou limite. As subcategorias são opcionais: o total delas soma na principal.</Text>
      {principaisDe(categorias).map((c) => (
        <Cartao key={c.id} style={{ paddingVertical: spacing.xs }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("CategoriaForm", { categoriaId: c.id })}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}
          >
            <IconeCategoria categoria={c} tamanho={38} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { fontWeight: "700" }]}>{c.nome}</Text>
              {c.limite ? <Text style={typography.label}>🎯 limite {mostrarValor(c.limite)} por mês</Text> : null}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
          {subcategoriasDe(categorias, c.id).map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => navigation.navigate("CategoriaForm", { categoriaId: s.id })}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs + 2, paddingLeft: 50, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Text style={{ fontSize: 16 }}>{emojiCategoria(s.icone)}</Text>
              <Text style={[typography.body, { flex: 1 }]}>{s.nome}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
          {emojiCategoria(c.icone) === "🛒" && (
            <TouchableOpacity onPress={() => navigation.navigate("Alimentos")} style={{ paddingVertical: spacing.sm, paddingLeft: 50, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>🥗 Tipos de produto (carnes, frutas...) ›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate("CategoriaForm", { paiId: c.id })} style={{ paddingVertical: spacing.sm, paddingLeft: 50, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>+ Nova subcategoria</Text>
          </TouchableOpacity>
        </Cartao>
      ))}
      <Botao titulo="+ Nova categoria principal" onPress={() => navigation.navigate("CategoriaForm", {})} />
    </ScrollView>
  );
}
