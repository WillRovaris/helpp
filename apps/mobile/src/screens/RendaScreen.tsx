import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, Text } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, TelaFormulario } from "../components/ui";
import { centavosDoTexto, formatarReais } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Renda">;

// Renda mensal (opcional): só serve para o resumo mostrar "quanto sobra".
export function RendaScreen({ navigation }: Props) {
  const { casa, membros, definirRenda } = useCasa();
  const [centavos, setCentavos] = useState(Math.round((casa?.renda_mensal ?? 0) * 100));
  const [salvando, setSalvando] = useState(false);

  async function salvar(valor: number | null) {
    setSalvando(true);
    const { error } = await definirRenda(valor);
    setSalvando(false);
    if (error) Alert.alert("Não foi possível salvar", error);
    else navigation.goBack();
  }

  return (
    <TelaFormulario>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        {membros.length > 1 ? "Quanto entra por mês somando a renda de vocês dois" : "Quanto entra por mês"} (salário, extras). É opcional: serve só para o
        resumo mostrar quanto ainda sobra no mês.
      </Text>
      <Campo rotulo="RENDA MENSAL" value={formatarReais(centavos / 100)} onChangeText={(t) => setCentavos(centavosDoTexto(t))} keyboardType="number-pad" autoFocus />
      <Botao titulo="Salvar" onPress={() => salvar(centavos > 0 ? centavos / 100 : null)} carregando={salvando} style={{ marginTop: spacing.md }} />
      {casa?.renda_mensal != null && <Botao titulo="Não quero usar renda" variante="link" onPress={() => salvar(null)} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
