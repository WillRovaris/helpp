import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Cartao, Chip, useEspacoRodape } from "../components/ui";
import { useCalculoMensal } from "../data/hooks";
import { hojeISO, MESES } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Evolucao">;

const proximoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};
const nomeCurto = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3);
const ALTURA = 160;

// Gráfico dos últimos meses: entradas × despesas lado a lado, mais os 2 próximos meses (previsão).
export function EvolucaoScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const calc = useCalculoMensal();
  const [qtd, setQtd] = useState(6);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const atual = hojeISO().slice(0, 7);
  const meses = useMemo(() => {
    const lista: string[] = [atual];
    while (lista.length < qtd) lista.unshift(mesAnterior(lista[0]));
    lista.push(proximoMes(atual), proximoMes(proximoMes(atual)));
    return lista.map((m) => {
      const entradas = calc.entradasDoMes(m);
      const despesas = calc.despesaDoMes(m);
      const anterior = calc.saldoAnterior(m);
      return { mes: m, entradas, despesas, sobra: entradas + anterior - despesas, futuro: m > atual };
    });
  }, [calc, atual, qtd]);

  const maior = Math.max(1, ...meses.map((m) => Math.max(m.entradas, m.despesas)));
  const passados = meses.filter((m) => !m.futuro && m.mes !== atual && (m.entradas > 0 || m.despesas > 0));
  const media = (f: (m: (typeof meses)[number]) => number) => (passados.length ? passados.reduce((s, m) => s + f(m), 0) / passados.length : 0);
  const melhor = passados.filter((m) => m.entradas > 0).sort((a, b) => b.sobra - a.sobra)[0];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Chip rotulo="6 meses" ativo={qtd === 6} onPress={() => setQtd(6)} />
        <Chip rotulo="12 meses" ativo={qtd === 12} onPress={() => setQtd(12)} />
      </View>

      <Cartao>
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
          <Legenda cor={colors.accent} texto="Entradas" />
          <Legenda cor={colors.danger} texto="Despesas" />
          <Legenda cor={colors.border} texto="Previsão" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md, paddingBottom: spacing.xs }}>
            {meses.map((m) => (
              <TouchableOpacity key={m.mes} onPress={() => navigation.navigate("Fechamento", { mes: m.mes })} style={{ alignItems: "center", opacity: m.futuro ? 0.55 : 1 }}>
                <View style={{ height: ALTURA, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
                  <View style={{ width: 14, height: Math.max(2, (m.entradas / maior) * ALTURA), backgroundColor: colors.accent, borderRadius: 4 }} />
                  <View style={{ width: 14, height: Math.max(2, (m.despesas / maior) * ALTURA), backgroundColor: colors.danger, borderRadius: 4 }} />
                </View>
                <Text style={[typography.label, { marginTop: 4, fontWeight: m.mes === atual ? "700" : "400", color: m.mes === atual ? colors.textPrimary : colors.textSecondary }]}>
                  {nomeCurto(m.mes)}
                </Text>
                <Text style={[typography.label, { fontSize: 10, color: m.sobra < 0 ? colors.danger : colors.accent }]}>
                  {m.entradas > 0 || m.sobra !== 0 ? `${m.sobra < 0 ? "−" : "+"}${mostrarValor(Math.abs(Math.round(m.sobra))).replace("R$ ", "").replace(/,00$/, "")}` : "—"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={[typography.label, { marginTop: spacing.sm }]}>Embaixo de cada mês: quanto sobrou (+) ou faltou (−). Toque num mês para ver o balanço.</Text>
      </Cartao>

      {passados.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>MÉDIA POR MÊS ({passados.length} {passados.length === 1 ? "MÊS FECHADO" : "MESES FECHADOS"})</Text>
          <Linha rotulo="📥 Entradas" valor={mostrarValor(media((m) => m.entradas))} cor={colors.accent} />
          <Linha rotulo="💸 Despesas" valor={mostrarValor(media((m) => m.despesas))} cor={colors.danger} />
          {melhor && <Linha rotulo={`🏆 Melhor mês: ${MESES[Number(melhor.mes.slice(5, 7)) - 1].toLowerCase()}`} valor={`sobrou ${mostrarValor(melhor.sobra)}`} />}
        </Cartao>
      )}
    </ScrollView>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
      <Text style={typography.label}>{texto}</Text>
    </View>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={typography.body}>{rotulo}</Text>
      <Text style={[typography.body, { fontWeight: "600", color: cor ?? colors.textPrimary }]}>{valor}</Text>
    </View>
  );
}
