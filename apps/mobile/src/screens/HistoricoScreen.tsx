import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HeaderHeightContext } from "@react-navigation/elements";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { ResultadosBusca } from "../components/BuscaDespesas";
import { Cartao as CartaoUI, Chip, estiloInput, useEspacoRodape, IconeCategoria } from "../components/ui";
import { useCartoes, useCategorias, useContasFixas, useGastosDoMes, usePagamentosDoMes } from "../data/hooks";
import { competencia, contasComoDespesas, contasDoMes } from "../lib/contas";
import { emojiCategoria, FORMAS_PAGAMENTO, type Gasto, tituloGasto } from "../data/tipos";
import { hojeISO, MESES, rotuloDia } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { linhas as linhasLocais, ouvirMudancas } from "../offline/banco";

type Props = NativeStackScreenProps<RootStackParamList, "Historico">;

export function HistoricoScreen({ navigation, route }: Props) {
  const { mostrarValor } = usePrivacidade();
  // Olho no cabeçalho: mostra/esconde os valores (mesmo controle da tela inicial).
  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);
  const rodape = useEspacoRodape();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(route.params?.categoriaId ?? null);
  const [filtroPessoa, setFiltroPessoa] = useState<string | null>(null);
  /** "pix" | "debito" | "dinheiro" | "credito" (qualquer cartão) | "cartao:<id>" (um cartão). */
  const [filtroPagamento, setFiltroPagamento] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  // Ao tocar na busca, a tela rola até o campo ficar no topo (acima do teclado).
  const rolagem = useRef<ScrollView>(null);
  const posicaoBusca = useRef(0);
  const alturaCabecalho = useContext(HeaderHeightContext) ?? 0;
  const subirBusca = () => setTimeout(() => rolagem.current?.scrollTo({ y: Math.max(0, posicaoBusca.current - spacing.sm), animated: true }), 150);

  const { membros } = useCasa();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();
  const { gastos, carregando, recarregar } = useGastosDoMes(ano, mes);
  const comp = competencia(ano, mes);
  const { contas, recarregar: recarregarContas } = useContasFixas();
  const { pagamentos, recarregar: recarregarPag } = usePagamentosDoMes(comp);

  useFocusEffect(
    useCallback(() => {
      recarregar();
      recarregarContas();
      recarregarPag();
    }, [recarregar, recarregarContas, recarregarPag]),
  );

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  const passaPagamento = (g: Gasto) => {
    if (!filtroPagamento) return true;
    if (g.contaFixa) return false; // conta ainda não paga não tem forma de pagamento
    if (filtroPagamento.startsWith("cartao:")) return g.cartao_id === filtroPagamento.slice(7);
    return g.forma_pagamento === filtroPagamento;
  };
  // Contas fixas do mês ainda não pagas entram como despesas comuns (no dia do vencimento).
  const contasAPagar = contasComoDespesas(contasDoMes(contas, pagamentos, comp, hojeISO()), comp);
  const filtrados = [...gastos, ...contasAPagar]
    .filter((g) => (!filtroCategoria || g.categoria_id === filtroCategoria) && (!filtroPessoa || g.pago_por === filtroPessoa) && passaPagamento(g))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  const total = filtrados.reduce((s, g) => s + g.valor, 0);

  const porDia = useMemo(() => {
    const grupos: { data: string; itens: Gasto[] }[] = [];
    for (const g of filtrados) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.data === g.data) ultimo.itens.push(g);
      else grupos.push({ data: g.data, itens: [g] });
    }
    return grupos;
  }, [filtrados]);

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  // Itens das notas fiscais (lidos do celular), agrupados pela nota.
  const [itensAbertos, setItensAbertos] = useState<Set<string>>(new Set());
  const [versaoItens, setVersaoItens] = useState(0);
  useEffect(() => ouvirMudancas((t) => t === "nota_itens" && setVersaoItens((v) => v + 1)), []);
  const itensPorNota = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; valorTotal: number }[]>();
    for (const it of linhasLocais("nota_itens")) {
      const lista = mapa.get(it.nota_id) ?? [];
      lista.push({ nome: it.nome, quantidade: Number(it.quantidade), valorTotal: Number(it.valor_total) });
      mapa.set(it.nota_id, lista);
    }
    return mapa;
  }, [versaoItens]);
  function alternarItens(id: string) {
    setItensAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
  const nomePessoa = new Map(membros.map((m) => [m.user_id, m.nome]));
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();
  // Meses à frente mostram o que já está programado (parcelas, faturas de cartão).
  const ehFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());

  const emBusca = busca.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={alturaCabecalho}>
    <ScrollView ref={rolagem} style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => mudarMes(-1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>
            {MESES[mes]} {ano}
          </Text>
          {!ehMesAtual && (
            <TouchableOpacity
              onPress={() => {
                setAno(hoje.getFullYear());
                setMes(hoje.getMonth());
              }}
            >
              <Text style={[typography.label, { color: colors.accent }]}>{ehFuturo ? "📅 Mês futuro · voltar para hoje" : "voltar para hoje"}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => mudarMes(1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      {ehFuturo && (
        <Text style={[typography.label, { textAlign: "center" }]}>
          Mostra o que já está programado para este mês: parcelas, faturas de cartão e contas fixas.
        </Text>
      )}

      <CartaoUI>
        <Text style={typography.label}>{filtroCategoria || filtroPessoa || filtroPagamento ? "TOTAL FILTRADO" : "TOTAL DO MÊS"}</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(total)}</Text>
        <Text style={typography.label}>{filtrados.length} {filtrados.length === 1 ? "despesa" : "despesas"}</Text>
      </CartaoUI>

      <Text style={[typography.label, { marginBottom: -spacing.xs }]}>CATEGORIA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip rotulo="Todas" ativo={!filtroCategoria} onPress={() => setFiltroCategoria(null)} />
        {categorias.map((c) => (
          <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={filtroCategoria === c.id} onPress={() => setFiltroCategoria(filtroCategoria === c.id ? null : c.id)} />
        ))}
      </ScrollView>

      <Text style={[typography.label, { marginBottom: -spacing.xs }]}>COMO PAGOU</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip rotulo="Todos" ativo={!filtroPagamento} onPress={() => setFiltroPagamento(null)} />
        {[
          { valor: "pix", rotulo: "Pix" },
          { valor: "debito", rotulo: "Débito" },
          { valor: "dinheiro", rotulo: "Dinheiro" },
          { valor: "credito", rotulo: "💳 Todos os cartões" },
          ...cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: `💳 ${c.nome}` })),
        ].map((o) => (
          <Chip key={o.valor} rotulo={o.rotulo} ativo={filtroPagamento === o.valor} onPress={() => setFiltroPagamento(filtroPagamento === o.valor ? null : o.valor)} />
        ))}
      </ScrollView>

      {membros.length > 1 && (
        <Text style={[typography.label, { marginBottom: -spacing.xs }]}>QUEM PAGOU</Text>
      )}
      {membros.length > 1 && (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Chip rotulo="Todos" ativo={!filtroPessoa} onPress={() => setFiltroPessoa(null)} />
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.nome} ativo={filtroPessoa === m.user_id} onPress={() => setFiltroPessoa(filtroPessoa === m.user_id ? null : m.user_id)} />
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center" }} onLayout={(e) => (posicaoBusca.current = e.nativeEvent.layout.y)}>
        <TextInput
          value={busca}
          onChangeText={(t) => {
            setBusca(t);
            subirBusca();
          }}
          onFocus={subirBusca}
          placeholder="🔍 Buscar despesa"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          numberOfLines={1}
          style={[estiloInput(), { flex: 1, borderRadius: 999, height: 48, paddingVertical: 0, textAlignVertical: "center" }]}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca("")} style={{ padding: spacing.sm, marginLeft: spacing.xs }} accessibilityLabel="Limpar busca">
            <Text style={{ fontSize: 18, color: colors.textSecondary }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {emBusca ? (
        <ResultadosBusca termo={busca} categorias={categorias} onAbrir={(id) => navigation.navigate("GastoForm", { gastoId: id })} />
      ) : (
      <>
      {!carregando && filtrados.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nenhuma despesa por aqui.</Text>
      )}

      {porDia.map((grupo) => (
        <View key={grupo.data}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
            <Text style={typography.label}>{rotuloDia(grupo.data).toUpperCase()}</Text>
            <Text style={typography.label}>{mostrarValor(grupo.itens.reduce((s, g) => s + g.valor, 0))}</Text>
          </View>
          <CartaoUI style={{ paddingVertical: spacing.xs }}>
            {grupo.itens.map((g, i) => {
              const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
              const forma = g.forma_pagamento === "credito" && g.cartao_id
                ? `💳 ${cartaoPorId.get(g.cartao_id)?.nome ?? "Crédito"}`
                : FORMAS_PAGAMENTO.find((f) => f.valor === g.forma_pagamento)?.rotulo;
              const detalhes = g.contaFixa
                ? "🧾 conta fixa · a pagar"
                : [forma, membros.length > 1 && g.pago_por ? nomePessoa.get(g.pago_por) : null].filter(Boolean).join(" · ");
              const itens = g.nota_id ? (itensPorNota.get(g.nota_id) ?? []) : [];
              const aberto = itensAbertos.has(g.id);
              return (
                <View key={g.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <TouchableOpacity
                  onPress={() =>
                    g.contaFixa
                      ? navigation.navigate("PagarConta", { contaId: g.contaFixa.contaId, competencia: g.contaFixa.competencia })
                      : navigation.navigate("GastoForm", { gastoId: g.id })
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                  }}
                >
                  <IconeCategoria categoria={cat} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>
                      {g.pessoal ? "👤 " : ""}
                      {tituloGasto(g, cat?.nome)}
                    </Text>
                    <Text style={typography.label}>{detalhes}</Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{g.contaFixa?.valorVaria ? "valor varia" : mostrarValor(g.valor)}</Text>
                </TouchableOpacity>
                {/* Despesa de nota fiscal: o que foi comprado, abre e fecha aqui mesmo */}
                {itens.length > 0 && (
                  <TouchableOpacity onPress={() => alternarItens(g.id)} style={{ paddingBottom: spacing.sm, marginLeft: 30 }}>
                    <Text style={[typography.label, { color: colors.accent }]}>
                      🧾 {itens.length} {itens.length === 1 ? "item" : "itens"} da nota {aberto ? "▴" : "▾"}
                    </Text>
                  </TouchableOpacity>
                )}
                {aberto &&
                  itens.map((it, k) => (
                    <View key={k} style={{ flexDirection: "row", marginLeft: 30, paddingVertical: 3 }}>
                      <Text style={[typography.label, { flex: 1, color: colors.textPrimary }]} numberOfLines={2}>
                        {it.quantidade !== 1 ? `${String(it.quantidade).replace(".", ",")} × ` : ""}
                        {it.nome}
                      </Text>
                      <Text style={[typography.label, { marginLeft: spacing.sm }]}>{mostrarValor(it.valorTotal)}</Text>
                    </View>
                  ))}
                {aberto && <View style={{ height: spacing.sm }} />}
                </View>
              );
            })}
          </CartaoUI>
        </View>
      ))}
      </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
