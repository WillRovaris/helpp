import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCasa } from "../casa/CasaContext";
import { CartaoSobra, PorCategoria, textoComparacao } from "../components/ResumoMes";
import { StatusSincronizacao } from "../components/StatusSincronizacao";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCartoes, useCategorias, useContasFixas, useFaturasPagas, useGastosCredito, useGastosDoMes, usePagamentosDoMes, useUltimosGastos } from "../data/hooks";
import { reagendarLembretes } from "../lembretes/lembretes";
import { competencia, contasComoDespesas, contasDoMes, textoSituacao } from "../lib/contas";
import { corSituacao } from "./ContasScreen";
import { emojiCategoria, tituloGasto } from "../data/tipos";
import { corLimite } from "../components/ResumoCartaoCard";
import { diaMes, resumirCartao, somarMeses } from "../lib/fatura";
import { hojeISO, MESES, rotuloDia } from "../lib/format";
import { enviarWhatsApp, textoResumoMes } from "../lib/relatorio";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { mostrarValor } = usePrivacidade();
  const rodape = useEspacoRodape();
  const { casa, membros, meuNome } = useCasa();
  const hoje = new Date();
  const { gastos, recarregar } = useGastosDoMes(hoje.getFullYear(), hoje.getMonth());
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const { gastos: gastosAnteriores } = useGastosDoMes(mesAnterior.getFullYear(), mesAnterior.getMonth());
  const { categorias } = useCategorias();
  const { ultimos, recarregar: recarregarUltimos } = useUltimosGastos(5);
  const { cartoes } = useCartoes();
  const { faturaPaga, recarregar: recarregarFaturasPagas } = useFaturasPagas();
  const comp = competencia(hoje.getFullYear(), hoje.getMonth());
  const { contas, recarregar: recarregarContas } = useContasFixas();
  const { pagamentos, recarregar: recarregarPag } = usePagamentosDoMes(comp);
  const { gastosCredito, recarregar: recarregarCredito } = useGastosCredito(somarMeses(hojeISO(), -3));

  useFocusEffect(
    useCallback(() => {
      recarregar();
      recarregarCredito();
      recarregarContas();
      recarregarPag();
      recarregarUltimos();
      recarregarFaturasPagas();
      if (casa) reagendarLembretes(casa.id);
    }, [recarregar, recarregarCredito, recarregarContas, recarregarPag, recarregarUltimos, recarregarFaturasPagas, casa]),
  );

  if (!casa) return null;

  // Mês passado só até o mesmo dia de hoje, para a comparação ser justa.
  const totalAnteriorAteHoje = gastosAnteriores.filter((g) => Number(g.data.slice(8, 10)) <= hoje.getDate()).reduce((s, g) => s + g.valor, 0);
  // Comparação justa: só o que já foi lançado (até hoje) nos dois meses.
  const comparacao = textoComparacao(
    gastos.filter((g) => Number(g.data.slice(8, 10)) <= hoje.getDate()).reduce((s, g) => s + g.valor, 0),
    totalAnteriorAteHoje,
  );
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const contasMes = contasDoMes(contas, pagamentos, comp, hojeISO());
  // Total do mês = despesas lançadas + contas fixas do mês ainda não pagas (um custo só).
  const despesasMes = [...gastos, ...contasComoDespesas(contasMes, comp)];
  const total = despesasMes.reduce((s, g) => s + g.valor, 0);
  const contasAbertas = contasMes.filter((c) => !c.pagamento);
  const pendentesUrgentes = contasAbertas.filter((c) => c.situacao === "atrasada" || c.situacao === "vence-logo");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.subtitle}>Olá, {meuNome}</Text>
            <Text style={typography.title}>{casa.nome}</Text>
          </View>
          <BotaoOlho />
          <TouchableOpacity onPress={() => navigation.navigate("Configuracoes")} style={{ padding: spacing.sm }} accessibilityLabel="Configurações">
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <StatusSincronizacao />

        <Cartao>
          <TouchableOpacity onPress={() => navigation.navigate("Historico", {})} activeOpacity={0.8}>
            <Text style={typography.label}>DESPESAS DE {MESES[hoje.getMonth()].toUpperCase()}</Text>
            <Text style={{ fontSize: 34, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs }}>{mostrarValor(total)}</Text>
            {comparacao && <Text style={[typography.label, { color: comparacao.cor }]}>{comparacao.texto}</Text>}
          </TouchableOpacity>
          <View style={{ marginTop: spacing.md }}>
            <CartaoSobra total={total} renda={casa.renda_mensal} onDefinirRenda={() => navigation.navigate("Renda")} />
          </View>
        </Cartao>

        <Botao titulo="+ Lançar despesa" onPress={() => navigation.navigate("GastoForm", {})} style={{ minHeight: 58 }} />

        {contasMes.length > 0 && (
          <TouchableOpacity onPress={() => navigation.navigate("Contas")} activeOpacity={0.8}>
            <Cartao>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={typography.label}>CONTAS FIXAS</Text>
                <Text style={[typography.label, { color: colors.accent }]}>
                  {contasMes.length - contasAbertas.length} de {contasMes.length} pagas ›
                </Text>
              </View>
              {pendentesUrgentes.length === 0 ? (
                <Text style={[typography.body, { marginTop: spacing.xs, color: contasAbertas.length ? colors.textPrimary : colors.accent }]}>
                  {contasAbertas.length ? `Próxima: ${contasAbertas[0].conta.nome} · ${textoSituacao(contasAbertas[0]).toLowerCase()}` : "✅ Todas pagas este mês"}
                </Text>
              ) : (
                pendentesUrgentes.slice(0, 3).map((c) => (
                  <Text key={c.conta.id} style={[typography.body, { marginTop: spacing.xs, color: corSituacao(c) }]}>
                    {c.situacao === "atrasada" ? "⚠️" : "⏰"} {c.conta.nome}{c.conta.valor ? ` (${mostrarValor(c.conta.valor)})` : ""} · {textoSituacao(c).toLowerCase()}
                  </Text>
                ))
              )}
            </Cartao>
          </TouchableOpacity>
        )}

        {cartoes.length > 0 && (
          <Cartao style={{ paddingVertical: spacing.xs }}>
            {cartoes.map((c, i) => {
              const r = resumirCartao(gastosCredito.filter((g) => g.cartao_id === c.id), c, hojeISO(), (v) => faturaPaga(c.id, v));
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => navigation.navigate("CartaoDetalhe", { cartaoId: c.id })}
                  style={{ paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[typography.body, { fontWeight: "600" }]}>💳 {c.nome}</Text>
                    <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(r.aberta.total)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={typography.label}>fatura vence {diaMes(r.aberta.vencimento)}</Text>
                    {c.limite > 0 && (
                      <Text style={[typography.label, { color: corLimite(r.limiteUsado, c.limite), fontWeight: "700" }]}>
                        {r.disponivel >= 0 ? `faltam ${mostrarValor(r.disponivel)}` : `estourou ${mostrarValor(-r.disponivel)}`}
                      </Text>
                    )}
                  </View>
                  {r.fechada && !r.fechada.paga && (
                    <Text style={[typography.label, { color: colors.warning }]}>
                      ⏰ fatura fechada {mostrarValor(r.fechada.total)} vence {diaMes(r.fechada.vencimento)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </Cartao>
        )}

        {ultimos.length > 0 && (
          <Cartao style={{ paddingVertical: spacing.xs }}>
            {ultimos.map((g, i) => {
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
                    <Text style={typography.label}>{rotuloDia(g.data)}</Text>
                  </View>
                  <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(g.valor)}</Text>
                </TouchableOpacity>
              );
            })}
          </Cartao>
        )}

        <PorCategoria
          gastos={despesasMes}
          categorias={categorias}
          onPressCategoria={(id) => navigation.navigate("Historico", id ? { categoriaId: id } : {})}
        />

        <Botao
          titulo="📤 Enviar resumo do mês no WhatsApp"
          variante="secundario"
          onPress={() =>
            enviarWhatsApp(
              textoResumoMes({ nomeCasa: casa.nome, ano: hoje.getFullYear(), mes: hoje.getMonth(), gastos: despesasMes, categorias, membros, renda: casa.renda_mensal }),
            )
          }
        />

        {/* Rodapé: tudo que foi lançado, mês a mês. */}
        <Botao titulo="📋 Histórico" variante="secundario" onPress={() => navigation.navigate("Historico", {})} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}
