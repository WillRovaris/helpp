import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCategorias, useContasFixas, usePagamentosDoMes } from "../data/hooks";
import { emojiCategoria } from "../data/tipos";
import { type ContaDoMes, competencia, contasDoMes, textoSituacao } from "../lib/contas";
import { diaMes } from "../lib/fatura";
import { formatarReais, hojeISO, MESES } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Contas">;

export function corSituacao(c: ContaDoMes): string {
  return c.situacao === "paga" ? colors.accent : c.situacao === "atrasada" ? colors.danger : c.situacao === "vence-logo" ? colors.warning : colors.textSecondary;
}

export function ContasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const comp = competencia(ano, mes);

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
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(aPagar)}</Text>
              {variaveisAbertas > 0 && <Text style={typography.label}>+ {variaveisAbertas} com valor variável</Text>}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={typography.label}>JÁ PAGO</Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.accent }}>{formatarReais(pago)}</Text>
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
                    </Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600", marginRight: spacing.sm }]}>{valor != null ? formatarReais(valor) : "—"}</Text>
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
    </ScrollView>
  );
}
