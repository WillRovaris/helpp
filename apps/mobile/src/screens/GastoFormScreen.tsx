import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Chip, estiloInput, TelaFormulario } from "../components/ui";
import { useCartoes, useCategorias } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type FormaPagamento } from "../data/tipos";
import { diaMes, faturaDaCompra, somarMeses } from "../lib/fatura";
import { centavosDoTexto, formatarReais, gerarUuid, hojeISO, isoDeTextoBR, mascaraData, rotuloDia, somarDias } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { ItensDaNota } from "./NotaConfirmarScreen";

type Props = NativeStackScreenProps<RootStackParamList, "GastoForm">;

const OPCOES_PARCELAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
  /** Cartão: dia em que vai pagar. null = vencimento da fatura (calculado). */
  const [pagamento, setPagamento] = useState<string | null>(null);
  const [outroPagamento, setOutroPagamento] = useState("");
  /** A despesa carregada para edição já tinha data de pagamento (precisa limpar se virar Pix). */
  const [pagamentoCarregado, setPagamentoCarregado] = useState(false);
  const [descricao, setDescricao] = useState("");
  /** 1 = à vista. Só vale para gasto novo. */
  const [parcelas, setParcelas] = useState(1);
  const [parcelasOutro, setParcelasOutro] = useState("");
  const [escolhendoParcelas, setEscolhendoParcelas] = useState(false);
  const [usarOutro, setUsarOutro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregandoGasto, setCarregandoGasto] = useState(!!gastoId);
  const [notaId, setNotaId] = useState<string | null>(null);
  const [parcelamento, setParcelamento] = useState<{ id: string; parcela: number; parcelas: number } | null>(null);
  const [itensNota, setItensNota] = useState<{ nome: string; quantidade: number; valorTotal: number }[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: gastoId ? "Editar despesa" : "Lançar despesa" });
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
          if (g.data_pagamento) {
            setPagamentoCarregado(true);
            setPagamento(g.data_pagamento);
            setOutroPagamento(g.data_pagamento.split("-").reverse().join("/"));
          }
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
  // No cartão, o mês da despesa é o do pagamento: o dia informado ou o vencimento da fatura.
  const pagamentoEfetivo = forma === "credito" ? (pagamento ?? fatura?.vencimento ?? data) : data;

  /** Valor de cada parcela em centavos; a sobra do arredondamento vai na 1ª. */
  function valoresParcelas(total: number, n: number): number[] {
    const base = Math.floor(total / n);
    return Array.from({ length: n }, (_, i) => (i === 0 ? base + (total - base * n) : base));
  }

  async function salvar() {
    if (!casa) return;
    if (centavos <= 0) return Alert.alert("Valor", "Digite quanto foi a despesa.");
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
    // Cartão: dia do pagamento informado, ou o vencimento da fatura da data da compra.
    let pagamentoFinal: string | null = null;
    if (forma === "credito" && cartao) {
      if (outroPagamento.trim() && pagamento) {
        const iso = isoDeTextoBR(outroPagamento);
        if (!iso) return Alert.alert("Data do pagamento", "Complete a data: dia/mês/ano, por exemplo 25/11/2026.");
        pagamentoFinal = iso;
      } else {
        pagamentoFinal = faturaDaCompra(dataFinal, cartao.dia_fechamento, cartao.dia_vencimento).vencimento;
      }
    }

    const base = {
      casa_id: casa.id,
      descricao: descricao.trim() || null,
      categoria_id: categoriaId,
      forma_pagamento: forma,
      cartao_id: forma === "credito" ? cartaoId : null,
      pago_por: pagoPor,
    };
    // data_pagamento só entra quando importa (cartão, ou limpar ao trocar de cartão para Pix):
    // assim Pix/débito continuam funcionando mesmo antes do SQL 08.
    const comPagamento = (valor: string | null) => (valor || pagamentoCarregado ? { data_pagamento: valor } : {});

    setSalvando(true);
    let error;
    if (gastoId) {
      ({ error } = await supabase.from("gastos").update({ ...base, valor: centavos / 100, data: dataFinal, ...comPagamento(pagamentoFinal) }).eq("id", gastoId));
    } else if (parcelas > 1) {
      // Uma linha por parcela, cada uma no seu mês, todas com o mesmo parcelamento_id.
      const grupo = gerarUuid();
      const registros = valoresParcelas(centavos, parcelas).map((v, i) => ({
        ...base,
        valor: v / 100,
        data: somarMeses(dataFinal, i),
        ...comPagamento(pagamentoFinal ? somarMeses(pagamentoFinal, i) : null),
        parcelamento_id: grupo,
        parcela: i + 1,
        parcelas,
      }));
      ({ error } = await supabase.from("gastos").insert(registros));
    } else {
      ({ error } = await supabase.from("gastos").insert({ ...base, valor: centavos / 100, data: dataFinal, ...comPagamento(pagamentoFinal) }));
    }
    setSalvando(false);
    if (error) {
      const msg = error.message.includes("data_pagamento")
        ? "Falta rodar o SQL 08-data-pagamento.sql no Supabase."
        : error.message.includes("parcela")
          ? "Falta rodar o SQL 03-parcelas-categorias.sql no Supabase."
          : traduzirErro(error.message);
      return Alert.alert("Não foi possível salvar", msg);
    }
    navigation.goBack();
  }

  async function apagar(todasParcelas: boolean) {
    const { error } = todasParcelas && parcelamento
      ? await supabase.from("gastos").delete().eq("parcelamento_id", parcelamento.id)
      : await supabase.from("gastos").delete().eq("id", gastoId!);
    if (error) return Alert.alert("Erro", traduzirErro(error.message));
    // Gasto de uma conta fixa paga: a conta volta a ficar em aberto.
    if (!todasParcelas) await supabase.from("contas_pagamentos").delete().eq("gasto_id", gastoId!);
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
    Alert.alert("Excluir despesa?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => apagar(false) },
    ]);
  }

  if (carregandoGasto) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const valorParcela = parcelas > 1 ? valoresParcelas(centavos, parcelas) : [];

  return (
    <TelaFormulario>
      {!gastoId && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
          <Atalho emoji="📷" titulo="Ler nota" onPress={() => navigation.navigate("NotaScanner")} />
          <Atalho emoji="📄" titulo="Importar extrato ou fatura" onPress={() => navigation.navigate("Importar")} />
          <Atalho emoji="🧾" titulo="Conta fixa" onPress={() => navigation.navigate("ContaForm", {})} />
        </View>
      )}

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

      <Text style={[typography.label, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>DESCRIÇÃO (OPCIONAL)</Text>
      <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex.: Nome do mercado, farmácia, gasolina" placeholderTextColor={colors.textSecondary} style={estiloInput()} />

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
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>📅 VAI PAGAR EM</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
            <Chip
              rotulo={`${diaMes(fatura.vencimento)} · vencimento da fatura`}
              ativo={!pagamento}
              onPress={() => {
                setPagamento(null);
                setOutroPagamento("");
              }}
            />
            <TextInput
              value={outroPagamento}
              onChangeText={(t) => {
                const m = mascaraData(t);
                setOutroPagamento(m);
                const iso = isoDeTextoBR(m);
                setPagamento(iso ?? (m ? pagamento ?? fatura.vencimento : null));
              }}
              placeholder="outro dia (dd/mm/aaaa)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              style={[estiloInput(), { borderRadius: 999, paddingVertical: 6, minWidth: 170, fontSize: 14, borderColor: pagamento ? colors.accent : colors.border }]}
            />
          </View>
          <Text style={[typography.label, { marginTop: spacing.xs, color: colors.accent }]}>
            {parcelas > 1 ? "1ª parcela conta" : "Conta"} em {MESES_LONGOS[Number(pagamentoEfetivo.slice(5, 7)) - 1]} (pagamento em {diaMes(pagamentoEfetivo)})
          </Text>
        </View>
      )}

      {!gastoId && (
        <>
          <TouchableOpacity
            onPress={() => setEscolhendoParcelas(!escolhendoParcelas)}
            activeOpacity={0.8}
            style={{
              marginTop: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: parcelas > 1 ? colors.accent : colors.border,
              backgroundColor: colors.surface,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={[typography.body, { fontWeight: "600", color: parcelas > 1 ? colors.accent : colors.textPrimary }]}>
              🔁 Parcelamento{parcelas > 1 ? `: ${parcelas}x` : ""}
            </Text>
            <Text style={{ color: colors.textSecondary }}>{escolhendoParcelas ? "▴" : "▾"}</Text>
          </TouchableOpacity>

          {escolhendoParcelas && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
              {OPCOES_PARCELAS.map((n) => (
                <Chip
                  key={n}
                  rotulo={n === 1 ? "1x (à vista)" : `${n}x`}
                  ativo={parcelas === n && !usarOutro}
                  onPress={() => {
                    setParcelas(n);
                    setUsarOutro(false);
                    setParcelasOutro("");
                    setEscolhendoParcelas(false);
                  }}
                />
              ))}
              <Chip rotulo="Outro" ativo={usarOutro} onPress={() => setUsarOutro(true)} />
            </View>
          )}
          {escolhendoParcelas && usarOutro && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
              <Text style={typography.body}>Quantas parcelas?</Text>
              <TextInput
                value={parcelasOutro}
                autoFocus
                onChangeText={(t) => {
                  const n = t.replace(/\D/g, "").slice(0, 2);
                  setParcelasOutro(n);
                  const v = parseInt(n, 10);
                  if (v >= 2 && v <= 48) setParcelas(v);
                }}
                placeholder="Ex.: 18"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={[estiloInput(), { width: 90, textAlign: "center" }]}
              />
            </View>
          )}

          {parcelas > 1 && centavos > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.label, { color: colors.accent, marginBottom: 4 }]}>
                {parcelas}x de {formatarReais(valorParcela[parcelas - 1] / 100)}
                {" — mês em que cada parcela é paga:"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {valorParcela.map((v, i) => {
                  const ref = somarMeses(pagamentoEfetivo, i);
                  return (
                    <Text key={i} style={[typography.label, { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
                      {i + 1}ª {MESES_CURTOS[Number(ref.slice(5, 7)) - 1]}/{ref.slice(2, 4)} · {formatarReais(v / 100)}
                    </Text>
                  );
                })}
              </View>
            </View>
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

      {/* Fora do cartão, esta é a data em que o dinheiro sai (define o mês). No cartão, é a data da compra. */}
      <Secao titulo={forma === "credito" ? "DATA DA COMPRA" : "DATA DO PAGAMENTO"}>
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
          style={[estiloInput(), { borderRadius: 999, paddingVertical: 6, minWidth: 130, fontSize: 14, borderColor: usandoOutraData ? colors.accent : colors.border }]}
        />
      </Secao>
      {usandoOutraData && <Text style={[typography.label, { marginTop: spacing.xs }]}>{rotuloDia(data)}</Text>}

      <Botao titulo={parcelas > 1 ? `Salvar ${parcelas} parcelas` : "Salvar"} onPress={salvar} carregando={salvando} style={{ marginTop: spacing.xl }} />
      {gastoId && <Botao titulo="Excluir despesa" variante="link" onPress={excluir} style={{ marginTop: spacing.sm }} />}
      {itensNota.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <ItensDaNota itens={itensNota} />
        </View>
      )}
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

/** Botão quadrado de atalho no topo de "Lançar despesa". */
function Atalho({ emoji, titulo, onPress }: { emoji: string; titulo: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        minHeight: 84,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.sm,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={[typography.label, { color: colors.textPrimary, textAlign: "center", marginTop: 4 }]} numberOfLines={2}>
        {titulo}
      </Text>
    </TouchableOpacity>
  );
}
