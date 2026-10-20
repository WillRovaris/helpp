import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, Chip } from "../components/ui";
import { formatarReais } from "../lib/format";
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
  const { session, signOut } = useAuth();
  const { casa, membros } = useCasa();
  const { preferencia, escolher } = useTema();

  function sair() {
    Alert.alert("Sair da conta?", "Seus dados continuam salvos. É só entrar de novo depois.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>APARÊNCIA</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TEMAS.map((t) => (
            <Chip key={t.valor} rotulo={t.rotulo} ativo={preferencia === t.valor} onPress={() => escolher(t.valor)} />
          ))}
        </View>
      </Cartao>

      <Cartao style={{ paddingVertical: spacing.xs }}>
        <Item titulo="📥 Renda do mês" detalhe={casa?.renda_mensal ? formatarReais(casa.renda_mensal) : "Não informada"} onPress={() => navigation.navigate("Renda")} />
        <Item titulo="💳 Cartões" onPress={() => navigation.navigate("Cartoes")} borda />
        <Item
          titulo={membros.length > 1 ? "👥 Casa compartilhada" : "👥 Compartilhar com alguém"}
          detalhe={membros.length > 1 ? membros.map((m) => m.nome).join(" e ") : "Opcional"}
          onPress={() => navigation.navigate("Compartilhar")}
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
