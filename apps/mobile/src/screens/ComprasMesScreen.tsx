import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { TiposDeAlimentos } from "../components/TiposDeAlimentos";
import { Cartao, useEspacoRodape } from "../components/ui";
import { useComprasDoMes } from "../data/hooks";
import { hojeISO, MESES, rotuloDia } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import { atualizar } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ComprasMes">;

const proximoMes = (m: string) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const quantidadeTexto = (q: number) => (q !== 1 ? `${String(q).replace(".", ",")} × ` : "");

// Compras do mês: tudo o que foi comprado no supermercado (itens das notas + o que foi marcado com ✓
// na lista), mês a mês, para acompanhar o que e quanto a casa compra.
export function ComprasMesScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const mesAtual = hojeISO().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const { compras, marcados, semItens, total, totalMercado, qtdItens } = useComprasDoMes(mes);
  // As notas ficam escondidas: a tela abre nos Tipos de Alimentos (pedido do dono).
  const [verCompras, setVerCompras] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const voltarParaLista = (id: string) => atualizar("lista_compras", id, { comprado: false, comprado_em: null, nota_item_id: null });
  const botaoVoltar = (id: string) => (
    <TouchableOpacity onPress={() => voltarParaLista(id)} hitSlop={8} accessibilityLabel="Voltar para a lista de compras" style={{ marginLeft: spacing.sm }}>
      <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>↩️ Voltar</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700" }]}>
          {MESES[Number(mes.slice(5, 7)) - 1]} de {mes.slice(0, 4)}
        </Text>
        <TouchableOpacity onPress={() => setMes(proximoMes(mes))} disabled={mes >= mesAtual} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: spacing.sm, opacity: mes >= mesAtual ? 0.3 : 1 }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        <Text style={typography.label}>🛒 GASTO NO SUPERMERCADO</Text>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(totalMercado)}</Text>
        <Text style={typography.label}>
          {compras.length} {compras.length === 1 ? "nota com produtos" : "notas com produtos"} ({mostrarValor(total)})
          {semItens.length > 0 && ` · ${semItens.length} sem produtos (${mostrarValor(totalMercado - total)})`}
        </Text>
      </Cartao>

      {qtdItens === 0 && semItens.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Nada comprado neste mês. Leia as notas do mercado ou marque ✓ na lista de compras.</Text>
      ) : (
        <>
          {compras.length > 0 && <TiposDeAlimentos de={`${mes}-01`} ate={`${mes}-31`} />}
          <TouchableOpacity onPress={() => setVerCompras((v) => !v)} activeOpacity={0.8}>
            <Cartao style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Text style={{ fontSize: 24 }}>🧾</Text>
              <Text style={[typography.body, { flex: 1, fontWeight: "700" }]}>Minhas compras do mês</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{verCompras ? "▲" : "▼"}</Text>
            </Cartao>
          </TouchableOpacity>
        </>
      )}

      {verCompras && compras.map((c) => (
        <Cartao key={c.notaId} style={{ paddingVertical: spacing.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { fontWeight: "700" }]} numberOfLines={1}>
                {c.mercado}
              </Text>
              <Text style={typography.label}>{rotuloDia(c.data)}</Text>
            </View>
            <Text style={[typography.body, { fontWeight: "700" }]}>{mostrarValor(c.total)}</Text>
          </View>
          {c.itens.map((i) => (
            <View key={i.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[typography.body, { flex: 1, fontSize: 14 }]} numberOfLines={2}>
                {quantidadeTexto(i.quantidade)}
                {i.nome}
              </Text>
              <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>{mostrarValor(i.valor)}</Text>
              {i.listaId && botaoVoltar(i.listaId)}
            </View>
          ))}
        </Cartao>
      ))}

      {verCompras && semItens.length > 0 && (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          <Text style={[typography.label, { paddingVertical: spacing.sm }]}>🧾 SEM A LISTA DE PRODUTOS · toque para abrir</Text>
          {semItens.map((d, i) => (
            <TouchableOpacity
              key={d.gastoId ?? `sem-${i}`}
              disabled={!d.gastoId}
              onPress={() => d.gastoId && navigation.navigate("GastoForm", { gastoId: d.gastoId })}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontSize: 14 }]} numberOfLines={1}>
                  {d.descricao}
                </Text>
                <Text style={typography.label}>
                  {rotuloDia(d.data)} · {d.notaSemItens ? "nota lida, mas os produtos não vieram" : "lançada sem nota"}
                </Text>
              </View>
              <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>{mostrarValor(d.valor)}</Text>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}

      {verCompras && marcados.length > 0 && (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          <Text style={[typography.label, { paddingVertical: spacing.sm }]}>✓ MARCADOS NA LISTA (SEM NOTA)</Text>
          {marcados.map((i) => (
            <View key={i.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontSize: 14 }]} numberOfLines={2}>
                  {quantidadeTexto(i.quantidade)}
                  {i.nome}
                </Text>
                <Text style={typography.label}>{rotuloDia(i.data)}</Text>
              </View>
              {botaoVoltar(i.id)}
            </View>
          ))}
        </Cartao>
      )}
    </ScrollView>
  );
}
