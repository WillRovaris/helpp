import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Chip, TelaFormulario } from "../components/ui";
import { useCategorias } from "../data/hooks";
import { emojiCategoria } from "../data/tipos";
import { centavosDoTexto, formatarReais } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ContaForm">;

export function ContaFormScreen({ navigation, route }: Props) {
  const contaId = route.params?.contaId;
  const { casa } = useCasa();
  const { categorias } = useCategorias();
  const [nome, setNome] = useState("");
  const [varia, setVaria] = useState(false);
  const [centavos, setCentavos] = useState(0);
  const [dia, setDia] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: contaId ? "Editar conta" : "Nova conta fixa" });
    if (!contaId) return;
    supabase
      .from("contas_fixas")
      .select("nome, valor, dia_vencimento, categoria_id")
      .eq("id", contaId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.nome);
        setVaria(data.valor == null);
        setCentavos(data.valor == null ? 0 : Math.round(Number(data.valor) * 100));
        setDia(String(data.dia_vencimento));
        setCategoriaId(data.categoria_id);
      });
  }, [contaId, navigation]);

  // Conta nova: categoria "Contas" já marcada.
  useEffect(() => {
    if (!contaId && !categoriaId && categorias.length) setCategoriaId(categorias.find((c) => c.icone === "receipt")?.id ?? null);
  }, [categorias, categoriaId, contaId]);

  async function salvar() {
    if (!casa) return;
    const d = parseInt(dia, 10);
    if (!nome.trim()) return Alert.alert("Nome", "Dê um nome à conta (ex.: Luz, Aluguel).");
    if (!(d >= 1 && d <= 31)) return Alert.alert("Vencimento", "Informe o dia do vencimento (1 a 31).");
    if (!varia && centavos <= 0) return Alert.alert("Valor", "Informe o valor, ou marque que o valor muda todo mês.");

    const registro = { casa_id: casa.id, nome: nome.trim(), valor: varia ? null : centavos / 100, dia_vencimento: d, categoria_id: categoriaId };
    setSalvando(true);
    const { error } = contaId
      ? await supabase.from("contas_fixas").update(registro).eq("id", contaId)
      : await supabase.from("contas_fixas").insert(registro);
    setSalvando(false);
    if (error) return Alert.alert("Não foi possível salvar", traduzirErro(error.message));
    navigation.goBack();
  }

  function remover() {
    Alert.alert("Remover conta?", "Ela some da lista dos próximos meses. Os pagamentos já feitos continuam no histórico.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("contas_fixas").update({ ativa: false }).eq("id", contaId!);
          if (error) Alert.alert("Erro", traduzirErro(error.message));
          else navigation.goBack();
        },
      },
    ]);
  }

  return (
    <TelaFormulario>
      <Campo rotulo="NOME DA CONTA" value={nome} onChangeText={setNome} placeholder="Ex.: Luz, Aluguel, Internet, Escola" autoCapitalize="sentences" />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>VALOR</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <Chip rotulo="Valor fixo" ativo={!varia} onPress={() => setVaria(false)} />
        <Chip rotulo="Muda todo mês" ativo={varia} onPress={() => setVaria(true)} />
      </View>
      {!varia && <Campo rotulo="VALOR MENSAL" value={formatarReais(centavos / 100)} onChangeText={(t) => setCentavos(centavosDoTexto(t))} keyboardType="number-pad" />}
      {varia && <Text style={[typography.label, { marginBottom: spacing.md }]}>Você informa o valor na hora de marcar como paga.</Text>}

      <Campo rotulo="DIA DO VENCIMENTO" value={dia} onChangeText={(t) => setDia(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={2} placeholder="Ex.: 10" />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>CATEGORIA</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {categorias.map((c) => (
          <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={categoriaId === c.id} onPress={() => setCategoriaId(c.id)} />
        ))}
      </View>

      <Botao titulo="Salvar" onPress={salvar} carregando={salvando} style={{ marginTop: spacing.xl }} />
      {contaId && <Botao titulo="Remover conta" variante="link" onPress={remover} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
