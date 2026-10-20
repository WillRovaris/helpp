import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCasa } from "../casa/CasaContext";
import { CartaoSobra, PorCategoria, textoComparacao } from "../components/ResumoMes";
import { Botao, Cartao } from "../components/ui";
import { useCartoes, useCategorias, useGastosCredito, useGastosDoMes } from "../data/hooks";
import { emojiCategoria, tituloGasto } from "../data/tipos";
import { corLimite } from "../components/ResumoCartaoCard";
import { diaMes, resumirCartao, somarMeses } from "../lib/fatura";
import { formatarReais, hojeISO, MESES, rotuloDia } from "../lib/format";
import { enviarWhatsApp, textoResumoMes } from "../lib/relatorio";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { casa, membros, meuNome } = useCasa();
  const hoje = new Date();
  const { gastos, recarregar } = useGastosDoMes(hoje.getFullYear(), hoje.getMonth());
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const { gastos: gastosAnteriores } = useGastosDoMes(mesAnterior.getFullYear(), mesAnterior.getMonth());
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();
  const { gastosCredito, recarregar: recarregarCredito } = useGastosCredito(somarMeses(hojeISO(), -3));

  useFocusEffect(
    useCallback(() => {
      recarregar();
      recarregarCredito();
    }, [recarregar, recarregarCredito]),
  );

  if (!casa) return null;

  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const ultimos = gastos.slice(0, 5);
  // Mês passado só até o mesmo dia de hoje, para a comparação ser justa.
  const totalAnteriorAteHoje = gastosAnteriores.filter((g) => Number(g.data.slice(8, 10)) <= hoje.getDate()).reduce((s, g) => s + g.valor, 0);
  const comparacao = textoComparacao(total, totalAnteriorAteHoje);
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.subtitle}>Olá, {meuNome}</Text>
            <Text style={typography.title}>{casa.nome}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Configuracoes")} style={{ padding: spacing.sm }} accessibilityLabel="Configurações">
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <Cartao>
          <TouchableOpacity onPress={() => navigation.navigate("Historico", {})} activeOpacity={0.8}>
            <Text style={typography.label}>GASTOS DE {MESES[hoje.getMonth()].toUpperCase()}</Text>
            <Text style={{ fontSize: 34, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs }}>{formatarReais(total)}</Text>
            {comparacao && <Text style={[typography.label, { color: comparacao.cor }]}>{comparacao.texto}</Text>}
          </TouchableOpacity>
          <View style={{ marginTop: spacing.md }}>
            <CartaoSobra total={total} renda={casa.renda_mensal} onDefinirRenda={() => navigation.navigate("Renda")} />
          </View>
        </Cartao>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Botao titulo="+ Lançar gasto" onPress={() => navigation.navigate("GastoForm", {})} style={{ flex: 1, minHeight: 58 }} />
          <Botao titulo="📷 Ler nota" onPress={() => navigation.navigate("NotaScanner")} style={{ flex: 1, minHeight: 58 }} />
        </View>

        {cartoes.length > 0 && (
          <Cartao style={{ paddingVertical: spacing.xs }}>
            {cartoes.map((c, i) => {
              const r = resumirCartao(gastosCredito.filter((g) => g.cartao_id === c.id), c, hojeISO());
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => navigation.navigate("CartaoDetalhe", { cartaoId: c.id })}
                  style={{ paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[typography.body, { fontWeight: "600" }]}>💳 {c.nome}</Text>
                    <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(r.aberta.total)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={typography.label}>fatura vence {diaMes(r.aberta.vencimento)}</Text>
                    {c.limite > 0 && (
                      <Text style={[typography.label, { color: corLimite(r.limiteUsado, c.limite), fontWeight: "700" }]}>
                        {r.disponivel >= 0 ? `faltam ${formatarReais(r.disponivel)}` : `estourou ${formatarReais(-r.disponivel)}`}
                      </Text>
                    )}
                  </View>
                  {r.fechada && (
                    <Text style={[typography.label, { color: colors.warning }]}>⏰ fatura fechada {formatarReais(r.fechada.total)} vence {diaMes(r.fechada.vencimento)}</Text>
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
                  <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
                </TouchableOpacity>
              );
            })}
          </Cartao>
        )}

        <PorCategoria
          gastos={gastos}
          categorias={categorias}
          onPressCategoria={(id) => navigation.navigate("Historico", id ? { categoriaId: id } : {})}
        />

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Botao titulo="📋 Histórico" variante="secundario" onPress={() => navigation.navigate("Historico", {})} style={{ flex: 1 }} />
          <Botao titulo="💳 Cartões" variante="secundario" onPress={() => navigation.navigate("Cartoes")} style={{ flex: 1 }} />
        </View>

        <Botao
          titulo="📤 Enviar resumo do mês no WhatsApp"
          variante="secundario"
          onPress={() =>
            enviarWhatsApp(
              textoResumoMes({ nomeCasa: casa.nome, ano: hoje.getFullYear(), mes: hoje.getMonth(), gastos, categorias, membros, renda: casa.renda_mensal }),
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
