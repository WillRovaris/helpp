import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { type Categoria, emojiCategoria, type Gasto, tituloGasto } from "../data/tipos";
import { formatarReais, MESES } from "../lib/format";
import { supabase } from "../lib/supabase";
import { colors, spacing, typography } from "../theme";
import { Cartao } from "./ui";

/**
 * Resultado da busca do Histórico: procura em TODOS os meses pela descrição,
 * pelo nome da categoria ou pelo valor (se a pessoa digitar só números).
 */
export function ResultadosBusca({
  termo,
  categorias,
  onAbrir,
}: {
  termo: string;
  categorias: Categoria[];
  onAbrir: (gastoId: string) => void;
}) {
  const { casa } = useCasa();
  const [resultados, setResultados] = useState<Gasto[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!casa) return;
    let cancelado = false;
    // espera a pessoa parar de digitar
    const espera = setTimeout(async () => {
      setBuscando(true);
      const limpo = termo.trim().replace(/[,()%*]/g, " ").replace(/\s+/g, " ").trim();
      const numero = termo.trim().match(/^\d+(?:[.,]\d{1,2})?$/) ? Number(termo.trim().replace(",", ".")) : null;

      let consulta = supabase.from("gastos").select("*").eq("casa_id", casa.id);
      if (numero != null) {
        consulta = consulta.eq("valor", numero);
      } else {
        const idsCategoria = categorias.filter((c) => c.nome.toLowerCase().includes(limpo.toLowerCase())).map((c) => c.id);
        const filtros = [`descricao.ilike.%${limpo}%`];
        if (idsCategoria.length) filtros.push(`categoria_id.in.(${idsCategoria.join(",")})`);
        consulta = consulta.or(filtros.join(","));
      }
      const { data } = await consulta.order("data", { ascending: false }).limit(100);
      if (!cancelado) {
        setResultados((data ?? []).map((g) => ({ ...g, valor: Number(g.valor) })));
        setBuscando(false);
      }
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [termo, casa?.id, categorias]);

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const total = resultados.reduce((s, g) => s + g.valor, 0);

  if (buscando && !resultados.length) return <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />;

  if (!resultados.length) {
    return <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>Nada encontrado para "{termo.trim()}".</Text>;
  }

  return (
    <>
      <Text style={typography.label}>
        {resultados.length} {resultados.length === 1 ? "despesa encontrada" : "despesas encontradas"} · {formatarReais(total)}
        {resultados.length === 100 ? " (mostrando as 100 mais recentes)" : ""}
      </Text>
      <Cartao style={{ paddingVertical: spacing.xs }}>
        {resultados.map((g, i) => {
          const cat = g.categoria_id ? categoriaPorId.get(g.categoria_id) : undefined;
          const [a, m, d] = g.data.split("-");
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => onAbrir(g.id)}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{emojiCategoria(cat?.icone)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={typography.body} numberOfLines={1}>
                  {tituloGasto(g, cat?.nome)}
                </Text>
                <Text style={typography.label}>
                  {d}/{m}/{a} · {MESES[Number(m) - 1]}
                </Text>
              </View>
              <Text style={[typography.body, { fontWeight: "600" }]}>{formatarReais(g.valor)}</Text>
            </TouchableOpacity>
          );
        })}
      </Cartao>
    </>
  );
}
