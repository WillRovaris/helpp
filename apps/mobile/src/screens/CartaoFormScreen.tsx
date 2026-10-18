import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo } from "../components/ui";
import { centavosDoTexto, formatarReais } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CartaoForm">;

export function CartaoFormScreen({ navigation, route }: Props) {
  const cartaoId = route.params?.cartaoId;
  const { casa } = useCasa();
  const [nome, setNome] = useState("");
  const [limiteCentavos, setLimiteCentavos] = useState(0);
  const [fechamento, setFechamento] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: cartaoId ? "Editar cartão" : "Novo cartão" });
    if (!cartaoId) return;
    supabase
      .from("cartoes")
      .select("nome, limite, dia_fechamento, dia_vencimento")
      .eq("id", cartaoId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.nome);
        setLimiteCentavos(Math.round(Number(data.limite) * 100));
        setFechamento(String(data.dia_fechamento));
        setVencimento(String(data.dia_vencimento));
      });
  }, [cartaoId, navigation]);

  async function salvar() {
    if (!casa) return;
    const diaF = parseInt(fechamento, 10);
    const diaV = parseInt(vencimento, 10);
    if (!nome.trim()) return Alert.alert("Nome", "Dê um nome ao cartão (ex.: Nubank, Itaú).");
    if (!(diaF >= 1 && diaF <= 31) || !(diaV >= 1 && diaV <= 31)) return Alert.alert("Dias", "Fechamento e vencimento são dias de 1 a 31.");

    const registro = { casa_id: casa.id, nome: nome.trim(), limite: limiteCentavos / 100, dia_fechamento: diaF, dia_vencimento: diaV };
    setSalvando(true);
    const { error } = cartaoId
      ? await supabase.from("cartoes").update(registro).eq("id", cartaoId)
      : await supabase.from("cartoes").insert(registro);
    setSalvando(false);
    if (error) return Alert.alert("Não foi possível salvar", traduzirErro(error.message));
    navigation.goBack();
  }

  function arquivar() {
    Alert.alert("Remover cartão?", "Os gastos já lançados nele continuam no histórico.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("cartoes").update({ arquivado: true }).eq("id", cartaoId!);
          if (error) Alert.alert("Erro", traduzirErro(error.message));
          else navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
      <Campo rotulo="NOME DO CARTÃO" value={nome} onChangeText={setNome} placeholder="Ex.: Nubank" autoCapitalize="words" />
      <Campo rotulo="LIMITE" value={formatarReais(limiteCentavos / 100)} onChangeText={(t) => setLimiteCentavos(centavosDoTexto(t))} keyboardType="number-pad" />
      <Campo rotulo="DIA DO FECHAMENTO DA FATURA" value={fechamento} onChangeText={setFechamento} keyboardType="number-pad" maxLength={2} placeholder="Ex.: 3" />
      <Campo rotulo="DIA DO VENCIMENTO" value={vencimento} onChangeText={setVencimento} keyboardType="number-pad" maxLength={2} placeholder="Ex.: 10" />
      <Botao titulo="Salvar" onPress={salvar} carregando={salvando} style={{ marginTop: spacing.md }} />
      {cartaoId && <Botao titulo="Remover cartão" variante="link" onPress={arquivar} style={{ marginTop: spacing.sm }} />}
    </ScrollView>
  );
}
