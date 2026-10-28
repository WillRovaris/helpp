import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Cartao, IconeCategoria, useEspacoRodape } from "../components/ui";
import { useCartoes, useCategorias, useFaturasPagas, useResumoDoMes } from "../data/hooks";
import { tipoReceita, tituloGasto } from "../data/tipos";
import { vencimentoNoMes } from "../lib/contas";
import { hojeISO, MESES } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Calendario">;

type Evento = {
  id: string;
  dia: number;
  tipo: "despesa" | "conta" | "fatura" | "receita";
  titulo: string;
  valor: number | null;
  pago?: boolean;
  categoria?: { icone?: string; cor?: string };
  emoji?: string;
};

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

// Calendário do mês: em cada dia o que vence ou cai (contas fixas, faturas, outras despesas e entradas).
export function CalendarioScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [diaEscolhido, setDiaEscolhido] = useState<number | null>(hoje.getDate());
  const r = useResumoDoMes(ano, mes);
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();
  const { faturaPaga } = useFaturasPagas();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const comp = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();

  const eventos = useMemo(() => {
    const lista: Evento[] = [];
    const catPorId = new Map(categorias.map((c) => [c.id, c]));
    const porCartao = new Map<string, number>();
    for (const g of r.despesas) {
      if (g.cartao_id) {
        porCartao.set(g.cartao_id, (porCartao.get(g.cartao_id) ?? 0) + g.valor);
        continue;
      }
      const data = g.data_pagamento ?? g.data;
      if (data.slice(0, 7) !== comp.slice(0, 7)) continue;
      const cat = g.categoria_id ? catPorId.get(g.categoria_id) : undefined;
      lista.push({
        id: g.id,
        dia: Number(data.slice(8, 10)),
        tipo: g.contaFixa ? "conta" : "despesa",
        titulo: tituloGasto(g, cat?.nome),
        valor: g.contaFixa?.valorVaria ? null : g.valor,
        pago: !g.contaFixa,
        categoria: cat,
      });
    }
    for (const [cartaoId, total] of porCartao) {
      const c = cartoes.find((x) => x.id === cartaoId);
      if (!c) continue;
      const venc = vencimentoNoMes(comp, c.dia_vencimento);
      lista.push({ id: `fatura:${cartaoId}`, dia: Number(venc.slice(8, 10)), tipo: "fatura", titulo: `Fatura ${c.nome}`, valor: total, pago: faturaPaga(c.id, venc), emoji: "💳" });
    }
    for (const e of r.entradas) {
      const t = tipoReceita(e.tipo);
      lista.push({
        id: `receita:${e.id}`,
        dia: Math.min(diasNoMes, Number(e.data.slice(8, 10))),
        tipo: "receita",
        titulo: e.descricao ? `${t.nome} · ${e.descricao}` : t.nome,
        valor: e.valor,
        emoji: t.emoji,
      });
    }
    return lista.sort((a, b) => a.dia - b.dia);
  }, [r, categorias, cartoes, faturaPaga, comp, diasNoMes]);

  const porDia = new Map<number, Evento[]>();
  for (const e of eventos) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e]);
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  const aPagar = eventos.filter((e) => (e.tipo === "conta" || e.tipo === "fatura") && !e.pago).reduce((s, e) => s + (e.valor ?? 0), 0);
  const doDia = diaEscolhido ? (porDia.get(diaEscolhido) ?? []) : [];

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
    setDiaEscolhido(d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() ? hoje.getDate() : null);
  }

  const corDoPonto = (e: Evento) => (e.tipo === "receita" ? colors.accent : e.tipo === "fatura" ? colors.warning : e.pago ? colors.textSecondary : colors.danger);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => mudarMes(-1)} style={{ padding: spacing.sm }} accessibilityLabel="Mês anterior">
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>
          {MESES[mes]} {ano}
        </Text>
        <TouchableOpacity onPress={() => mudarMes(1)} style={{ padding: spacing.sm }} accessibilityLabel="Próximo mês">
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        <View style={{ flexDirection: "row" }}>
          {SEMANA.map((d, i) => (
            <Text key={i} style={[typography.label, { width: `${100 / 7}%`, textAlign: "center", marginBottom: spacing.xs }]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {celulas.map((dia, i) => {
            const evs = dia ? (porDia.get(dia) ?? []) : [];
            const escolhido = dia != null && dia === diaEscolhido;
            const ehHoje = ehMesAtual && dia === hoje.getDate();
            return (
              <TouchableOpacity
                key={i}
                disabled={!dia}
                onPress={() => setDiaEscolhido(dia)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: escolhido ? colors.accent : "transparent",
                  borderWidth: ehHoje && !escolhido ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                {dia != null && (
                  <>
                    <Text style={[typography.body, { fontSize: 15, fontWeight: evs.length ? "700" : "400", color: escolhido ? colors.accentContrast : colors.textPrimary }]}>{dia}</Text>
                    <View style={{ flexDirection: "row", gap: 2, height: 6, marginTop: 2 }}>
                      {evs.slice(0, 3).map((e) => (
                        <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: escolhido ? colors.accentContrast : corDoPonto(e) }} />
                      ))}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm }}>
          <Legenda cor={colors.danger} texto="A pagar" />
          <Legenda cor={colors.warning} texto="Fatura" />
          <Legenda cor={colors.textSecondary} texto="Pago" />
          <Legenda cor={colors.accent} texto="Entrada" />
        </View>
      </Cartao>

      {aPagar > 0 && (
        <Text style={[typography.label, { textAlign: "center" }]}>Contas e faturas ainda a pagar neste mês: {mostrarValor(aPagar)}</Text>
      )}

      {diaEscolhido != null && (
        <>
          <Text style={typography.label}>
            DIA {diaEscolhido} DE {MESES[mes].toUpperCase()} ({doDia.length})
          </Text>
          {doDia.length === 0 ? (
            <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.sm }]}>Nada neste dia.</Text>
          ) : (
            <Cartao style={{ paddingVertical: spacing.xs }}>
              {doDia.map((e, i) => (
                <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <IconeCategoria categoria={e.categoria ?? { cor: e.tipo === "receita" ? colors.accent : colors.warning }} emoji={e.emoji} tamanho={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>
                      {e.titulo}
                    </Text>
                    <Text style={[typography.label, { color: corDoPonto(e) }]}>
                      {e.tipo === "receita" ? "Entrada" : e.tipo === "fatura" ? (e.pago ? "✅ Fatura paga" : "Fatura vence") : e.tipo === "conta" ? "Conta fixa a pagar" : "Despesa"}
                    </Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600", color: e.tipo === "receita" ? colors.accent : colors.textPrimary }]}>
                    {e.valor == null ? "valor varia" : `${e.tipo === "receita" ? "+" : ""}${mostrarValor(e.valor)}`}
                  </Text>
                </View>
              ))}
            </Cartao>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
      <Text style={typography.label}>{texto}</Text>
    </View>
  );
}
