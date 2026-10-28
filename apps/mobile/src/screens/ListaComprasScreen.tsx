import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, estiloInput, useEspacoRodape } from "../components/ui";
import { useListaCompras, useProdutos } from "../data/hooks";
import { buscarProdutos, produtoDoItem, resumoLista } from "../lib/produtos";
import { atualizar, excluir, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ListaCompras">;

// Lista de compras da casa (os dois veem ao vivo). Usa as notas lidas para mostrar o último preço,
// o mercado mais barato de cada item e o total estimado da compra.
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
  const comprados = itens.filter((i) => i.comprado);

  function adicionar(nome: string) {
    const n = nome.trim();
    if (!casa || !n) return;
    const existente = pendentes.find((i) => i.nome.toLowerCase() === n.toLowerCase());
    if (existente) atualizar("lista_compras", existente.id, { quantidade: existente.quantidade + 1 });
    else inserir("lista_compras", { casa_id: casa.id, nome: n.slice(0, 80), quantidade: 1, comprado: false, created_by: userId });
    setTexto("");
  }

  function limparComprados() {
    Alert.alert("Limpar comprados?", `${comprados.length} ${comprados.length === 1 ? "item sai" : "itens saem"} da lista.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => excluir("lista_compras", comprados.map((i) => i.id)) },
    ]);
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

      {itens.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Adicione o que precisa comprar. Quando o produto já apareceu numa nota fiscal lida, o app mostra o último preço e onde está mais barato. A lista é da casa: os dois veem e marcam ao vivo.
        </Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {[...pendentes, ...comprados].map((i, idx) => {
            const p = produtoDoItem(produtos, i.nome);
            const mercado = p?.maisBarato?.mercado ?? p?.compras[0]?.mercado;
            return (
              <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border, opacity: i.comprado ? 0.5 : 1 }}>
                <TouchableOpacity onPress={() => atualizar("lista_compras", i.id, { comprado: !i.comprado })} hitSlop={8} accessibilityLabel={i.comprado ? "Desmarcar" : "Marcar como comprado"}>
                  <Text style={{ fontSize: 22 }}>{i.comprado ? "☑️" : "⬜"}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { textDecorationLine: i.comprado ? "line-through" : "none" }]} numberOfLines={1}>
                    {i.quantidade !== 1 ? `${String(i.quantidade).replace(".", ",")} × ` : ""}
                    {i.nome}
                  </Text>
                  {p && !i.comprado && (
                    <Text style={typography.label} numberOfLines={1}>
                      último {mostrarValor(p.ultimoPreco)}
                      {mercado ? ` · mais barato: ${mercado}` : ""}
                    </Text>
                  )}
                </View>
                {!i.comprado && (
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
                )}
              </View>
            );
          })}
        </Cartao>
      )}
      {comprados.length > 0 && <Botao titulo={`Limpar comprados (${comprados.length})`} variante="link" onPress={limparComprados} />}
    </ScrollView>
  );
}
