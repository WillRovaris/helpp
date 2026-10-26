import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCategorias, useContasFixas, usePagamentosDoMes } from "../data/hooks";
import { emojiCategoria } from "../data/tipos";
import { type ContaDoMes, competencia, contasDoMes, textoSituacao } from "../lib/contas";
import { diaMes } from "../lib/fatura";
import { hojeISO, MESES } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";

type Props = NativeStackScreenProps<RootStackParamList, "Contas">;

export function corSituacao(c: ContaDoMes): string {
  return c.situacao === "paga" ? colors.accent : c.situacao === "atrasada" ? colors.danger : c.situacao === "vence-logo" ? colors.warning : colors.textSecondary;
}

export function ContasScreen({ navigation }: Props) {
  const { mostrarValor } = usePrivacidade();
  const { membros } = useCasa();
  // Casal: mostra de quem é cada conta (" · 👤 Will").
  const quemPaga = (id?: string | null) => {
    const nome = membros.length > 1 && id ? membros.find((m) => m.user_id === id)?.nome : undefined;
    return nome ? ` · 👤 ${nome}` : "";
  };
  const rodape = useEspacoRodape();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const comp = competencia(ano, mes);
  const [verTodas, setVerTodas] = useState(true);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const { contas, carregando, recarregar } = useContasFixas();
  const { pagamentos, recarregar: recarregarPag } = usePagamentosDoMes(comp);
  const { categorias } = useCategorias();

  useFocusEffect(
    useCallback(() => {
      recarregar();
      recarregarPag();
    }, [recarregar, recarregarPag]),
  );

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  const lista = contasDoMes(contas, pagamentos, comp, hojeISO());
  const pago = lista.reduce((s, c) => s + (c.pagamento?.valor ?? 0), 0);
  const aPagar = lista.filter((c) => !c.pagamento).reduce((s, c) => s + (c.conta.valor ?? 0), 0);
  const variaveisAbertas = lista.filter((c) => !c.pagamento && c.conta.valor == null).length;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => mudarMes(-1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>
          {MESES[mes]} {ano}
        </Text>
        <TouchableOpacity onPress={() => mudarMes(1)} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      {lista.length > 0 && (
        <Cartao>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={typography.label}>A PAGAR</Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(aPagar)}</Text>
              {variaveisAbertas > 0 && <Text style={typography.label}>+ {variaveisAbertas} com valor variável</Text>}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={typography.label}>JÁ PAGO</Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.accent }}>{mostrarValor(pago)}</Text>
              <Text style={typography.label}>
                {lista.filter((c) => c.pagamento).length} de {lista.length} contas
              </Text>
            </View>
          </View>
        </Cartao>
      )}

      {!carregando && lista.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Cadastre as contas que se repetem todo mês (aluguel, luz, água, internet, escola...) para ver o que já foi pago e o que está para vencer.
        </Text>
      )}

      {lista.length > 0 && (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {lista.map((c, i) => {
            const cat = c.conta.categoria_id ? categoriaPorId.get(c.conta.categoria_id) : undefined;
            const valor = c.pagamento?.valor ?? c.conta.valor;
            return (
              <View key={c.conta.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }} onPress={() => navigation.navigate("ContaForm", { contaId: c.conta.id })}>
                  <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{c.pagamento ? "✅" : emojiCategoria(cat?.icone)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>{c.conta.nome}</Text>
                    <Text style={[typography.label, { color: corSituacao(c) }]}>
                      {textoSituacao(c)} · {c.pagamento ? `em ${diaMes(c.pagamento.pago_em)}` : `dia ${diaMes(c.vencimento)}`}
                      {c.parcela ? ` · ${c.parcela.atual}/${c.parcela.total}` : ""}
                      {quemPaga(c.conta.pago_por)}
                    </Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600", marginRight: spacing.sm }]}>{valor != null ? mostrarValor(valor) : "—"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate("PagarConta", { contaId: c.conta.id, competencia: comp })}
                  style={{
                    borderWidth: 1,
                    borderColor: c.pagamento ? colors.border : colors.accent,
                    backgroundColor: c.pagamento ? "transparent" : colors.accent,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: c.pagamento ? colors.textSecondary : colors.accentContrast, fontWeight: "600", fontSize: 13 }}>{c.pagamento ? "Ver" : "Paguei"}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </Cartao>
      )}

      <Botao titulo="+ Nova conta fixa" variante="secundario" onPress={() => navigation.navigate("ContaForm", {})} />

      {/* Todas as contas cadastradas (inclusive fora do período deste mês), para consultar e editar. */}
      {contas.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setVerTodas((v) => !v)} style={{ marginTop: spacing.md }}>
            <Text style={[typography.label, { color: colors.accent }]}>
              {verTodas ? "▾" : "▸"} TODAS AS CONTAS CADASTRADAS ({contas.length})
            </Text>
          </TouchableOpacity>
          {verTodas && (
            <Cartao style={{ paddingVertical: spacing.xs }}>
              {contas.map((c, i) => {
                const cat = c.categoria_id ? categoriaPorId.get(c.categoria_id) : undefined;
                const periodo = c.inicio ? ` · desde ${MESES[Number(c.inicio.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}/${c.inicio.slice(2, 4)}${c.meses ? ` por ${c.meses} meses` : ""}` : "";
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => navigation.navigate("ContaForm", { contaId: c.id })}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
                  >
                    <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body} numberOfLines={1}>{c.nome}</Text>
                      <Text style={typography.label}>
                        Todo dia {c.dia_vencimento} · {c.valor != null ? "valor fixo" : "valor variável"}
                        {quemPaga(c.pago_por)}
                        {periodo}
                      </Text>
                    </View>
                    <Text style={[typography.body, { fontWeight: "600" }]}>{c.valor != null ? mostrarValor(c.valor) : "—"}</Text>
                  </TouchableOpacity>
                );
              })}
            </Cartao>
          )}
        </>
      )}
    </ScrollView>
  );
}
