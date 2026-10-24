import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Chip, estiloInput, TelaFormulario } from "../components/ui";
import { tipoReceita, TIPOS_RECEITA } from "../data/tipos";
import { centavosDoTexto, formatarReais, hojeISO, isoDeTextoBR, MESES, mascaraData, rotuloDia } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import { obter } from "../offline/banco";
import { atualizar, excluir, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ReceitaForm">;

const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1].toLowerCase()}`;

// Lançar (ou editar) uma entrada de dinheiro. O tipo é escolhido tocando no ícone.
// "Repete todo mês" (ex.: salário) vale do mês da data em diante.
export function ReceitaFormScreen({ navigation, route }: Props) {
  const { receitaId } = route.params;
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const existente = receitaId ? obter("receitas", receitaId) : undefined;
  // Mês que a pessoa estava vendo (para editar uma recorrente "daqui para frente").
  const mesVisto = route.params.mes ?? hojeISO().slice(0, 7);
  const dataInicial = existente?.data ?? (mesVisto === hojeISO().slice(0, 7) ? hojeISO() : `${mesVisto}-01`);

  const [centavos, setCentavos] = useState(existente ? Math.round(Number(existente.valor) * 100) : 0);
  const [tipo, setTipo] = useState<string>(existente?.tipo ?? "salario");
  const [descricao, setDescricao] = useState<string>(existente?.descricao ?? "");
  const [recebidoPor, setRecebidoPor] = useState<string | null>(existente ? existente.recebido_por : userId);
  const [recorrente, setRecorrente] = useState<boolean>(existente ? !!existente.recorrente : true);
  const [textoData, setTextoData] = useState(dataInicial.split("-").reverse().join("/"));
  const [escolhendoTipo, setEscolhendoTipo] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: receitaId ? "Editar entrada" : "Lançar entrada" });
  }, [navigation, receitaId]);

  const t = tipoReceita(tipo);
  const data = isoDeTextoBR(textoData);
  // Recorrente que começou antes do mês visto: mudança pode valer só daqui para frente.
  const comecouAntes = !!existente?.recorrente && existente.data.slice(0, 7) < mesVisto;

  function escolherTipo(valor: string) {
    setTipo(valor);
    // salário costuma repetir; o resto, não
    if (!receitaId) setRecorrente(valor === "salario");
    setEscolhendoTipo(false);
  }

  function salvar() {
    if (!casa) return;
    if (centavos <= 0) return Alert.alert("Valor", "Digite quanto entrou.");
    if (!data) return Alert.alert("Data", "Complete a data (dd/mm/aaaa).");
    const dados = {
      valor: centavos / 100,
      tipo,
      descricao: descricao.trim() || null,
      data,
      recebido_por: recebidoPor,
      recorrente,
      ate: recorrente ? (existente?.ate ?? null) : null,
    };
    if (!existente) {
      inserir("receitas", { ...dados, casa_id: casa.id, created_by: userId });
      return navigation.goBack();
    }
    if (comecouAntes) {
      return Alert.alert("Mudar a partir de quando?", `Essa entrada repete todo mês desde ${nomeMes(existente.data)}.`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: `De ${nomeMes(mesVisto)} em diante`,
          onPress: () => {
            // a antiga para no mês anterior; a nova começa no mês visto
            atualizar("receitas", existente.id, { ate: mesAnterior(mesVisto) });
            inserir("receitas", { ...dados, data: `${mesVisto}-01`, casa_id: casa.id, created_by: userId });
            navigation.goBack();
          },
        },
        {
          text: "Em todos os meses",
          onPress: () => {
            atualizar("receitas", existente.id, dados);
            navigation.goBack();
          },
        },
      ]);
    }
    atualizar("receitas", existente.id, dados);
    navigation.goBack();
  }

  function apagar() {
    if (!existente) return;
    if (comecouAntes) {
      return Alert.alert("Parar esta entrada?", `Ela repete todo mês desde ${nomeMes(existente.data)}.`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: `Parar a partir de ${nomeMes(mesVisto)}`,
          onPress: () => {
            atualizar("receitas", existente.id, { ate: mesAnterior(mesVisto) });
            navigation.goBack();
          },
        },
        {
          text: "Apagar de todos os meses",
          style: "destructive",
          onPress: () => {
            excluir("receitas", [existente.id]);
            navigation.goBack();
          },
        },
      ]);
    }
    Alert.alert("Excluir entrada?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          excluir("receitas", [existente.id]);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <TelaFormulario>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <TouchableOpacity
          onPress={() => setEscolhendoTipo(true)}
          accessibilityLabel="Escolher tipo de entrada"
          style={{ alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface }}
        >
          <Text style={{ fontSize: 34 }}>{t.emoji}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEscolhendoTipo(true)} style={{ flex: 1 }}>
          <Text style={typography.label}>TIPO DE ENTRADA</Text>
          <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>{t.nome} ▾</Text>
        </TouchableOpacity>
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg }]}>VALOR</Text>
      <TextInput
        value={formatarReais(centavos / 100)}
        onChangeText={(x) => setCentavos(centavosDoTexto(x))}
        keyboardType="number-pad"
        autoFocus={!receitaId}
        style={{ fontSize: 40, fontWeight: "700", color: colors.accent, paddingVertical: spacing.sm }}
      />

      <Text style={[typography.label, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>DESCRIÇÃO (OPCIONAL)</Text>
      <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex.: Empresa, cliente, serviço" placeholderTextColor={colors.textSecondary} style={estiloInput()} />

      {membros.length > 1 && (
        <Secao titulo="QUEM RECEBEU">
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.user_id === userId ? `${m.nome} (eu)` : m.nome} ativo={recebidoPor === m.user_id} onPress={() => setRecebidoPor(m.user_id)} />
          ))}
        </Secao>
      )}

      <Secao titulo="DATA DA ENTRADA">
        <TextInput
          value={textoData}
          onChangeText={(x) => setTextoData(mascaraData(x))}
          placeholder="dd/mm/aaaa"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={10}
          selectTextOnFocus
          style={[estiloInput(), { minWidth: 150, fontSize: 16 }]}
        />
        <Text style={typography.label}>{data ? rotuloDia(data) : "complete a data"}</Text>
      </Secao>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { fontWeight: "600" }]}>🔁 Repete todo mês</Text>
          <Text style={typography.label}>{recorrente ? `Entra sozinha todo mês a partir de ${data ? nomeMes(data) : "…"}` : "Só neste mês"}</Text>
        </View>
        <Switch value={recorrente} onValueChange={setRecorrente} trackColor={{ true: colors.accent, false: colors.border }} />
      </View>

      <Botao titulo="Salvar" onPress={salvar} style={{ marginTop: spacing.xl }} />
      {existente && <Botao titulo="Excluir entrada" variante="link" onPress={apagar} style={{ marginTop: spacing.sm }} />}

      <Modal visible={escolhendoTipo} transparent animationType="fade" onRequestClose={() => setEscolhendoTipo(false)}>
        <Pressable onPress={() => setEscolhendoTipo(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg }}>
          <Pressable style={{ backgroundColor: colors.background, borderRadius: 16, padding: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.md, textAlign: "center" }]}>QUE TIPO DE ENTRADA É ESSA?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm }}>
              {TIPOS_RECEITA.map((op) => (
                <TouchableOpacity
                  key={op.valor}
                  onPress={() => escolherTipo(op.valor)}
                  style={{
                    width: "31%",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: op.valor === tipo ? colors.accent : colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{op.emoji}</Text>
                  <Text style={[typography.label, { color: colors.textPrimary, textAlign: "center", marginTop: 2 }]} numberOfLines={2}>
                    {op.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </TelaFormulario>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>{titulo}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>{children}</View>
    </View>
  );
}
