import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Cartao, useEspacoRodape } from "../components/ui";
import { useAssinaturas, useCartoes } from "../data/hooks";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Assinaturas">;

// Assinaturas detectadas: cobranças que se repetem todo mês (ex.: Netflix) e ainda não são conta fixa.
export function AssinaturasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { assinaturas, ignorar } = useAssinaturas();
  const { cartoes } = useCartoes();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const totalMes = assinaturas.reduce((s, a) => s + a.valor, 0);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        O app procura nas despesas (principalmente nas faturas importadas) cobranças com o mesmo nome e valor parecido em pelo menos 3 meses. Confira se ainda usa cada uma.
      </Text>

      {assinaturas.length > 0 && (
        <Cartao>
          <Text style={typography.label}>🔁 {assinaturas.length} {assinaturas.length === 1 ? "COBRANÇA QUE SE REPETE" : "COBRANÇAS QUE SE REPETEM"}</Text>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(totalMes)} por mês</Text>
          <Text style={typography.label}>{mostrarValor(totalMes * 12)} por ano</Text>
        </Cartao>
      )}

      {assinaturas.length === 0 ? (
        <Text style={[typography.body, { textAlign: "center", paddingVertical: spacing.lg }]}>
          ✅ Nenhuma cobrança repetida sem cadastro. Importe as faturas dos cartões todo mês para o app conseguir encontrar.
        </Text>
      ) : (
        assinaturas.map((a) => {
          const cartao = a.cartaoId ? cartoes.find((c) => c.id === a.cartaoId) : undefined;
          return (
            <Cartao key={`${a.chave}|${a.cartaoId}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={{ fontSize: 24 }}>🔁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: "700" }]} numberOfLines={1}>
                    {a.nome}
                  </Text>
                  <Text style={typography.label}>
                    cobrada em {a.meses} meses · por volta do dia {a.dia}
                    {cartao ? ` · 💳 ${cartao.nome}` : ""}
                  </Text>
                </View>
                <Text style={[typography.body, { fontWeight: "700" }]}>{mostrarValor(a.valor)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, justifyContent: "flex-end" }}>
                <TouchableOpacity onPress={() => ignorar(a.chave)} hitSlop={8}>
                  <Text style={[typography.label, { color: colors.textSecondary }]}>Não é assinatura</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate("ContaForm", { preencher: { nome: a.nome, valor: a.valor, dia: a.dia, categoriaId: a.categoriaId } })}
                  hitSlop={8}
                >
                  <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>Cadastrar como conta fixa ›</Text>
                </TouchableOpacity>
              </View>
            </Cartao>
          );
        })
      )}
    </ScrollView>
  );
}
