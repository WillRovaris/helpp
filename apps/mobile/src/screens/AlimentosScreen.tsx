import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { TiposDeAlimentos } from "../components/TiposDeAlimentos";
import { Chip, useEspacoRodape } from "../components/ui";
import { somarMeses } from "../lib/fatura";
import { hojeISO, MESES, somarDias } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Alimentos">;

// "30 dias", "3 meses" e "1 ano" contam para trás a partir de hoje; "Por mês" anda mês a mês.
type Periodo = "30d" | "mes" | "3m" | "1a";
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Por mês" },
  { id: "3m", rotulo: "3 meses" },
  { id: "1a", rotulo: "1 ano" },
];
const dataCurta = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5) + "/" + iso.slice(2, 4);

const proximoMes = (m: string) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Tipos de Alimentos: escolha do período; o resumo por tipo fica em components/TiposDeAlimentos.
// Aberto com um mês (YYYY-MM), já começa em "Por mês" naquele mês.
export function AlimentosScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const mesAtual = hojeISO().slice(0, 7);
  const [mes, setMes] = useState(route.params?.mes ?? mesAtual);
  const [periodo, setPeriodo] = useState<Periodo>(route.params?.mes ? "mes" : "30d");
  const hoje = hojeISO();
  const de = periodo === "mes" ? `${mes}-01` : periodo === "30d" ? somarDias(hoje, -29) : somarDias(somarMeses(hoje, periodo === "3m" ? -3 : -12), 1);
  const ate = periodo === "mes" ? `${mes}-31` : hoje;

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center", flexWrap: "wrap" }}>
        {PERIODOS.map((p) => (
          <Chip key={p.id} rotulo={p.rotulo} ativo={periodo === p.id} onPress={() => setPeriodo(p.id)} />
        ))}
      </View>
      {periodo === "mes" ? (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700" }]}>{`${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`}</Text>
        <TouchableOpacity onPress={() => setMes(proximoMes(mes))} disabled={mes >= mesAtual} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: spacing.sm, opacity: mes >= mesAtual ? 0.3 : 1 }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>
      ) : (
        <Text style={[typography.body, { fontWeight: "700", textAlign: "center" }]}>De {dataCurta(de)} até hoje</Text>
      )}

      <TiposDeAlimentos de={de} ate={ate} comTotal />
    </ScrollView>
  );
}
