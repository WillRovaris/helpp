import React from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { formatarReais } from "../lib/format";
import { useSincronizacao } from "../offline/SincronizacaoContext";
import { colors, radius, spacing, typography } from "../theme";

/** "hoje às 14:32" ou "20/10 às 14:32". */
export function quandoFoi(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const hoje = new Date();
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? `hoje às ${hora}` : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${hora}`;
}

/**
 * Faixa na tela inicial que mostra a situação da sincronização:
 * novidades da outra pessoa, lançamentos esperando internet, sem internet ou tudo certo.
 * Tocar sincroniza na hora (ou mostra as novidades).
 */
export function StatusSincronizacao() {
  const { membros } = useCasa();
  const { sincronizando, online, ultimaSync, pendentes, novidades, novidadesDesde, sincronizarAgora, limparNovidades } = useSincronizacao();

  let icone = "☁️";
  let texto = `Tudo sincronizado · ${quandoFoi(ultimaSync)}`;
  let cor = colors.textSecondary;
  let fundo = "transparent";
  let aoTocar = sincronizarAgora;

  if (novidades.length) {
    const nomes = [...new Set(novidades.map((g) => membros.find((m) => m.user_id === g.created_by)?.nome).filter(Boolean))].join(" e ") || "outra pessoa";
    icone = "🔄";
    texto = `${novidades.length} ${novidades.length === 1 ? "despesa nova" : "despesas novas"} de ${nomes} desde ${quandoFoi(novidadesDesde)}`;
    cor = colors.accent;
    fundo = colors.surface;
    aoTocar = () =>
      Alert.alert(
        "Novidades",
        novidades
          .slice(0, 15)
          .map((g) => `• ${String(g.data).split("-").reverse().slice(0, 2).join("/")} ${g.descricao ?? "Despesa"} — ${formatarReais(Number(g.valor))}`)
          .join("\n") + (novidades.length > 15 ? `\n… e mais ${novidades.length - 15}` : ""),
        [{ text: "OK", onPress: limparNovidades }],
      );
  } else if (pendentes > 0) {
    icone = "⏳";
    texto = online === false ? `${pendentes} ${pendentes === 1 ? "lançamento aguardando" : "lançamentos aguardando"} internet` : `Enviando ${pendentes} ${pendentes === 1 ? "lançamento" : "lançamentos"}…`;
    cor = colors.warning;
    fundo = colors.surface;
  } else if (online === false) {
    icone = "📴";
    texto = `Sem internet · dados salvos no celular (de ${quandoFoi(ultimaSync)})`;
    cor = colors.warning;
  }

  return (
    <TouchableOpacity onPress={aoTocar} activeOpacity={0.7}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          backgroundColor: fundo,
          borderWidth: fundo === "transparent" ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {sincronizando ? <ActivityIndicator size="small" color={colors.accent} /> : <Text>{icone}</Text>}
        <Text style={[typography.label, { color: cor, flex: 1 }]} numberOfLines={2}>
          {texto}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
