import React from "react";
import { ScrollView, Text, View } from "react-native";
import { type Categoria, emojiCategoria } from "../data/tipos";
import { idPrincipal, principaisDe, subcategoriasDe } from "../lib/categorias";
import { spacing, typography } from "../theme";
import { Chip } from "./ui";

/**
 * Escolha da categoria em dois passos: as principais e, ao tocar numa, as subcategorias dela (opcional).
 * Tocar de novo na subcategoria volta para a principal; `limpar` permite desmarcar a principal.
 */
export function SeletorCategoria({
  categorias,
  valor,
  onMudar,
  limpar,
  rotuloTodas,
  emLinha,
  onNova,
}: {
  categorias: Categoria[];
  valor: string | null;
  onMudar: (id: string | null) => void;
  limpar?: boolean;
  /** Filtro: mostra um chip "Todas" antes das principais. */
  rotuloTodas?: string;
  /** Uma linha só, rolando para o lado (filtros). */
  emLinha?: boolean;
  /** Mostra "+ Nova": sem `paiId` cria principal; com `paiId`, subcategoria. */
  onNova?: (paiId?: string) => void;
}) {
  const principal = valor ? idPrincipal(valor, categorias) : null;
  const atual = categorias.find((c) => c.id === principal);
  const subs = atual ? subcategoriasDe(categorias, atual.id) : [];

  const linha = (conteudo: React.ReactNode) =>
    emLinha ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {conteudo}
      </ScrollView>
    ) : (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{conteudo}</View>
    );

  return (
    <View style={{ gap: spacing.sm, width: "100%" }}>
      {linha(
        <>
          {rotuloTodas && <Chip rotulo={rotuloTodas} ativo={!valor} onPress={() => onMudar(null)} />}
          {principaisDe(categorias).map((c) => (
            <Chip
              key={c.id}
              rotulo={`${emojiCategoria(c.icone)} ${c.nome}`}
              cor={c.cor}
              ativo={principal === c.id}
              onPress={() => onMudar(valor === c.id && limpar ? null : c.id)}
            />
          ))}
          {onNova && <Chip rotulo="+ Nova" ativo={false} onPress={() => onNova()} />}
        </>,
      )}
      {atual && (subs.length > 0 || onNova) && (
        <>
          <Text style={typography.label}>{atual.nome.toUpperCase()} · SUBCATEGORIA (OPCIONAL)</Text>
          {linha(
            <>
              {subs.map((c) => (
                <Chip
                  key={c.id}
                  rotulo={`${emojiCategoria(c.icone)} ${c.nome}`}
                  cor={c.cor}
                  ativo={valor === c.id}
                  onPress={() => onMudar(valor === c.id ? atual.id : c.id)}
                />
              ))}
              {onNova && <Chip rotulo="+ Nova" ativo={false} onPress={() => onNova(atual.id)} />}
            </>,
          )}
        </>
      )}
    </View>
  );
}
