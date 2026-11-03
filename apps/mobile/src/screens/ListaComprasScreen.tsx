import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, estiloInput, useEspacoRodape } from "../components/ui";
import { useComprasDoMes, useComprasPorGrupo, useListaCompras, useProdutos } from "../data/hooks";
import { hojeISO, MESES } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import { buscarProdutos, produtoDoItem, resumoLista } from "../lib/produtos";
import { atualizar, excluir, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ListaCompras">;

/** Quantos tipos de alimento aparecem no resumo do mês (o resto fica no "Ver detalhado"). */
const TIPOS_NO_RESUMO = 5;
const proximoMes = (m: string) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Lista de compras da casa (os dois veem ao vivo): só o que falta comprar. Usa as notas lidas para
// mostrar o último preço, o mercado mais barato e o total estimado. O ✓ (ou a nota do mercado) manda
// o item para "Compras do mês".
export function ListaComprasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { userId } = useAuth();
  const { casa } = useCasa();
  const { itens } = useListaCompras();
  const { produtos } = useProdutos();
  const [texto, setTexto] = useState("");

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const sugestoes = useMemo(() => (texto.trim().length >= 2 ? buscarProdutos(produtos, texto).sort((a, b) => b.vezes - a.vezes).slice(0, 5) : []), [produtos, texto]);
  const resumo = resumoLista(itens, produtos);
  const pendentes = itens.filter((i) => !i.comprado);
  const mesAtual = hojeISO().slice(0, 7);
  const [mesCompras, setMesCompras] = useState(mesAtual);
  const comprasMes = useComprasDoMes(mesCompras);
  const porTipo = useComprasPorGrupo(`${mesCompras}-01`, `${mesCompras}-31`);

  function adicionar(nome: string) {
    const n = nome.trim();
    if (!casa || !n) return;
    const existente = pendentes.find((i) => i.nome.toLowerCase() === n.toLowerCase());
    if (existente) atualizar("lista_compras", existente.id, { quantidade: existente.quantidade + 1 });
    else inserir("lista_compras", { casa_id: casa.id, nome: n.slice(0, 80), quantidade: 1, comprado: false, created_by: userId });
    setTexto("");
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => adicionar(texto)}
          placeholder="Adicionar item (ex.: leite, café)"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          blurOnSubmit={false}
          style={[estiloInput(), { flex: 1 }]}
        />
        <Botao titulo="+" onPress={() => adicionar(texto)} style={{ minHeight: 48, paddingHorizontal: spacing.lg }} />
      </View>
      {sugestoes.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {sugestoes.map((p) => (
            <TouchableOpacity
              key={p.chave}
              onPress={() => adicionar(p.nome)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
            >
              <Text style={[typography.label, { color: colors.textPrimary }]} numberOfLines={1}>
                + {p.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {pendentes.length > 0 && (
        <Cartao>
          <Text style={typography.label}>💰 TOTAL ESTIMADO</Text>
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(resumo.total)}</Text>
          <Text style={typography.label}>
            {resumo.comPreco} de {pendentes.length} {pendentes.length === 1 ? "item" : "itens"} com preço das notas lidas
          </Text>
          {resumo.melhorMercado && (
            <Text style={[typography.body, { marginTop: spacing.xs, fontWeight: "600" }]}>
              🏆 Mais barato no {resumo.melhorMercado.mercado} ({resumo.melhorMercado.itens} {resumo.melhorMercado.itens === 1 ? "item" : "itens"})
            </Text>
          )}
        </Cartao>
      )}

      {pendentes.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {itens.length === 0
            ? "Adicione o que precisa comprar. Quando o produto já apareceu numa nota fiscal lida, o app mostra o último preço e onde está mais barato. A lista é da casa: os dois veem e marcam ao vivo."
            : "✅ Nada para comprar agora. O que foi comprado está em Compras do mês."}
        </Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {pendentes.map((i, idx) => {
            const p = produtoDoItem(produtos, i.nome);
            const mercado = p?.maisBarato?.mercado ?? p?.compras[0]?.mercado;
            return (
              <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border }}>
                <TouchableOpacity
                  onPress={() => atualizar("lista_compras", i.id, { comprado: true, comprado_em: hojeISO() })}
                  hitSlop={8}
                  accessibilityLabel="Marcar como comprado"
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: colors.accentContrast, fontSize: 18, fontWeight: "700" }}>✓</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>
                    {i.quantidade !== 1 ? `${String(i.quantidade).replace(".", ",")} × ` : ""}
                    {i.nome}
                  </Text>
                  {p && (
                    <Text style={typography.label} numberOfLines={1}>
                      último {mostrarValor(p.ultimoPreco)}
                      {mercado ? ` · mais barato: ${mercado}` : ""}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => (i.quantidade > 1 ? atualizar("lista_compras", i.id, { quantidade: i.quantidade - 1 }) : excluir("lista_compras", [i.id]))}
                    hitSlop={6}
                    style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.textPrimary }}>{i.quantidade > 1 ? "−" : "🗑"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => atualizar("lista_compras", i.id, { quantidade: i.quantidade + 1 })}
                    hitSlop={6}
                    style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.textPrimary }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </Cartao>
      )}

      {/* Resumo das compras do mês (pedido do dono): o detalhe fica na tela Compras do mês. */}
      <Cartao style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => setMesCompras(mesAnterior(mesCompras))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ paddingHorizontal: spacing.sm }}>
            <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
          </TouchableOpacity>
          <Text style={[typography.body, { fontWeight: "700" }]}>
            🧾 Compras de {MESES[Number(mesCompras.slice(5, 7)) - 1].toLowerCase()}
            {mesCompras.slice(0, 4) !== mesAtual.slice(0, 4) ? ` de ${mesCompras.slice(0, 4)}` : ""}
          </Text>
          <TouchableOpacity onPress={() => setMesCompras(proximoMes(mesCompras))} disabled={mesCompras >= mesAtual} hitSlop={10} accessibilityLabel="Próximo mês" style={{ paddingHorizontal: spacing.sm, opacity: mesCompras >= mesAtual ? 0.3 : 1 }}>
            <Text style={{ fontSize: 24, color: colors.accent }}>›</Text>
          </TouchableOpacity>
        </View>
        <View>
          <Text style={typography.label}>🛒 GASTO NO SUPERMERCADO</Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(comprasMes.totalMercado)}</Text>
        </View>
        {porTipo.alimentos.length > 0 ? (
          <View>
            <Text style={[typography.label, { marginBottom: 4 }]}>🥗 TIPOS DE ALIMENTOS · {mostrarValor(porTipo.totalAlimentos)}</Text>
            {porTipo.alimentos.slice(0, TIPOS_NO_RESUMO).map((g) => (
              <View key={g.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                <Text style={[typography.body, { fontSize: 14, flexShrink: 1 }]} numberOfLines={1}>
                  {g.emoji} {g.nome}
                </Text>
                <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>
                  {mostrarValor(g.total)}
                  <Text style={typography.label}>  {porTipo.totalAlimentos > 0 ? Math.round((g.total / porTipo.totalAlimentos) * 100) : 0}%</Text>
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={typography.label}>Nenhuma nota de mercado lida neste mês.</Text>
        )}
        <TouchableOpacity onPress={() => navigation.navigate("ComprasMes", { mes: mesCompras })} hitSlop={6} style={{ paddingTop: spacing.xs }}>
          <Text style={[typography.label, { color: colors.accent, fontWeight: "700" }]}>Ver detalhado ›</Text>
        </TouchableOpacity>
      </Cartao>
    </ScrollView>
  );
}
