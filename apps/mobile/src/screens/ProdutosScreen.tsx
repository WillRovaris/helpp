import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Cartao, estiloInput, useEspacoRodape } from "../components/ui";
import { useProdutos } from "../data/hooks";
import { somarMeses } from "../lib/fatura";
import { hojeISO } from "../lib/format";
import { buscarProdutos, maisGastos, type Produto } from "../lib/produtos";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Produtos">;

const PERIODOS = [
  { meses: 1, rotulo: "1 mês" },
  { meses: 3, rotulo: "3 meses" },
  { meses: 12, rotulo: "1 ano" },
];

// Preço dos produtos: busca no que já foi comprado (itens das notas) e os que mais pesam no bolso.
export function ProdutosScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { produtos, notas } = useProdutos();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState(3);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const desde = somarMeses(hojeISO(), -periodo);
  const achados = useMemo(() => (busca.trim() ? buscarProdutos(produtos, busca).sort((a, b) => b.vezes - a.vezes) : []), [produtos, busca]);
  const top = useMemo(() => maisGastos(produtos, desde, 20), [produtos, desde]);

  if (!notas) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: rodape }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Aqui aparecem os preços de tudo o que vocês compram. Leia o QR Code das notas fiscais (Lançar despesa → 📷 Ler nota): a cada compra, o app guarda o preço de cada
          produto para comparar entre mercados e ver se está subindo.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        value={busca}
        onChangeText={setBusca}
        placeholder="🔍 Buscar produto (ex.: leite, café, arroz)"
        placeholderTextColor={colors.textSecondary}
        style={estiloInput()}
        autoCorrect={false}
      />

      {busca.trim() ? (
        achados.length ? (
          <Cartao style={{ paddingVertical: spacing.xs }}>
            {achados.slice(0, 50).map((p, i) => (
              <LinhaProduto key={p.chave} p={p} borda={i > 0} onPress={() => navigation.navigate("Produto", { chave: p.chave })}>
                <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(p.ultimoPreco)}</Text>
              </LinhaProduto>
            ))}
          </Cartao>
        ) : (
          <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.md }]}>Nenhum produto com esse nome nas notas lidas.</Text>
        )
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={typography.label}>ONDE MAIS GASTARAM</Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {PERIODOS.map((op) => (
                <TouchableOpacity key={op.meses} onPress={() => setPeriodo(op.meses)} hitSlop={6}>
                  <Text style={[typography.label, { color: periodo === op.meses ? colors.accent : colors.textSecondary, fontWeight: periodo === op.meses ? "700" : "400" }]}>
                    {op.rotulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {top.length ? (
            <Cartao style={{ paddingVertical: spacing.xs }}>
              {top.map(({ produto, gasto }, i) => (
                <LinhaProduto key={produto.chave} p={produto} borda={i > 0} onPress={() => navigation.navigate("Produto", { chave: produto.chave })}>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(gasto)}</Text>
                </LinhaProduto>
              ))}
            </Cartao>
          ) : (
            <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.md }]}>Nenhuma nota lida neste período.</Text>
          )}
          <Text style={[typography.label, { textAlign: "center" }]}>
            {produtos.length} produtos em {notas} {notas === 1 ? "nota lida" : "notas lidas"}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function LinhaProduto({ p, borda, onPress, children }: { p: Produto; borda: boolean; onPress: () => void; children: React.ReactNode }) {
  const variacao = p.variacao != null && Math.abs(p.variacao) >= 0.01 ? p.variacao : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: borda ? 1 : 0, borderTopColor: colors.border }}
    >
      <View style={{ flex: 1 }}>
        <Text style={typography.body} numberOfLines={1}>
          {p.nome}
        </Text>
        <Text style={typography.label}>
          {p.vezes} {p.vezes === 1 ? "compra" : "compras"}
          {variacao != null && (
            <Text style={{ color: variacao > 0 ? colors.danger : colors.accent }}>{`  ${variacao > 0 ? "▲" : "▼"} ${Math.round(Math.abs(variacao) * 100)}%`}</Text>
          )}
        </Text>
      </View>
      {children}
      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
