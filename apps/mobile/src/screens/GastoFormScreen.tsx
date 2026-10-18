import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Chip, TelaFormulario } from "../components/ui";
import { useCartoes, useCategorias } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type FormaPagamento } from "../data/tipos";
import { diaMes, faturaDaCompra, somarMeses } from "../lib/fatura";
import { centavosDoTexto, formatarReais, hojeISO, isoDeTextoBR, mascaraData, rotuloDia, somarDias } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { ItensDaNota } from "./NotaConfirmarScreen";

type Props = NativeStackScreenProps<RootStackParamList, "GastoForm">;

const OPCOES_PARCELAS = [2, 3, 4, 5, 6, 10, 12];

const estiloCampo = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.textPrimary,
} as const;

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
  /** 1 = à vista. Só vale para gasto novo. */
  const [parcelas, setParcelas] = useState(1);
  const [parcelasOutro, setParcelasOutro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregandoGasto, setCarregandoGasto] = useState(!!gastoId);
  const [notaId, setNotaId] = useState<string | null>(null);
  const [parcelamento, setParcelamento] = useState<{ id: string; parcela: number; parcelas: number } | null>(null);
  const [itensNota, setItensNota] = useState<{ nome: string; quantidade: number; valorTotal: number }[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: gastoId ? "Editar gasto" : "Novo gasto" });
    if (!gastoId) return;
    supabase
      .from("gastos")
      .select("*")
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
          if (g.parcelamento_id) setParcelamento({ id: g.parcelamento_id, parcela: g.parcela, parcelas: g.parcelas });
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
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const fatura = forma === "credito" && cartao ? faturaDaCompra(data, cartao.dia_fechamento, cartao.dia_vencimento) : null;

  /** Valor de cada parcela em centavos; a sobra do arredondamento vai na 1ª. */
  function valoresParcelas(total: number, n: number): number[] {
    const base = Math.floor(total / n);
    return Array.from({ length: n }, (_, i) => (i === 0 ? base + (total - base * n) : base));
  }

  async function salvar() {
    if (!casa) return;
    if (centavos <= 0) return Alert.alert("Valor", "Digite quanto foi o gasto.");
    if (!gastoId && parcelas > 1 && centavos < parcelas) return Alert.alert("Parcelas", "O valor é pequeno demais para tantas parcelas.");
    let dataFinal = data;
    if (outraData.trim() && usandoOutraData) {
      const iso = isoDeTextoBR(outraData);
      if (!iso) return Alert.alert("Data", "Complete a data: dia/mês/ano, por exemplo 05/10/2026.");
      dataFinal = iso;
    }
    if (forma === "credito" && !cartaoId) {
      return Alert.alert("Cartão", cartoes.length ? "Escolha qual cartão foi usado." : "Cadastre um cartão primeiro (+ Novo cartão).");
    }

    const base = {
      casa_id: casa.id,
      descricao: descricao.trim() || null,
      categoria_id: categoriaId,
      forma_pagamento: forma,
      cartao_id: forma === "credito" ? cartaoId : null,
      pago_por: pagoPor,
    };

    setSalvando(true);
    let error;
    if (gastoId) {
      ({ error } = await supabase.from("gastos").update({ ...base, valor: centavos / 100, data: dataFinal }).eq("id", gastoId));
    } else if (parcelas > 1) {
      // Uma linha por parcela, cada uma no seu mês, todas com o mesmo parcelamento_id.
      const grupo = gerarUuid();
      const registros = valoresParcelas(centavos, parcelas).map((v, i) => ({
        ...base,
        valor: v / 100,
        data: somarMeses(dataFinal, i),
        parcelamento_id: grupo,
        parcela: i + 1,
        parcelas,
      }));
      ({ error } = await supabase.from("gastos").insert(registros));
    } else {
      ({ error } = await supabase.from("gastos").insert({ ...base, valor: centavos / 100, data: dataFinal }));
    }
    setSalvando(false);
    if (error) {
      const msg = error.message.includes("parcela") ? "Falta rodar o SQL 03-parcelas-categorias.sql no Supabase." : traduzirErro(error.message);
      return Alert.alert("Não foi possível salvar", msg);
    }
    navigation.goBack();
  }

  async function apagar(todasParcelas: boolean) {
    const { error } = todasParcelas && parcelamento
      ? await supabase.from("gastos").delete().eq("parcelamento_id", parcelamento.id)
      : await supabase.from("gastos").delete().eq("id", gastoId!);
    if (error) return Alert.alert("Erro", traduzirErro(error.message));
    // Gasto que veio de nota: apaga a nota junto, para ela poder ser lida de novo.
    if (notaId) await supabase.from("notas").delete().eq("id", notaId);
    navigation.goBack();
  }

  function excluir() {
    if (parcelamento) {
      Alert.alert("Excluir parcela?", `Esta é a parcela ${parcelamento.parcela} de ${parcelamento.parcelas}.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Só esta", onPress: () => apagar(false) },
        { text: "Todas", style: "destructive", onPress: () => apagar(true) },
      ]);
      return;
    }
    Alert.alert("Excluir gasto?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => apagar(false) },
    ]);
  }

  if (carregandoGasto) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const valorParcela = parcelas > 1 ? valoresParcelas(centavos, parcelas) : [];

  return (
    <TelaFormulario>
      <Text style={typography.label}>{parcelas > 1 ? "VALOR TOTAL DA COMPRA" : "VALOR"}</Text>
      <TextInput
        value={formatarReais(centavos / 100)}
        onChangeText={(t) => setCentavos(centavosDoTexto(t))}
        keyboardType="number-pad"
        autoFocus={!gastoId}
        style={{ fontSize: 40, fontWeight: "700", color: colors.textPrimary, paddingVertical: spacing.sm }}
      />
      {parcelamento && (
        <Text style={[typography.label, { color: colors.accent }]}>
          🔁 Parcela {parcelamento.parcela} de {parcelamento.parcelas}
        </Text>
      )}

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
          {cartoes.map((c) => (
            <Chip key={c.id} rotulo={`💳 ${c.nome}`} ativo={cartaoId === c.id} onPress={() => setCartaoId(c.id)} />
          ))}
          <Chip rotulo="+ Novo cartão" ativo={false} onPress={() => navigation.navigate("CartaoForm", {})} />
        </Secao>
      )}
      {fatura && cartao && (
        <Text style={[typography.label, { marginTop: spacing.sm, color: colors.accent }]}>
          {parcelas > 1 ? "1ª parcela entra" : "Entra"} na fatura que fecha {diaMes(fatura.fechamento)} e vence {diaMes(fatura.vencimento)}
        </Text>
      )}

      {!gastoId && (
        <>
          <Secao titulo="🔁 PARCELAMENTO">
            <Chip rotulo="À vista" ativo={parcelas === 1} onPress={() => { setParcelas(1); setParcelasOutro(""); }} />
            {OPCOES_PARCELAS.map((n) => (
              <Chip key={n} rotulo={`${n}x`} ativo={parcelas === n && !parcelasOutro} onPress={() => { setParcelas(n); setParcelasOutro(""); }} />
            ))}
            <TextInput
              value={parcelasOutro}
              onChangeText={(t) => {
                const n = t.replace(/\D/g, "").slice(0, 2);
                setParcelasOutro(n);
                const v = parseInt(n, 10);
                if (v >= 2 && v <= 48) setParcelas(v);
              }}
              placeholder="outro"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[estiloCampo, { borderRadius: 999, paddingVertical: 6, minWidth: 70, fontSize: 14, borderColor: parcelasOutro ? colors.accent : colors.border }]}
            />
          </Secao>
          {parcelas > 1 && centavos > 0 && (
            <Text style={[typography.label, { marginTop: spacing.sm, color: colors.accent }]}>
              {parcelas}x de {formatarReais(valorParcela[parcelas - 1] / 100)} — uma parcela por mês até {diaMes(somarMeses(data, parcelas - 1))}/{somarMeses(data, parcelas - 1).slice(0, 4)}
            </Text>
          )}
        </>
      )}

      {membros.length > 1 && (
        <Secao titulo="QUEM PAGOU">
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.user_id === userId ? `${m.nome} (eu)` : m.nome} ativo={pagoPor === m.user_id} onPress={() => setPagoPor(m.user_id)} />
          ))}
        </Secao>
      )}

      <Secao titulo={parcelas > 1 ? "DATA DA COMPRA" : "QUANDO"}>
        <Chip rotulo="Hoje" ativo={data === hojeISO()} onPress={() => { setData(hojeISO()); setOutraData(""); }} />
        <Chip rotulo="Ontem" ativo={data === ontem} onPress={() => { setData(ontem); setOutraData(""); }} />
        <TextInput
          value={outraData}
          onChangeText={(t) => {
            const m = mascaraData(t);
            setOutraData(m);
            const iso = isoDeTextoBR(m);
            if (iso) setData(iso);
          }}
          placeholder="dd/mm/aaaa"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={10}
          style={[estiloCampo, { borderRadius: 999, paddingVertical: 6, minWidth: 130, fontSize: 14, borderColor: usandoOutraData ? colors.accent : colors.border }]}
        />
      </Secao>
      {usandoOutraData && <Text style={[typography.label, { marginTop: spacing.xs }]}>{rotuloDia(data)}</Text>}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>DESCRIÇÃO (OPCIONAL)</Text>
      <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex.: Mercado Koch, farmácia, gasolina" placeholderTextColor={colors.textSecondary} style={estiloCampo} />

      <Botao titulo={parcelas > 1 ? `Salvar ${parcelas} parcelas` : "Salvar"} onPress={salvar} carregando={salvando} style={{ marginTop: spacing.xl }} />
      {gastoId && <Botao titulo="Excluir gasto" variante="link" onPress={excluir} style={{ marginTop: spacing.sm }} />}
      {itensNota.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <ItensDaNota itens={itensNota} />
        </View>
      )}
    </TelaFormulario>
  );
}

function gerarUuid(): string {
  // crypto.randomUUID nem sempre existe no Hermes; v4 simples é suficiente para agrupar parcelas.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>{titulo}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>{children}</View>
    </View>
  );
}
