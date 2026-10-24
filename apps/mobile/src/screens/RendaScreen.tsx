import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Cartao, TelaFormulario } from "../components/ui";
import { centavosDoTexto, formatarReais } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Renda">;

// Renda mensal (opcional): só serve para o resumo mostrar "quanto sobra".
// Casal: um campo para cada pessoa (salário de cada um) e o total embaixo.
export function RendaScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const { casa, membros, definirRenda } = useCasa();
  // Quem está usando o app aparece primeiro.
  const pessoas = membros.length
    ? [...membros].sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0))
    : [{ user_id: userId ?? "eu", nome: "" }];
  const casal = pessoas.length > 1;

  const [centavos, setCentavos] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {};
    for (const m of pessoas) if (casa?.rendas[m.user_id] != null) inicial[m.user_id] = Math.round(casa.rendas[m.user_id] * 100);
    // Renda antiga (só o total, de antes de separar por pessoa): fica no campo de quem está usando.
    if (!Object.keys(inicial).length && casa?.renda_mensal) inicial[pessoas[0].user_id] = Math.round(casa.renda_mensal * 100);
    return inicial;
  });
  const [salvando, setSalvando] = useState(false);

  const totalCentavos = pessoas.reduce((s, m) => s + (centavos[m.user_id] ?? 0), 0);

  async function salvar(semRenda = false) {
    setSalvando(true);
    const rendas: Record<string, number> = {};
    if (!semRenda) for (const m of pessoas) if (centavos[m.user_id]) rendas[m.user_id] = centavos[m.user_id] / 100;
    const { error } = await definirRenda(!semRenda && totalCentavos > 0 ? totalCentavos / 100 : null, rendas);
    setSalvando(false);
    if (error) Alert.alert("Não foi possível salvar", error);
    else navigation.goBack();
  }

  return (
    <TelaFormulario>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        {casal ? "Quanto cada um recebe por mês" : "Quanto entra por mês"} (salário, extras). É opcional: serve só para o resumo mostrar quanto ainda sobra no mês.
      </Text>
      {pessoas.map((m, i) => (
        <Campo
          key={m.user_id}
          rotulo={casal ? `RENDA DE ${m.nome.toUpperCase()}` : "RENDA MENSAL"}
          value={formatarReais((centavos[m.user_id] ?? 0) / 100)}
          onChangeText={(t) => setCentavos((atual) => ({ ...atual, [m.user_id]: centavosDoTexto(t) }))}
          keyboardType="number-pad"
          autoFocus={i === 0}
        />
      ))}
      {casal && (
        <Cartao>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[typography.label, { flex: 1 }]}>TOTAL DA CASA</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>{formatarReais(totalCentavos / 100)}</Text>
          </View>
        </Cartao>
      )}
      <Botao titulo="Salvar" onPress={() => salvar()} carregando={salvando} style={{ marginTop: spacing.md }} />
      {casa?.renda_mensal != null && <Botao titulo="Não quero usar renda" variante="link" onPress={() => salvar(true)} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
