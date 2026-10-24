import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Chip, TelaFormulario } from "../components/ui";
import { useSaldoAnterior } from "../data/hooks";
import { centavosDoTexto, formatarReais, MESES } from "../lib/format";
import { mesAnterior } from "../lib/saldo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SaldoAnterior">;

// Corrige à mão o saldo que veio do mês anterior (o automático é renda − despesas do mês anterior).
// Daqui em diante os meses seguintes continuam a conta a partir do valor corrigido.
export function SaldoAnteriorScreen({ navigation, route }: Props) {
  const { mes } = route.params; // YYYY-MM do mês que recebe o saldo
  const [ano, m] = mes.split("-").map(Number);
  const { definirSaldoInicial } = useCasa();
  const { saldo, ajustado } = useSaldoAnterior(ano, m - 1);
  const [centavos, setCentavos] = useState(Math.round(Math.abs(saldo) * 100));
  const [negativo, setNegativo] = useState(saldo < 0);

  const nomeAnterior = MESES[Number(mesAnterior(mes).slice(5, 7)) - 1].toLowerCase();

  function salvar() {
    definirSaldoInicial(mes, (negativo ? -centavos : centavos) / 100);
    navigation.goBack();
  }

  function automatico() {
    definirSaldoInicial(mes, null);
    navigation.goBack();
  }

  return (
    <TelaFormulario>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        O que sobrou em {nomeAnterior} entra sozinho em {MESES[m - 1].toLowerCase()}. Se o valor não estiver certo (ex.: dinheiro guardado, despesa que não foi lançada), corrija
        aqui.
        {ajustado ? "" : ` Valor calculado agora: ${formatarReais(saldo)}.`}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <Chip rotulo="✅ Sobrou" ativo={!negativo} onPress={() => setNegativo(false)} />
        <Chip rotulo="⚠️ Faltou" ativo={negativo} cor={colors.danger} onPress={() => setNegativo(true)} />
      </View>
      <Campo
        rotulo={negativo ? `QUANTO FALTOU EM ${nomeAnterior.toUpperCase()}` : `QUANTO SOBROU EM ${nomeAnterior.toUpperCase()}`}
        value={formatarReais(centavos / 100)}
        onChangeText={(t) => setCentavos(centavosDoTexto(t))}
        keyboardType="number-pad"
        autoFocus
      />
      <Botao titulo="Salvar" onPress={salvar} style={{ marginTop: spacing.md }} />
      {ajustado && <Botao titulo="Voltar ao cálculo automático" variante="link" onPress={automatico} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
