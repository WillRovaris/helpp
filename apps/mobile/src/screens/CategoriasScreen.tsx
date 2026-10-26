import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Botao, Cartao, IconeCategoria, useEspacoRodape } from "../components/ui";
import { useCategorias } from "../data/hooks";
import type { RootStackParamList } from "../navigation/types";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Categorias">;

// Categorias da casa: criar, renomear, trocar ícone/cor, limite e excluir — sem precisar de SQL.
export function CategoriasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { categorias } = useCategorias();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>Toque numa categoria para mudar nome, ícone, cor ou limite.</Text>
      <Cartao style={{ paddingVertical: spacing.xs }}>
        {categorias.map((c, i) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => navigation.navigate("CategoriaForm", { categoriaId: c.id })}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
          >
            <IconeCategoria categoria={c} tamanho={38} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{c.nome}</Text>
              {c.limite ? <Text style={typography.label}>🎯 limite {mostrarValor(c.limite)} por mês</Text> : null}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </Cartao>
      <Botao titulo="+ Nova categoria" onPress={() => navigation.navigate("CategoriaForm", {})} />
    </ScrollView>
  );
}
