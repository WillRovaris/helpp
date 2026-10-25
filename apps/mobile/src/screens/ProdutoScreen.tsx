import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { Cartao, useEspacoRodape } from "../components/ui";
import { useProdutos } from "../data/hooks";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Produto">;

const dataBR = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");
const qtdBR = (q: number) => String(Math.round(q * 1000) / 1000).replace(".", ",");

// Um produto: último preço, menor/médio/maior, mercado mais barato, se subiu e cada compra.
export function ProdutoScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { produtos } = useProdutos();
  const p = produtos.find((x) => x.chave === route.params.chave);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  if (!p) return null;
  const variacao = p.variacao != null && Math.abs(p.variacao) >= 0.01 ? p.variacao : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>{p.nome}</Text>
        <Text style={[typography.label, { marginTop: spacing.sm }]}>ÚLTIMO PREÇO (UNIDADE)</Text>
        <Text style={{ fontSize: 32, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(p.ultimoPreco)}</Text>
        {variacao != null && (
          <Text style={[typography.label, { color: variacao > 0 ? colors.danger : colors.accent }]}>
            {variacao > 0 ? "▲ Subiu" : "▼ Baixou"} {Math.round(Math.abs(variacao) * 100)}% desde a primeira compra ({dataBR(p.compras[p.compras.length - 1].data)})
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
          <Numero rotulo="MENOR" valor={mostrarValor(p.menorPreco)} cor={colors.accent} />
          <Numero rotulo="MÉDIO" valor={mostrarValor(p.precoMedio)} />
          <Numero rotulo="MAIOR" valor={mostrarValor(p.maiorPreco)} cor={colors.danger} />
        </View>
      </Cartao>

      {p.maisBarato && (
        <Cartao style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ fontSize: 26 }}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={typography.label}>ONDE ESTÁ MAIS BARATO</Text>
            <Text style={[typography.body, { fontWeight: "700" }]}>{p.maisBarato.mercado}</Text>
            <Text style={typography.label}>preço médio {mostrarValor(p.maisBarato.precoMedio)}</Text>
          </View>
        </Cartao>
      )}

      <Text style={typography.label}>
        COMPRAS ({p.vezes}) · TOTAL {mostrarValor(p.totalGasto)}
      </Text>
      <Cartao style={{ paddingVertical: spacing.xs }}>
        {p.compras.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body} numberOfLines={1}>
                {c.mercado}
              </Text>
              <Text style={typography.label}>
                {dataBR(c.data)} · {qtdBR(c.quantidade)} × {mostrarValor(c.precoUnitario)}
              </Text>
            </View>
            <Text style={[typography.body, { fontWeight: "600", color: c.precoUnitario === p.menorPreco ? colors.accent : colors.textPrimary }]}>
              {mostrarValor(c.total)}
            </Text>
          </View>
        ))}
      </Cartao>
    </ScrollView>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={typography.label}>{rotulo}</Text>
      <Text style={[typography.body, { fontWeight: "700", color: cor ?? colors.textPrimary }]}>{valor}</Text>
    </View>
  );
}
