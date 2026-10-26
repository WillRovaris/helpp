import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Barra } from "../components/ResumoMes";
import { Botao, Cartao, useEspacoRodape } from "../components/ui";
import { useCategorias, useResumoDoMes } from "../data/hooks";
import { emojiCategoria, tituloGasto } from "../data/tipos";
import { hojeISO, MESES } from "../lib/format";
import { nivelLimite } from "../lib/limites";
import { enviarWhatsApp, textoResumoMes } from "../lib/relatorio";
import { mesAnterior } from "../lib/saldo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Fechamento">;

const proximoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};

// Fechamento do mês: quanto entrou, quanto saiu, quanto sobrou, onde mais gastou e quem pagou.
// Abre pelo aviso do dia 1 (notificação ou faixa na tela inicial); padrão = mês que acabou.
export function FechamentoScreen({ navigation, route }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { casa, membros } = useCasa();
  const { categorias } = useCategorias();
  const [mes, setMes] = useState(route.params?.mes ?? mesAnterior(hojeISO().slice(0, 7)));
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7)) - 1;
  const r = useResumoDoMes(ano, m);
  const ant = mesAnterior(mes);
  const rAnt = useResumoDoMes(Number(ant.slice(0, 4)), Number(ant.slice(5, 7)) - 1);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const temEntradas = r.totalEntradas > 0 || r.saldoAnterior !== 0;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const somas = new Map<string | null, number>();
  for (const g of r.despesas) somas.set(g.categoria_id, (somas.get(g.categoria_id) ?? 0) + g.valor);
  const porCategoria = [...somas.entries()].sort((a, b) => b[1] - a[1]);
  const maiores = [...r.despesas].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const estourados = porCategoria.filter(([id, soma]) => {
    const lim = id ? categoriaPorId.get(id)?.limite : null;
    return lim ? nivelLimite(soma, lim) === "passou" : false;
  });
  const totalPassou = estourados.reduce((s, [id, soma]) => s + soma - (categoriaPorId.get(id!)?.limite ?? 0), 0);
  // Tabela estreita: valor sem centavos ("R$ 1.913"), respeitando o olho.
  const valorCurto = (v: number) => mostrarValor(Math.round(v)).replace(/,00$/, "");
  const estiloColuna = { width: 74, textAlign: "right" as const };
  // Comparação só faz sentido se o mês anterior tinha lançamentos de verdade (não um mês quase vazio).
  const diffBruto = rAnt.totalDespesas > 0 ? (r.totalDespesas - rAnt.totalDespesas) / rAnt.totalDespesas : null;
  const diff = diffBruto != null && Math.abs(diffBruto) <= 2 ? diffBruto : null;
  const mesAtual = hojeISO().slice(0, 7);
  const semPessoa = r.despesas.filter((g) => !g.pago_por || !membros.some((p) => p.user_id === g.pago_por)).reduce((s, g) => s + g.valor, 0);

  function compartilhar() {
    if (!casa) return;
    enviarWhatsApp(
      textoResumoMes({ nomeCasa: casa.nome, ano, mes: m, gastos: r.despesas, categorias, membros, entradas: r.totalEntradas, saldoAnterior: r.saldoAnterior }),
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} style={{ padding: spacing.sm }} accessibilityLabel="Mês anterior">
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>
          {MESES[m]} {ano}
          {mes === mesAtual ? " (até hoje)" : ""}
        </Text>
        <TouchableOpacity
          onPress={() => mes < mesAtual && setMes(proximoMes(mes))}
          style={{ padding: spacing.sm, opacity: mes < mesAtual ? 1 : 0.3 }}
          accessibilityLabel="Próximo mês"
        >
          <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>

      <Cartao>
        {temEntradas ? (
          <>
            <Text style={typography.label}>{r.sobra >= 0 ? "✅ SOBROU" : "⚠️ FALTOU"}</Text>
            <Text style={{ fontSize: 36, fontWeight: "700", color: r.sobra >= 0 ? colors.accent : colors.danger }}>{mostrarValor(Math.abs(r.sobra))}</Text>
          </>
        ) : (
          <>
            <Text style={typography.label}>💰 DESPESAS</Text>
            <Text style={{ fontSize: 36, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(r.totalDespesas)}</Text>
          </>
        )}
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          {temEntradas && <Linha rotulo="📥 Entradas" valor={mostrarValor(r.totalEntradas)} cor={colors.accent} />}
          {r.saldoAnterior !== 0 && (
            <Linha rotulo={`↪️ Sobra de ${MESES[Number(ant.slice(5, 7)) - 1].toLowerCase()}`} valor={`${r.saldoAnterior < 0 ? "−" : "+"}${mostrarValor(Math.abs(r.saldoAnterior))}`} />
          )}
          <Linha rotulo="💸 Despesas" valor={`−${mostrarValor(r.totalDespesas)}`} cor={colors.danger} />
        </View>
        {diff != null && Math.abs(diff) >= 0.01 && (
          <Text style={[typography.label, { marginTop: spacing.sm, color: diff > 0 ? colors.danger : colors.accent }]}>
            {diff > 0 ? "▲" : "▼"} {Math.round(Math.abs(diff) * 100)}% {diff > 0 ? "a mais" : "a menos"} de despesas que {MESES[Number(ant.slice(5, 7)) - 1].toLowerCase()}
          </Text>
        )}
        {!temEntradas && <Text style={[typography.label, { marginTop: spacing.sm }]}>Lance as entradas do mês para ver quanto sobrou.</Text>}
      </Cartao>

      {estourados.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { color: colors.danger }]}>
            🚨 {estourados.length} {estourados.length === 1 ? "CATEGORIA PASSOU" : "CATEGORIAS PASSARAM"} DO LIMITE
          </Text>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>Juntas passaram {mostrarValor(totalPassou)}</Text>
          {/* Tabela: categoria | gastou | limite | passou */}
          <View style={{ flexDirection: "row", paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={[typography.label, { flex: 1 }]}>CATEGORIA</Text>
            <Text style={[typography.label, estiloColuna]}>GASTOU</Text>
            <Text style={[typography.label, estiloColuna]}>LIMITE</Text>
            <Text style={[typography.label, estiloColuna]}>PASSOU</Text>
          </View>
          {estourados.map(([id, soma], i) => {
            const c = categoriaPorId.get(id!)!;
            return (
              <View
                key={id}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
              >
                <Text style={[typography.body, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
                  {emojiCategoria(c.icone)} {c.nome}
                </Text>
                <Text style={[typography.body, estiloColuna, { fontSize: 13 }]}>{valorCurto(soma)}</Text>
                <Text style={[typography.body, estiloColuna, { fontSize: 13, color: colors.textSecondary }]}>{valorCurto(c.limite!)}</Text>
                <Text style={[typography.body, estiloColuna, { fontSize: 13, fontWeight: "700", color: colors.danger }]}>+{valorCurto(soma - c.limite!)}</Text>
              </View>
            );
          })}
        </Cartao>
      )}

      {porCategoria.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>ONDE MAIS GASTOU</Text>
          {porCategoria.slice(0, 6).map(([id, soma]) => {
            const c = id ? categoriaPorId.get(id) : undefined;
            return (
              <View key={id ?? "sem"} style={{ paddingVertical: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={typography.body}>
                    {emojiCategoria(c?.icone)} {c?.nome ?? "Sem categoria"}
                  </Text>
                  <Text style={typography.body}>
                    <Text style={{ fontWeight: "600" }}>{mostrarValor(soma)}</Text>
                    <Text style={typography.label}>  {Math.round((soma / r.totalDespesas) * 100)}%</Text>
                  </Text>
                </View>
                <Barra fracao={soma / porCategoria[0][1]} cor={c?.cor ?? colors.textSecondary} />
              </View>
            );
          })}
        </Cartao>
      )}

      {maiores.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>MAIORES DESPESAS</Text>
          {maiores.map((g) => {
            const c = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
            return (
              <View key={g.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs }}>
                <Text style={{ fontSize: 18, marginRight: spacing.sm }}>{emojiCategoria(c?.icone)}</Text>
                <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
                  {tituloGasto(g, c?.nome)}
                </Text>
                <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(g.valor)}</Text>
              </View>
            );
          })}
        </Cartao>
      )}

      {membros.length > 1 && r.totalDespesas > 0 && (
        <Cartao>
          <Text style={typography.label}>QUEM PAGOU AS DESPESAS</Text>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>Quanto das despesas do mês saiu do bolso de cada um (campo &quot;Quem pagou&quot; ao lançar).</Text>
          {membros.map((p) => {
            const soma = r.despesas.filter((g) => g.pago_por === p.user_id).reduce((s, g) => s + g.valor, 0);
            return <Linha key={p.user_id} rotulo={`👤 ${p.nome}`} valor={`${mostrarValor(soma)}  ${Math.round((soma / r.totalDespesas) * 100)}%`} />;
          })}
          {semPessoa > 0 && (
            <Linha rotulo="❔ Sem quem pagou (contas fixas em aberto)" valor={`${mostrarValor(semPessoa)}  ${Math.round((semPessoa / r.totalDespesas) * 100)}%`} />
          )}
        </Cartao>
      )}

      <Botao titulo="📤 Enviar resumo no WhatsApp" variante="secundario" onPress={compartilhar} />
    </ScrollView>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={typography.body}>{rotulo}</Text>
      <Text style={[typography.body, { fontWeight: "600", color: cor ?? colors.textPrimary }]}>{valor}</Text>
    </View>
  );
}
