import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useEntradasDoMes, useSaldoAnterior } from "../data/hooks";
import { tipoReceita } from "../data/tipos";
import { hojeISO, MESES } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Entradas">;

const proximoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};
const nomeMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];

// Entradas do mês: sobra do mês anterior (✏️ para corrigir) + entradas lançadas (salário, extra...).
export function EntradasScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { membros } = useCasa();
  const [mes, setMes] = useState(route.params?.mes ?? hojeISO().slice(0, 7));
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7)) - 1;
  const { entradas, total } = useEntradasDoMes(ano, m);
  const { saldo, ajustado } = useSaldoAnterior(ano, m);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho /> });
  }, [navigation]);

  const nomeDe = (id: string | null) => membros.find((p) => p.user_id === id)?.nome ?? "";
  const anterior = nomeMes(mesAnterior(mes)).toLowerCase();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} style={{ padding: spacing.sm }} accessibilityLabel="Mês anterior">
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700" }]}>
          {nomeMes(mes)} {ano}
        </Text>
        <TouchableOpacity onPress={() => setMes(proximoMes(mes))} style={{ padding: spacing.sm }} accessibilityLabel="Próximo mês">
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        <Text style={typography.label}>DISPONÍVEL EM {nomeMes(mes).toUpperCase()}</Text>
        <Text style={{ fontSize: 34, fontWeight: "700", color: colors.accent, marginTop: spacing.xs }}>{mostrarValor(total + saldo)}</Text>
        <Text style={typography.label}>
          Entradas {mostrarValor(total)} {saldo < 0 ? "−" : "+"} sobra de {anterior} {mostrarValor(Math.abs(saldo))}
        </Text>
      </Cartao>

      {/* Sobra do mês anterior: entra sozinha; ✏️ corrige. */}
      <TouchableOpacity onPress={() => navigation.navigate("SaldoAnterior", { mes })} activeOpacity={0.8}>
        <Cartao style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ fontSize: 26 }}>↪️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { fontWeight: "600" }]}>Sobra de {anterior}</Text>
            <Text style={typography.label}>{ajustado ? "Corrigida por você" : saldo === 0 ? `Nada sobrou ou ${anterior} não teve entradas` : "Calculada sozinha"}</Text>
          </View>
          <Text style={[typography.body, { fontWeight: "700", color: saldo < 0 ? colors.danger : colors.textPrimary }]}>
            {saldo < 0 ? "−" : ""}
            {mostrarValor(Math.abs(saldo))}
          </Text>
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </Cartao>
      </TouchableOpacity>

      <Text style={typography.label}>ENTRADAS ({entradas.length})</Text>
      {entradas.length === 0 ? (
        <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.md }]}>Nenhuma entrada lançada neste mês.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {entradas.map((r, i) => {
            const t = tipoReceita(r.tipo);
            const detalhes = [membros.length > 1 ? nomeDe(r.recebido_por) : "", r.recorrente ? "🔁 todo mês" : r.data.split("-").reverse().slice(0, 2).join("/")].filter(Boolean);
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => navigation.navigate("ReceitaForm", { receitaId: r.id, mes })}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
              >
                <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>
                    {r.descricao ? `${t.nome} · ${r.descricao}` : t.nome}
                  </Text>
                  <Text style={typography.label}>{detalhes.join(" · ")}</Text>
                </View>
                <Text style={[typography.body, { fontWeight: "700", color: colors.accent }]}>{mostrarValor(r.valor)}</Text>
              </TouchableOpacity>
            );
          })}
        </Cartao>
      )}

      <Botao titulo="+ Lançar entrada" onPress={() => navigation.navigate("ReceitaForm", { mes })} style={{ minHeight: 58 }} />
    </ScrollView>
  );
}
