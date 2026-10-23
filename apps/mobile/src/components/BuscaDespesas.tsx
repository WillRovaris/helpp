import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { type Categoria, emojiCategoria, type Gasto, tituloGasto } from "../data/tipos";
import { MESES } from "../lib/format";
import { linhas } from "../offline/banco";
import { colors, spacing, typography } from "../theme";
import { Cartao } from "./ui";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";

/** Minúsculas e sem acento, para "agua" achar "Água". */
function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036F]/g, "").toLowerCase();
}

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
  const { mostrarValor } = usePrivacidade();
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

      // Busca na cópia do celular (funciona sem internet), sem diferenciar acentos e maiúsculas.
      const termoNorm = semAcento(limpo);
      const idsCategoria = new Set(categorias.filter((c) => semAcento(c.nome).includes(termoNorm)).map((c) => c.id));
      const achados = linhas("gastos")
        .filter((g) => g.casa_id === casa.id)
        .filter((g) =>
          numero != null
            ? Math.abs(Number(g.valor) - numero) < 0.005
            : semAcento(g.descricao ?? "").includes(termoNorm) || (g.categoria_id != null && idsCategoria.has(g.categoria_id)),
        )
        .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
        .slice(0, 100)
        .map((g) => ({ ...g, valor: Number(g.valor) }) as Gasto);
      if (!cancelado) {
        setResultados(achados);
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
        {resultados.length} {resultados.length === 1 ? "despesa encontrada" : "despesas encontradas"} · {mostrarValor(total)}
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
              <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(g.valor)}</Text>
            </TouchableOpacity>
          );
        })}
      </Cartao>
    </>
  );
}
