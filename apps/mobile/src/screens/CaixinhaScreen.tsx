import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Barra } from "../components/ResumoMes";
import { Botao, Cartao, estiloInput, IconeCategoria, useEspacoRodape } from "../components/ui";
import { useCaixinhas } from "../data/hooks";
import { planoCaixinha } from "../lib/caixinhas";
import { centavosDoTexto, formatarReais, hojeISO } from "../lib/format";
import { excluir, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Caixinha">;

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// Uma caixinha: quanto tem, meta, quanto guardar por mês, e guardar/tirar dinheiro.
export function CaixinhaScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { caixinhas, movimentos } = useCaixinhas();
  const c = caixinhas.find((x) => x.id === route.params.caixinhaId);
  const [operacao, setOperacao] = useState<"guardar" | "tirar" | null>(null);
  const [centavos, setCentavos] = useState(0);
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    navigation.setOptions({
      title: c?.nome ?? "Caixinha",
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <BotaoOlho tamanho={24} />
          <TouchableOpacity onPress={() => navigation.navigate("CaixinhaForm", { caixinhaId: route.params.caixinhaId })}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>Editar</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, c?.nome, route.params.caixinhaId]);

  if (!c || !casa) return null;
  const p = planoCaixinha(c.saldo, c.meta, c.data_alvo, hojeISO());
  const meus = movimentos.filter((m) => m.caixinha_id === c.id);
  const nomeDe = (id: string | null) => membros.find((m) => m.user_id === id)?.nome;

  function abrir(op: "guardar" | "tirar") {
    setCentavos(0);
    setDescricao("");
    setOperacao(op);
  }

  function confirmar() {
    if (!casa || !c || !operacao) return;
    if (centavos <= 0) return Alert.alert("Valor", "Digite o valor.");
    if (operacao === "tirar" && centavos / 100 > c.saldo) return Alert.alert("Valor maior que o guardado", `A caixinha tem ${formatarReais(c.saldo)}.`);
    inserir("caixinha_movimentos", {
      casa_id: casa.id,
      caixinha_id: c.id,
      valor: (operacao === "guardar" ? centavos : -centavos) / 100,
      data: hojeISO(),
      descricao: descricao.trim() || null,
      created_by: userId,
    });
    setOperacao(null);
  }

  function apagarMovimento(id: string, valor: number) {
    Alert.alert("Apagar este movimento?", `${valor > 0 ? "Guardou" : "Tirou"} ${formatarReais(Math.abs(valor))}`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => excluir("caixinha_movimentos", [id]) },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao style={{ alignItems: "center" }}>
        <IconeCategoria categoria={{ icone: c.emoji, cor: c.cor }} tamanho={64} />
        <Text style={[typography.label, { marginTop: spacing.sm }]}>GUARDADO</Text>
        <Text style={{ fontSize: 34, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(c.saldo)}</Text>
        {p.progresso != null && (
          <View style={{ alignSelf: "stretch", marginTop: spacing.sm }}>
            <Barra fracao={p.progresso} cor={c.cor} />
            <Text style={[typography.label, { marginTop: 4, textAlign: "center" }]}>
              {p.falta === 0 ? "🎉 Meta alcançada!" : `${Math.round(p.progresso * 100)}% da meta de ${mostrarValor(c.meta ?? 0)} · faltam ${mostrarValor(p.falta ?? 0)}`}
            </Text>
            {p.porMes != null && p.porMes > 0 && c.data_alvo && (
              <Text style={[typography.body, { marginTop: spacing.xs, textAlign: "center", fontWeight: "600" }]}>
                Guarde {mostrarValor(p.porMes)} por mês até {dataBR(c.data_alvo)} ({p.meses} {p.meses === 1 ? "mês" : "meses"})
              </Text>
            )}
          </View>
        )}
      </Cartao>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Botao titulo="+ Guardar" onPress={() => abrir("guardar")} style={{ flex: 1 }} />
        <Botao titulo="− Tirar" variante="secundario" onPress={() => abrir("tirar")} style={{ flex: 1 }} />
      </View>

      <Text style={typography.label}>MOVIMENTOS ({meus.length})</Text>
      {meus.length === 0 ? (
        <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.md }]}>Nenhum dinheiro guardado ainda.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {meus.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              onLongPress={() => apagarMovimento(m.id, m.valor)}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
            >
              <Text style={{ fontSize: 18, marginRight: spacing.sm }}>{m.valor > 0 ? "⬆️" : "⬇️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{m.descricao || (m.valor > 0 ? "Guardou" : "Tirou")}</Text>
                <Text style={typography.label}>
                  {dataBR(m.data)}
                  {membros.length > 1 && nomeDe(m.created_by) ? ` · ${nomeDe(m.created_by)}` : ""}
                </Text>
              </View>
              <Text style={[typography.body, { fontWeight: "600", color: m.valor > 0 ? colors.accent : colors.danger }]}>
                {m.valor > 0 ? "+" : "−"}
                {mostrarValor(Math.abs(m.valor))}
              </Text>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
      {meus.length > 0 && <Text style={[typography.label, { textAlign: "center" }]}>Segure um movimento para apagar.</Text>}

      <Modal visible={!!operacao} transparent animationType="fade" onRequestClose={() => setOperacao(null)}>
        <Pressable onPress={() => setOperacao(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg }}>
          <Pressable style={{ backgroundColor: colors.background, borderRadius: 16, padding: spacing.lg }}>
            <Text style={typography.label}>{operacao === "guardar" ? "QUANTO VAI GUARDAR?" : "QUANTO VAI TIRAR?"}</Text>
            <TextInput
              value={formatarReais(centavos / 100)}
              onChangeText={(t) => setCentavos(centavosDoTexto(t))}
              keyboardType="number-pad"
              autoFocus
              style={{ fontSize: 36, fontWeight: "700", color: operacao === "guardar" ? colors.accent : colors.danger, paddingVertical: spacing.sm }}
            />
            <TextInput
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descrição (opcional)"
              placeholderTextColor={colors.textSecondary}
              style={[estiloInput(), { marginBottom: spacing.md }]}
            />
            <Botao titulo={operacao === "guardar" ? "Guardar" : "Tirar"} onPress={confirmar} />
            <Botao titulo="Cancelar" variante="link" onPress={() => setOperacao(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
