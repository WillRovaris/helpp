import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useSugestoes } from "../data/hooks";
import { tamanhoFila } from "../offline/banco";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Configuracoes">;

export function ConfiguracoesScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { signOut } = useAuth();
  const { membros, meuNome } = useCasa();
  const { pendentes } = useSugestoes();

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
      <Cartao style={{ paddingVertical: spacing.xs }}>
        <Item titulo="👤 Perfil" detalhe={meuNome ?? undefined} onPress={() => navigation.navigate("Perfil")} />
        <Item titulo="🔔 Notificações" onPress={() => navigation.navigate("Notificacoes")} borda />
      </Cartao>

      <Cartao style={{ paddingVertical: spacing.xs }}>
        <Item titulo="📥 Entradas do mês" onPress={() => navigation.navigate("Entradas", {})} />
        <Item titulo="💳 Cartões" onPress={() => navigation.navigate("Cartoes")} borda />
        <Item titulo="🧾 Contas fixas" onPress={() => navigation.navigate("Contas")} borda />
        <Item titulo="🎯 Limites por categoria" onPress={() => navigation.navigate("Limites")} borda />
        <Item titulo="🛒 Preço dos produtos" onPress={() => navigation.navigate("Produtos")} borda />
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

      <Botao titulo="📜 Termos de Uso e Privacidade" variante="link" onPress={() => navigation.navigate("Termos")} style={{ marginTop: spacing.md }} />
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
