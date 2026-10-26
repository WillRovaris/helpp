import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, estiloInput, TelaFormulario, IconeCategoria } from "../components/ui";
import { totalDaCategoriaNoMes } from "../data/limites";
import { useCategorias, useEntradasDoMes } from "../data/hooks";
import { Barra } from "../components/ResumoMes";
import { centavosDoTexto, formatarReais, hojeISO } from "../lib/format";
import { atualizar } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Limites">;

// Limite de gasto por mês em cada categoria. Vazio (R$ 0,00) = sem limite.
export function LimitesScreen({ navigation }: Props) {
  const { casa } = useCasa();
  const { categorias } = useCategorias();
  const mes = hojeISO().slice(0, 7);
  const [centavos, setCentavos] = useState<Record<string, number>>(() =>
    Object.fromEntries(categorias.map((c) => [c.id, Math.round((c.limite ?? 0) * 100)])),
  );

  const hoje = new Date();
  const { total: entradasMes } = useEntradasDoMes(hoje.getFullYear(), hoje.getMonth());
  const comLimite = categorias.filter((c) => (centavos[c.id] ?? 0) > 0);
  const totalLimites = comLimite.reduce((s, c) => s + (centavos[c.id] ?? 0), 0) / 100;
  const gastoComLimite = casa ? comLimite.reduce((s, c) => s + totalDaCategoriaNoMes(casa.id, c.id, mes), 0) : 0;
  const fracao = totalLimites > 0 ? gastoComLimite / totalLimites : 0;
  const nivelCor = fracao > 1 ? colors.danger : fracao >= 0.8 ? colors.warning : colors.accent;

  function salvar() {
    let mudou = 0;
    for (const c of categorias) {
      const novo = (centavos[c.id] ?? 0) / 100 || null;
      if ((c.limite ?? null) !== novo) {
        atualizar("categorias", c.id, { limite: novo });
        mudou++;
      }
    }
    if (!mudou) return navigation.goBack();
    Alert.alert("Limites salvos", "A tela inicial vai mostrar quanto ainda pode gastar em cada categoria, e o app avisa quando chegar em 80% e quando passar.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <TelaFormulario contentStyle={{ gap: spacing.md }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        Quanto vocês querem gastar no máximo, por mês, em cada categoria. Deixe em R$ 0,00 para não ter limite.
      </Text>

      {/* Soma de todos os limites (muda enquanto digita) e como ela se compara com o mês. */}
      <Cartao>
        <Text style={typography.label}>TOTAL DOS LIMITES ({comLimite.length} {comLimite.length === 1 ? "CATEGORIA" : "CATEGORIAS"})</Text>
        <Text style={{ fontSize: 30, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(totalLimites)}</Text>
        {totalLimites > 0 && (
          <>
            <Barra fracao={gastoComLimite / totalLimites} cor={nivelCor} />
            <Text style={[typography.label, { marginTop: spacing.xs }]}>
              Já foram {formatarReais(gastoComLimite)} este mês nessas categorias ({Math.round((gastoComLimite / totalLimites) * 100)}%)
            </Text>
          </>
        )}
        {entradasMes > 0 && totalLimites > 0 && (
          <Text style={[typography.label, { marginTop: spacing.xs, color: totalLimites > entradasMes ? colors.danger : colors.textSecondary }]}>
            {totalLimites > entradasMes
              ? `⚠️ Os limites somam ${formatarReais(totalLimites - entradasMes)} a mais que as entradas do mês (${formatarReais(entradasMes)})`
              : `Entradas do mês: ${formatarReais(entradasMes)} · ficam ${formatarReais(entradasMes - totalLimites)} fora dos limites`}
          </Text>
        )}
      </Cartao>
      <Cartao style={{ paddingVertical: spacing.xs }}>
        {categorias.map((c, i) => {
          const gasto = casa ? totalDaCategoriaNoMes(casa.id, c.id, mes) : 0;
          const valor = centavos[c.id] ?? 0;
          return (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <IconeCategoria categoria={c} />
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{c.nome}</Text>
                <Text style={typography.label}>Este mês: {formatarReais(gasto)}</Text>
              </View>
              <TextInput
                value={valor ? formatarReais(valor / 100) : ""}
                onChangeText={(t) => setCentavos((atual) => ({ ...atual, [c.id]: centavosDoTexto(t) }))}
                placeholder="Sem limite"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={[estiloInput(), { width: 130, textAlign: "right", paddingVertical: 8 }]}
              />
            </View>
          );
        })}
      </Cartao>
      <Botao titulo="Salvar limites" onPress={salvar} />
    </TelaFormulario>
  );
}
