import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, estiloInput, IconeCategoria, TelaFormulario } from "../components/ui";
import { CORES_CATEGORIA } from "../data/tipos";
import { centavosDoTexto, formatarReais, isoDeTextoBR, mascaraData } from "../lib/format";
import { obter } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CaixinhaForm">;

const EMOJIS = ["🐷", "✈️", "🏖️", "🚗", "🏠", "🛟", "🎓", "💍", "👶", "🎁", "🎄", "💻", "📱", "🏍️", "🐶", "🏥", "💰", "🎯"];

// Criar/editar caixinha: nome, ícone, cor, meta (opcional) e data para chegar na meta (opcional).
export function CaixinhaFormScreen({ navigation, route }: Props) {
  const caixinhaId = route.params?.caixinhaId;
  const { casa } = useCasa();
  const existente = caixinhaId ? obter("caixinhas", caixinhaId) : undefined;
  const [nome, setNome] = useState<string>(existente?.nome ?? "");
  const [emoji, setEmoji] = useState<string>(existente?.emoji ?? "🐷");
  const [cor, setCor] = useState<string>(existente?.cor ?? "#E11D48");
  const [meta, setMeta] = useState(existente?.meta ? Math.round(Number(existente.meta) * 100) : 0);
  const [textoData, setTextoData] = useState<string>(existente?.data_alvo ? String(existente.data_alvo).split("-").reverse().join("/") : "");

  useEffect(() => {
    navigation.setOptions({ title: caixinhaId ? "Editar caixinha" : "Nova caixinha" });
  }, [navigation, caixinhaId]);

  function salvar() {
    if (!casa) return;
    const n = nome.trim();
    if (!n) return Alert.alert("Nome", "Dê um nome à caixinha (ex.: Viagem, Reserva de emergência).");
    const dataAlvo = textoData.trim() ? isoDeTextoBR(textoData) : null;
    if (textoData.trim() && !dataAlvo) return Alert.alert("Data", "Complete a data: dia/mês/ano.");
    const dados = { nome: n.slice(0, 40), emoji, cor, meta: meta ? meta / 100 : null, data_alvo: dataAlvo };
    if (existente) atualizar("caixinhas", existente.id, dados);
    else inserir("caixinhas", { ...dados, casa_id: casa.id, arquivada: false });
    navigation.goBack();
  }

  function remover() {
    if (!existente) return;
    Alert.alert(`Excluir "${existente.nome}"?`, "Ela some da lista. Use quando o objetivo foi concluído ou desistiu dele.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          atualizar("caixinhas", existente.id, { arquivada: true });
          navigation.navigate("Caixinhas");
        },
      },
    ]);
  }

  return (
    <TelaFormulario>
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <IconeCategoria categoria={{ icone: emoji, cor }} tamanho={72} />
      </View>

      <Campo rotulo="NOME" value={nome} onChangeText={setNome} placeholder="Ex.: Viagem para a praia" maxLength={40} />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>ÍCONE</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EMOJIS.map((e) => (
          <TouchableOpacity
            key={e}
            onPress={() => setEmoji(e)}
            style={{ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: emoji === e ? colors.accent : "transparent", backgroundColor: colors.surface }}
          >
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>COR</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {CORES_CATEGORIA.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCor(c)}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: cor === c ? colors.textPrimary : "transparent" }}
          />
        ))}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>🎯 META (OPCIONAL)</Text>
      <TextInput
        value={meta ? formatarReais(meta / 100) : ""}
        onChangeText={(t) => setMeta(centavosDoTexto(t))}
        placeholder="Quanto quer juntar"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        style={estiloInput()}
      />

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>📅 ATÉ QUANDO (OPCIONAL)</Text>
      <TextInput
        value={textoData}
        onChangeText={(t) => setTextoData(mascaraData(t))}
        placeholder="dd/mm/aaaa"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={10}
        style={estiloInput()}
      />
      <Text style={[typography.label, { marginTop: spacing.xs }]}>Com meta e data, o app calcula quanto guardar por mês.</Text>

      <Botao titulo="Salvar" onPress={salvar} style={{ marginTop: spacing.xl }} />
      {existente && <Botao titulo="Excluir caixinha" variante="link" onPress={remover} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
