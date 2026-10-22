import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCartoes, useCategorias, useFaturasPagas } from "../data/hooks";
import { emojiCategoria, type Gasto, tituloGasto } from "../data/tipos";
import { detectarParcela } from "../importacao/leitor";
import { descricaoSemParcela } from "../importacao/preparar";
import { diaMes, faturaDaCompra, faturaVizinha, mesPagamentoCartao, somarMeses } from "../lib/fatura";
import { formatarReais, gerarUuid, hojeISO, MESES, rotuloDia } from "../lib/format";
import { linhas, ouvirMudancas } from "../offline/banco";
import { atualizar, excluir, inserir, inserirVarios } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CartaoDetalhe">;

// Uma fatura por vez, com ‹ › para ver as anteriores e as futuras (parcelas).
// Abre na fatura que está para vencer (se ainda não foi paga); senão, na aberta.
export function CartaoDetalheScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const { cartaoId } = route.params;
  const { casa, membros } = useCasa();
  const { cartoes } = useCartoes();
  const { categorias } = useCategorias();
  const { faturasPagas, recarregar: recarregarPagas } = useFaturasPagas();
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const [deslocamento, setDeslocamento] = useState(0);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [salvandoPaga, setSalvandoPaga] = useState(false);
  const [lancandoParcelas, setLancandoParcelas] = useState(false);
  const escolheuInicio = useRef(false);

  const atual = cartao ? faturaDaCompra(hojeISO(), cartao.dia_fechamento, cartao.dia_vencimento) : null;
  const fatura = cartao && atual ? (deslocamento === 0 ? atual : faturaVizinha(atual.fechamento, deslocamento, cartao.dia_fechamento, cartao.dia_vencimento)) : null;
  const inicio = cartao && fatura ? faturaVizinha(fatura.fechamento, -1, cartao.dia_fechamento, cartao.dia_vencimento).fechamento : null;

  useEffect(() => {
    if (cartao) navigation.setOptions({ title: cartao.nome, headerRight: () => (
      <TouchableOpacity onPress={() => navigation.navigate("CartaoForm", { cartaoId })}>
        <Text style={{ color: colors.accent, fontWeight: "600" }}>Editar</Text>
      </TouchableOpacity>
    ) });
  }, [cartao, cartaoId, navigation]);

  // Escolhe a fatura inicial uma vez: a fechada a vencer, se tiver compras e não estiver paga.
  useEffect(() => {
    if (!casa || !cartao || !atual || escolheuInicio.current) return;
    escolheuInicio.current = true;
    const anterior = faturaVizinha(atual.fechamento, -1, cartao.dia_fechamento, cartao.dia_vencimento);
    if (hojeISO() > anterior.vencimento) return;
    const temCompras = linhas("gastos").some(
      (g) => g.casa_id === casa.id && g.cartao_id === cartaoId && mesPagamentoCartao(g as { data: string }, cartao) === anterior.vencimento.slice(0, 7),
    );
    const paga = linhas("faturas_pagas").some((p) => p.cartao_id === cartaoId && p.vencimento === anterior.vencimento);
    if (temCompras && !paga) setDeslocamento(-1);
  }, [casa?.id, cartao, atual?.fechamento, cartaoId]);

  const carregar = useCallback(() => {
    if (!casa || !fatura || !inicio || !cartao) return;
    // Fatura = tudo deste cartão que é pago no mês do vencimento dela (data de
    // pagamento informada, ou calculada pela data da compra). Lido do celular.
    const mes = fatura.vencimento.slice(0, 7);
    setGastos(
      linhas("gastos")
        .filter((g) => g.casa_id === casa.id && g.cartao_id === cartaoId && mesPagamentoCartao(g as { data: string }, cartao) === mes)
        .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
        .map((g) => ({ ...g, valor: Number(g.valor) }) as Gasto),
    );
  }, [casa?.id, cartaoId, fatura?.fechamento, fatura?.vencimento, inicio, cartao]);

  // Atualiza quando algo muda no celular ou chega da nuvem.
  useEffect(() => ouvirMudancas((t) => t === "gastos" && carregar()), [carregar]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!cartao || !fatura) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const hoje = hojeISO();
  const registroPaga = faturasPagas.find((p) => p.cartao_id === cartaoId && p.vencimento === fatura.vencimento);
  const podeMarcarPaga = deslocamento <= 0 && total > 0;

  async function marcarPaga() {
    if (!casa || !fatura) return;
    setSalvandoPaga(true);
    inserir("faturas_pagas", { casa_id: casa.id, cartao_id: cartaoId, vencimento: fatura.vencimento, valor: total, pago_em: hojeISO() });
    setSalvandoPaga(false);
  }

  // Compras com "Parcela 3/5" na descrição que ainda não têm as próximas parcelas lançadas
  // (ex.: importadas antes desta função existir).
  const semParcelasFuturas = gastos
    .filter((g) => !g.parcelamento_id && g.descricao)
    .map((g) => ({ g, p: detectarParcela(g.descricao!) }))
    .filter((x): x is { g: Gasto; p: string } => !!x.p && Number(x.p.split("/")[0]) < Number(x.p.split("/")[1]));
  async function lancarParcelasFuturas() {
    if (!casa) return;
    setLancandoParcelas(true);
    try {
      let criadas = 0;
      for (const { g, p } of semParcelasFuturas) {
        const [atual, total] = p.split("/").map(Number);
        const grupo = gerarUuid();
        const descricao = descricaoSemParcela(g.descricao!);
        atualizar("gastos", g.id, { descricao, parcelamento_id: grupo, parcela: atual, parcelas: total });
        const futuras = [];
        for (let k = atual + 1; k <= total; k++) {
          futuras.push({
            casa_id: casa.id,
            valor: g.valor,
            data: somarMeses(g.data, k - atual),
            descricao,
            categoria_id: g.categoria_id,
            forma_pagamento: g.forma_pagamento,
            cartao_id: g.cartao_id,
            pago_por: g.pago_por,
            parcelamento_id: grupo,
            parcela: k,
            parcelas: total,
          });
        }
        inserirVarios("gastos", futuras);
        criadas += futuras.length;
      }
      Alert.alert("Pronto!", `${criadas} parcelas lançadas nas próximas faturas.`);
      carregar();
    } finally {
      setLancandoParcelas(false);
    }
  }

  function desfazerPaga() {
    Alert.alert("Desmarcar fatura paga?", "Ela volta a aparecer como a pagar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desmarcar",
        style: "destructive",
        onPress: async () => {
          excluir("faturas_pagas", [registroPaga!.id]);
        },
      },
    ]);
  }
  const situacao =
    registroPaga ? "✅ Paga" : deslocamento > 0 ? "Futura" : deslocamento === 0 ? "Aberta" : hoje <= fatura.vencimento ? "Fechada · a vencer" : "Fechada";
  const mesVenc = Number(fatura.vencimento.slice(5, 7)) - 1;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const nomePessoa = new Map(membros.map((m) => [m.user_id, m.nome]));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setDeslocamento(deslocamento - 1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>Fatura de {MESES[mesVenc]}</Text>
          <Text style={typography.label}>{situacao}</Text>
        </View>
        <TouchableOpacity onPress={() => setDeslocamento(deslocamento + 1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        <Text style={typography.label}>TOTAL DA FATURA</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(total)}</Text>
        <Text style={typography.label}>
          Fecha {diaMes(fatura.fechamento)} · vence {diaMes(fatura.vencimento)}
        </Text>
        {registroPaga ? (
          <TouchableOpacity onPress={desfazerPaga} style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 16 }}>✅ PAGA em {diaMes(registroPaga.pago_em)}</Text>
            <Text style={typography.label}>Toque para desmarcar</Text>
          </TouchableOpacity>
        ) : (
          podeMarcarPaga && <Botao titulo="✅ Marcar fatura como paga" onPress={marcarPaga} carregando={salvandoPaga} style={{ marginTop: spacing.md }} />
        )}
      </Cartao>

      {semParcelasFuturas.length > 0 && (
        <Cartao>
          <Text style={typography.body}>
            🔁 {semParcelasFuturas.length} {semParcelasFuturas.length === 1 ? "compra parcelada" : "compras parceladas"} nesta fatura ainda sem as próximas parcelas.
          </Text>
          <Botao titulo="Lançar as próximas parcelas" variante="secundario" onPress={lancarParcelasFuturas} carregando={lancandoParcelas} style={{ marginTop: spacing.sm }} />
        </Cartao>
      )}

      {gastos.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nenhuma compra nesta fatura.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {gastos.map((g, i) => {
            const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => navigation.navigate("GastoForm", { gastoId: g.id })}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>{tituloGasto(g, cat?.nome)}</Text>
                  <Text style={typography.label}>
                    {rotuloDia(g.data)}
                    {membros.length > 1 && g.pago_por ? ` · ${nomePessoa.get(g.pago_por) ?? ""}` : ""}
                  </Text>
                </View>
                <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
              </TouchableOpacity>
            );
          })}
        </Cartao>
      )}
    </ScrollView>
  );
}
