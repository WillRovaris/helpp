import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { ResultadosBusca } from "../components/BuscaDespesas";
import { Botao, Cartao as CartaoUI, Chip, estiloInput } from "../components/ui";
import { useCartoes, useCategorias, useGastosDoMes } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type Gasto, tituloGasto } from "../data/tipos";
import { formatarReais, MESES, rotuloDia } from "../lib/format";
import { enviarWhatsApp, textoResumoMes } from "../lib/relatorio";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Historico">;

export function HistoricoScreen({ navigation, route }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(route.params?.categoriaId ?? null);
  const [filtroPessoa, setFiltroPessoa] = useState<string | null>(null);
  /** "pix" | "debito" | "dinheiro" | "credito" (qualquer cartão) | "cartao:<id>" (um cartão). */
  const [filtroPagamento, setFiltroPagamento] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const { casa, membros } = useCasa();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();
  const { gastos, carregando, recarregar } = useGastosDoMes(ano, mes);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  const passaPagamento = (g: Gasto) => {
    if (!filtroPagamento) return true;
    if (filtroPagamento.startsWith("cartao:")) return g.cartao_id === filtroPagamento.slice(7);
    return g.forma_pagamento === filtroPagamento;
  };
  const filtrados = gastos.filter(
    (g) => (!filtroCategoria || g.categoria_id === filtroCategoria) && (!filtroPessoa || g.pago_por === filtroPessoa) && passaPagamento(g),
  );
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
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
  const nomePessoa = new Map(membros.map((m) => [m.user_id, m.nome]));
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();
  // Meses à frente mostram o que já está programado (parcelas, faturas de cartão).
  const ehFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());

  const emBusca = busca.trim().length >= 2;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="🔍 Buscar despesa (nome, categoria ou valor)"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          style={[estiloInput(), { flex: 1, borderRadius: 999 }]}
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
          Mostra o que já está programado para este mês: parcelas e faturas de cartão.
        </Text>
      )}

      <CartaoUI>
        <Text style={typography.label}>{filtroCategoria || filtroPessoa || filtroPagamento ? "TOTAL FILTRADO" : "TOTAL DO MÊS"}</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(total)}</Text>
        <Text style={typography.label}>{filtrados.length} {filtrados.length === 1 ? "despesa" : "despesas"}</Text>
        {gastos.some((g) => g.cartao_id) && (
          <Text style={[typography.label, { marginTop: spacing.xs }]}>💳 Compras no cartão contam no mês em que a fatura vence.</Text>
        )}
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

      {gastos.length > 0 && (
        <Botao
          titulo={`📤 Enviar resumo de ${MESES[mes]} no WhatsApp`}
          variante="secundario"
          onPress={() => enviarWhatsApp(textoResumoMes({ nomeCasa: casa?.nome ?? "", ano, mes, gastos, categorias, membros, renda: casa?.renda_mensal ?? null }))}
        />
      )}

      {!carregando && filtrados.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nenhuma despesa por aqui.</Text>
      )}

      {porDia.map((grupo) => (
        <View key={grupo.data}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
            <Text style={typography.label}>{rotuloDia(grupo.data).toUpperCase()}</Text>
            <Text style={typography.label}>{formatarReais(grupo.itens.reduce((s, g) => s + g.valor, 0))}</Text>
          </View>
          <CartaoUI style={{ paddingVertical: spacing.xs }}>
            {grupo.itens.map((g, i) => {
              const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
              const forma = g.forma_pagamento === "credito" && g.cartao_id
                ? `💳 ${cartaoPorId.get(g.cartao_id)?.nome ?? "Crédito"}`
                : FORMAS_PAGAMENTO.find((f) => f.valor === g.forma_pagamento)?.rotulo;
              const detalhes = [forma, membros.length > 1 && g.pago_por ? nomePessoa.get(g.pago_por) : null].filter(Boolean).join(" · ");
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => navigation.navigate("GastoForm", { gastoId: g.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>
                      {tituloGasto(g, cat?.nome)}
                    </Text>
                    <Text style={typography.label}>{detalhes}</Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
                </TouchableOpacity>
              );
            })}
          </CartaoUI>
        </View>
      ))}
      </>
      )}
    </ScrollView>
  );
}
