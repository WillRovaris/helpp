import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Alerta } from "../lib/alertas";
import { colors, spacing, typography } from "../theme";
import { Cartao } from "./ui";

/** Quadro "💡 Alertas": cada alerta com ✕ para esconder. `max` limita (tela inicial); "ver todos" abre a lista. */
export function CartaoAlertas({
  alertas,
  onDispensar,
  onAbrir,
  max,
  onVerTodos,
}: {
  alertas: Alerta[];
  onDispensar: (id: string) => void;
  onAbrir: (a: Alerta) => void;
  max?: number;
  onVerTodos?: () => void;
}) {
  if (!alertas.length) return null;
  const mostrados = max ? alertas.slice(0, max) : alertas;
  return (
    <Cartao style={{ borderColor: colors.warning }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
        <Text style={[typography.label, { color: colors.warning }]}>💡 ALERTAS ({alertas.length})</Text>
        {onVerTodos && alertas.length > mostrados.length && (
          <TouchableOpacity onPress={onVerTodos} hitSlop={8}>
            <Text style={[typography.label, { color: colors.accent }]}>ver todos ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {mostrados.map((a, i) => (
        <View key={a.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 22 }}>{a.emoji}</Text>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => onAbrir(a)} activeOpacity={0.7}>
            <Text style={[typography.body, { fontWeight: "700" }]}>{a.titulo}</Text>
            <Text style={[typography.label, { lineHeight: 18 }]}>{a.texto}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDispensar(a.id)} hitSlop={10} accessibilityLabel="Esconder alerta">
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </Cartao>
  );
}
