import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, Chip, useEspacoRodape } from "../components/ui";
import { useEntradasDoMes, useSugestoes } from "../data/hooks";
import { type ConfigLembretes, lerConfigLembretes, salvarConfigLembretes } from "../lembretes/lembretes";
import { formatarReais } from "../lib/format";
import { tamanhoFila } from "../offline/banco";
import type { RootStackParamList } from "../navigation/types";
import { type PreferenciaTema, useTema } from "../tema/TemaContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Configuracoes">;

const TEMAS: { valor: PreferenciaTema; rotulo: string }[] = [
  { valor: "sistema", rotulo: "📱 Igual ao celular" },
  { valor: "claro", rotulo: "☀️ Claro" },
  { valor: "escuro", rotulo: "🌙 Escuro" },
];

export function ConfiguracoesScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { session, signOut } = useAuth();
  const { casa, membros } = useCasa();
  const { preferencia, escolher } = useTema();
  const { pendentes } = useSugestoes();
  const hoje = new Date();
  const { total: entradasMes } = useEntradasDoMes(hoje.getFullYear(), hoje.getMonth());
  const [lembretes, setLembretes] = useState<ConfigLembretes | null>(null);

  useEffect(() => {
    lerConfigLembretes().then(setLembretes);
  }, []);

  function mudarLembretes(c: ConfigLembretes) {
    setLembretes(c);
    salvarConfigLembretes(c, casa?.id);
  }

  function sair() {
    const n = tamanhoFila();
    const aviso = n
      ? `⚠️ ${n} ${n === 1 ? "lançamento ainda não subiu" : "lançamentos ainda não subiram"} para a nuvem (sem internet). Se sair agora, ${n === 1 ? "ele será perdido" : "eles serão perdidos"}. Conecte à internet e espere sincronizar antes de sair.`
      : "Seus dados continuam salvos na nuvem. É só entrar de novo depois.";
    Alert.alert("Sair da conta?", aviso, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>APARÊNCIA</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TEMAS.map((t) => (
            <Chip key={t.valor} rotulo={t.rotulo} ativo={preferencia === t.valor} onPress={() => escolher(t.valor)} />
          ))}
        </View>
      </Cartao>

      {lembretes && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>🔔 LEMBRETES DE CONTAS E FATURAS</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Chip rotulo="Ligados" ativo={lembretes.ativo} onPress={() => mudarLembretes({ ...lembretes, ativo: true })} />
            <Chip rotulo="Desligados" ativo={!lembretes.ativo} onPress={() => mudarLembretes({ ...lembretes, ativo: false })} />
          </View>
          {lembretes.ativo && (
            <>
              <Text style={[typography.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>HORÁRIO (NO DIA ANTERIOR E NO DIA DO VENCIMENTO)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {[7, 8, 9, 12, 18, 20].map((h) => (
                  <Chip key={h} rotulo={`${h}h`} ativo={lembretes.hora === h} onPress={() => mudarLembretes({ ...lembretes, hora: h })} />
                ))}
              </View>
            </>
          )}
        </Cartao>
      )}

      <Cartao style={{ paddingVertical: spacing.xs }}>
        <Item titulo="📥 Entradas do mês" detalhe={entradasMes ? formatarReais(entradasMes) : "Nenhuma"} onPress={() => navigation.navigate("Entradas", {})} />
        <Item titulo="💳 Cartões" onPress={() => navigation.navigate("Cartoes")} borda />
        <Item titulo="🧾 Contas fixas" onPress={() => navigation.navigate("Contas")} borda />
        <Item titulo="📄 Importar extrato ou fatura" onPress={() => navigation.navigate("Importar")} borda />
        <Item
          titulo={membros.length > 1 ? "👥 Casa compartilhada" : "👥 Compartilhar com alguém"}
          detalhe={membros.length > 1 ? membros.map((m) => m.nome).join(" e ") : "Opcional"}
          onPress={() => navigation.navigate("Compartilhar")}
          borda
        />
        <Item
          titulo="💡 Sugestões e melhorias"
          detalhe={pendentes.length ? `${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}` : undefined}
          onPress={() => navigation.navigate("Sugestoes")}
          borda
        />
      </Cartao>

      <Text style={[typography.label, { textAlign: "center", marginTop: spacing.md }]}>{session?.user.email}</Text>
      <Botao titulo="Sair da conta" variante="link" onPress={sair} />
    </ScrollView>
  );
}

function Item({ titulo, detalhe, onPress, borda }: { titulo: string; detalhe?: string; onPress: () => void; borda?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: borda ? 1 : 0, borderTopColor: colors.border }}
    >
      <Text style={[typography.body, { flex: 1 }]}>{titulo}</Text>
      {detalhe && <Text style={[typography.label, { marginRight: spacing.sm }]}>{detalhe}</Text>}
      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
