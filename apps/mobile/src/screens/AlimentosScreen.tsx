import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Barra } from "../components/ResumoMes";
import { Cartao, Chip, useEspacoRodape } from "../components/ui";
import { useComprasPorGrupo } from "../data/hooks";
import { idDeTexto } from "../importacao/historico";
import { hojeISO, MESES } from "../lib/format";
import { GRUPOS, type GrupoId, type ProdutoDoGrupo, type ResumoGrupo } from "../lib/gruposAlimento";
import { mesAnterior } from "../lib/saldo";
import { linhas } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Alimentos">;

const PERIODOS = [
  { meses: 1, rotulo: "1 mês" },
  { meses: 3, rotulo: "3 meses" },
  { meses: 12, rotulo: "1 ano" },
];

const proximoMes = (m: string) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3)}/${m.slice(2, 4)}`;

// O que mais compramos: compras do mercado por tipo (proteínas, frutas, frios...). Tocar no tipo abre
// os produtos; tocar no produto corrige o tipo, e a correção vale para as notas antigas e as próximas.
export function AlimentosScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { casa } = useCasa();
  const mesAtual = hojeISO().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [periodo, setPeriodo] = useState(1);
  const [aberto, setAberto] = useState<GrupoId | null>(null);
  const [corrigindo, setCorrigindo] = useState<ProdutoDoGrupo | null>(null);
  const { alimentos, outros, totalAlimentos, total } = useComprasPorGrupo(mes, periodo);

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  let inicio = mes;
  for (let i = 1; i < periodo; i++) inicio = mesAnterior(inicio);
  const maior = Math.max(...[...alimentos, ...outros].map((g) => g.total), 1);

  function escolherGrupo(grupo: GrupoId) {
    if (!casa || !corrigindo) return;
    const existente = linhas("produto_grupos").find((c) => c.chave === corrigindo.chave);
    if (existente) atualizar("produto_grupos", String(existente.id), { grupo });
    // id tirado do nome: se os dois celulares corrigirem o mesmo produto, é o mesmo registro.
    else inserir("produto_grupos", { id: idDeTexto(`${casa.id}|${corrigindo.chave}`), casa_id: casa.id, chave: corrigindo.chave, grupo });
    setCorrigindo(null);
  }

  const linhaGrupo = (g: ResumoGrupo, base: number) => (
    <View key={g.id} style={{ paddingVertical: spacing.xs + 2 }}>
      <TouchableOpacity onPress={() => setAberto(aberto === g.id ? null : g.id)} activeOpacity={0.8}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={[typography.body, { flexShrink: 1 }]} numberOfLines={1}>
            {g.emoji} {g.nome}
          </Text>
          <Text style={typography.body}>
            <Text style={{ fontWeight: "600" }}>{mostrarValor(g.total)}</Text>
            <Text style={typography.label}>  {base > 0 ? Math.round((g.total / base) * 100) : 0}%</Text>
          </Text>
        </View>
        <Barra fracao={g.total / maior} cor={colors.accent} />
      </TouchableOpacity>
      {aberto === g.id && (
        <View style={{ marginTop: spacing.xs }}>
          {g.produtos.map((p) => (
            <TouchableOpacity
              key={p.chave}
              onPress={() => setCorrigindo(p)}
              accessibilityLabel={`Mudar o tipo de ${p.nome}`}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontSize: 14 }]} numberOfLines={2}>
                  {p.nome}
                </Text>
                <Text style={typography.label}>
                  {p.vezes} {p.vezes === 1 ? "compra" : "compras"} · tocar para mudar o tipo
                </Text>
              </View>
              <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>{mostrarValor(p.total)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700" }]}>{periodo === 1 ? `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` : `${rotuloMes(inicio)} a ${rotuloMes(mes)}`}</Text>
        <TouchableOpacity onPress={() => setMes(proximoMes(mes))} disabled={mes >= mesAtual} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: spacing.sm, opacity: mes >= mesAtual ? 0.3 : 1 }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}>
        {PERIODOS.map((p) => (
          <Chip key={p.meses} rotulo={p.rotulo} ativo={periodo === p.meses} onPress={() => setPeriodo(p.meses)} />
        ))}
      </View>

      <Cartao>
        <Text style={typography.label}>🍽️ GASTO COM ALIMENTOS</Text>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(totalAlimentos)}</Text>
        <Text style={typography.label}>de {mostrarValor(total)} comprados no mercado com nota lida</Text>
      </Cartao>

      {total === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Nenhuma nota de mercado neste período. Ao ler uma nota, os produtos entram aqui separados por tipo automaticamente.</Text>}

      {alimentos.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>ALIMENTOS · toque para ver os produtos</Text>
          {alimentos.map((g) => linhaGrupo(g, totalAlimentos))}
        </Cartao>
      )}
      {outros.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>OUTRAS COMPRAS DO MERCADO</Text>
          {outros.map((g) => linhaGrupo(g, total))}
        </Cartao>
      )}

      <Modal visible={!!corrigindo} transparent animationType="fade" onRequestClose={() => setCorrigindo(null)}>
        <Pressable onPress={() => setCorrigindo(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: rodape, gap: spacing.md }}>
            <Text style={[typography.body, { fontWeight: "700" }]}>{corrigindo?.nome}</Text>
            <Text style={typography.label}>QUAL É O TIPO DESTE PRODUTO? VALE PARA TODAS AS COMPRAS DELE.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {GRUPOS.filter((g) => g.id !== "outros").map((g) => (
                <Chip key={g.id} rotulo={`${g.emoji} ${g.nome}`} ativo={false} onPress={() => escolherGrupo(g.id)} />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
