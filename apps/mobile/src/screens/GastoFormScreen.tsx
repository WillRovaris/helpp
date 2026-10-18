import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Chip } from "../components/ui";
import { useCartoes, useCategorias } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type FormaPagamento } from "../data/tipos";
import { centavosDoTexto, formatarReais, hojeISO, isoDeTextoBR, rotuloDia, somarDias } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { ItensDaNota } from "./NotaConfirmarScreen";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "GastoForm">;

// Lançar (ou editar) um gasto. Pensado para ser rápido: valor → categoria →
// salvar. O resto já vem preenchido com o mais comum.
export function GastoFormScreen({ navigation, route }: Props) {
  const gastoId = route.params?.gastoId;
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();

  const [centavos, setCentavos] = useState(0);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [cartaoId, setCartaoId] = useState<string | null>(null);
  const [pagoPor, setPagoPor] = useState<string | null>(userId);
  const [data, setData] = useState(hojeISO());
  const [outraData, setOutraData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregandoGasto, setCarregandoGasto] = useState(!!gastoId);
  const [notaId, setNotaId] = useState<string | null>(null);
  const [itensNota, setItensNota] = useState<{ nome: string; quantidade: number; valorTotal: number }[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: gastoId ? "Editar gasto" : "Novo gasto" });
    if (!gastoId) return;
    supabase
      .from("gastos")
      .select("valor, data, descricao, categoria_id, forma_pagamento, cartao_id, pago_por, nota_id")
      .eq("id", gastoId)
      .single()
      .then(({ data: g }) => {
        if (g) {
          setCentavos(Math.round(Number(g.valor) * 100));
          setCategoriaId(g.categoria_id);
          setForma(g.forma_pagamento);
          setCartaoId(g.cartao_id);
          setPagoPor(g.pago_por);
          setData(g.data);
          if (g.data !== hojeISO() && g.data !== somarDias(hojeISO(), -1)) setOutraData(g.data.split("-").reverse().join("/"));
          setDescricao(g.descricao ?? "");
          setNotaId(g.nota_id);
          if (g.nota_id) {
            supabase
              .from("nota_itens")
              .select("nome, quantidade, valor_total")
              .eq("nota_id", g.nota_id)
              .then(({ data: itens }) =>
                setItensNota((itens ?? []).map((i) => ({ nome: i.nome, quantidade: Number(i.quantidade), valorTotal: Number(i.valor_total) }))),
              );
          }
        }
        setCarregandoGasto(false);
      });
  }, [gastoId, navigation]);

  // Crédito com um cartão só: já seleciona ele.
  useEffect(() => {
    if (forma === "credito" && !cartaoId && cartoes.length === 1) setCartaoId(cartoes[0].id);
  }, [forma, cartoes, cartaoId]);

  const ontem = somarDias(hojeISO(), -1);
  const usandoOutraData = data !== hojeISO() && data !== ontem;

  async function salvar() {
    if (!casa) return;
    if (centavos <= 0) {
      Alert.alert("Valor", "Digite quanto foi o gasto.");
      return;
    }
    let dataFinal = data;
    if (outraData.trim() && usandoOutraData) {
      const iso = isoDeTextoBR(outraData);
      if (!iso) {
        Alert.alert("Data", "Use o formato dia/mês, por exemplo 05/10.");
        return;
      }
      dataFinal = iso;
    }
    if (forma === "credito" && !cartaoId) {
      Alert.alert("Cartão", cartoes.length ? "Escolha qual cartão foi usado." : "Cadastre um cartão primeiro (tela inicial → Cartões).");
      return;
    }

    const registro = {
      casa_id: casa.id,
      valor: centavos / 100,
      data: dataFinal,
      descricao: descricao.trim() || null,
      categoria_id: categoriaId,
      forma_pagamento: forma,
      cartao_id: forma === "credito" ? cartaoId : null,
      pago_por: pagoPor,
    };

    setSalvando(true);
    const { error } = gastoId
      ? await supabase.from("gastos").update(registro).eq("id", gastoId)
      : await supabase.from("gastos").insert(registro);
    setSalvando(false);
    if (error) {
      Alert.alert("Não foi possível salvar", traduzirErro(error.message));
      return;
    }
    navigation.goBack();
  }

  function excluir() {
    Alert.alert("Excluir gasto?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("gastos").delete().eq("id", gastoId!);
          if (error) return Alert.alert("Erro", traduzirErro(error.message));
          // Gasto que veio de nota: apaga a nota junto, para ela poder ser lida de novo.
          if (notaId) await supabase.from("notas").delete().eq("id", notaId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (carregandoGasto) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }} keyboardShouldPersistTaps="handled">
        <Text style={typography.label}>VALOR</Text>
        <TextInput
          value={formatarReais(centavos / 100)}
          onChangeText={(t) => setCentavos(centavosDoTexto(t))}
          keyboardType="number-pad"
          autoFocus={!gastoId}
          style={{ fontSize: 40, fontWeight: "700", color: colors.textPrimary, paddingVertical: spacing.sm }}
        />

        <Secao titulo="CATEGORIA">
          {categorias.map((c) => (
            <Chip
              key={c.id}
              rotulo={`${emojiCategoria(c.icone)} ${c.nome}`}
              ativo={categoriaId === c.id}
              cor={c.cor}
              onPress={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
            />
          ))}
        </Secao>

        <Secao titulo="COMO PAGOU">
          {FORMAS_PAGAMENTO.map((f) => (
            <Chip key={f.valor} rotulo={f.rotulo} ativo={forma === f.valor} onPress={() => setForma(f.valor)} />
          ))}
        </Secao>

        {forma === "credito" && (
          <Secao titulo="CARTÃO">
            {cartoes.length === 0 ? (
              <Botao titulo="+ Cadastrar cartão" variante="secundario" onPress={() => navigation.navigate("CartaoForm", {})} />
            ) : (
              cartoes.map((c) => <Chip key={c.id} rotulo={`💳 ${c.nome}`} ativo={cartaoId === c.id} onPress={() => setCartaoId(c.id)} />)
            )}
          </Secao>
        )}

        {membros.length > 1 && (
          <Secao titulo="QUEM PAGOU">
            {membros.map((m) => (
              <Chip key={m.user_id} rotulo={m.user_id === userId ? `${m.nome} (eu)` : m.nome} ativo={pagoPor === m.user_id} onPress={() => setPagoPor(m.user_id)} />
            ))}
          </Secao>
        )}

        <Secao titulo="QUANDO">
          <Chip rotulo="Hoje" ativo={data === hojeISO()} onPress={() => { setData(hojeISO()); setOutraData(""); }} />
          <Chip rotulo="Ontem" ativo={data === ontem} onPress={() => { setData(ontem); setOutraData(""); }} />
          <TextInput
            value={outraData}
            onChangeText={(t) => {
              setOutraData(t);
              const iso = isoDeTextoBR(t);
              if (iso) setData(iso);
            }}
            placeholder="outra data (dd/mm)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            style={{
              borderWidth: 1,
              borderColor: usandoOutraData ? colors.accent : colors.border,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              minWidth: 150,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
            }}
          />
        </Secao>
        {usandoOutraData && <Text style={[typography.label, { marginTop: -spacing.sm }]}>{rotuloDia(data)}</Text>}

        <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>DESCRIÇÃO (OPCIONAL)</Text>
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Ex.: Mercado Koch, farmácia, gasolina"
          placeholderTextColor={colors.textSecondary}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            fontSize: 16,
            color: colors.textPrimary,
          }}
        />

        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} style={{ marginTop: spacing.xl }} />
        {gastoId && <Botao titulo="Excluir gasto" variante="link" onPress={excluir} style={{ marginTop: spacing.sm }} />}
        {itensNota.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <ItensDaNota itens={itensNota} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
