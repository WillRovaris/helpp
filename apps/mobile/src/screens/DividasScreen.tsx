import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Barra } from "../components/ResumoMes";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCartoes, useCategorias, useDividas } from "../data/hooks";
import { MESES } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Dividas">;

const mesAno = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}/${m.slice(2, 4)}`;

// Dívidas e parcelamentos: empréstimos/contas com prazo (contas fixas com "meses") e compras
// parceladas — quanto falta pagar e quando termina. Nada novo para cadastrar: usa o que já existe.
export function DividasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { dividas, parcelados, total } = useDividas();
  const { cartoes } = useCartoes();
  const { categorias } = useCategorias();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const novaDivida = () =>
    navigation.navigate("ContaForm", { preencher: { categoriaId: categorias.find((c) => c.icone === "cash")?.id ?? null, meses: 12 } });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={typography.label}>💳 FALTA PAGAR NO TOTAL</Text>
        <Text style={{ fontSize: 32, fontWeight: "700", color: total > 0 ? colors.danger : colors.accent }}>{mostrarValor(total)}</Text>
        <Text style={typography.label}>
          {dividas.length} {dividas.length === 1 ? "dívida/conta com prazo" : "dívidas/contas com prazo"} · {parcelados.length}{" "}
          {parcelados.length === 1 ? "compra parcelada" : "compras parceladas"}
        </Text>
      </Cartao>

      <Text style={typography.label}>🏦 EMPRÉSTIMOS E CONTAS COM PRAZO</Text>
      {dividas.length === 0 ? (
        <Text style={[typography.label, { paddingVertical: spacing.xs }]}>Nenhuma. Cadastre um empréstimo como conta fixa com número de meses.</Text>
      ) : (
        dividas.map((d) => (
          <TouchableOpacity key={d.id} onPress={() => navigation.navigate("ContaForm", { contaId: d.id })} activeOpacity={0.8}>
            <Cartao>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.body, { fontWeight: "700", flex: 1 }]} numberOfLines={1}>
                  {d.nome}
                </Text>
                <Text style={[typography.body, { fontWeight: "700" }]}>{d.valorRestante != null ? mostrarValor(d.valorRestante) : "valor varia"}</Text>
              </View>
              <View style={{ marginVertical: spacing.xs }}>
                <Barra fracao={d.pagas / d.total} cor={colors.accent} />
              </View>
              <Text style={typography.label}>
                {d.pagas} de {d.total} pagas · faltam {d.restantes}
                {d.valorParcela != null ? ` de ${mostrarValor(d.valorParcela)}` : ""} · termina em {mesAno(d.termina)}
              </Text>
            </Cartao>
          </TouchableOpacity>
        ))
      )}
      <Botao titulo="+ Novo empréstimo ou dívida" variante="secundario" onPress={novaDivida} />

      <Text style={[typography.label, { marginTop: spacing.md }]}>🛍️ COMPRAS PARCELADAS</Text>
      {parcelados.length === 0 ? (
        <Text style={[typography.label, { paddingVertical: spacing.xs }]}>Nenhuma compra parcelada com parcelas a pagar.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {parcelados.map((p, i) => {
            const cartao = p.cartaoId ? cartoes.find((c) => c.id === p.cartaoId) : undefined;
            const pagas = p.total - p.restantes;
            return (
              <View key={p.id} style={{ paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
                    {p.descricao}
                  </Text>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(p.valorRestante)}</Text>
                </View>
                <Text style={typography.label}>
                  {cartao ? `💳 ${cartao.nome} · ` : ""}
                  {pagas} de {p.total} · faltam {p.restantes} · termina em {mesAno(p.termina)}
                </Text>
              </View>
            );
          })}
        </Cartao>
      )}
    </ScrollView>
  );
}
